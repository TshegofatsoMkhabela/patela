import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import type { Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { buildApp } from "../src/app.js";
import { PostgresAuth, type GoogleIdentityProvider } from "../src/auth.js";
import { createRuntime } from "../src/runtime.js";
import { TestAuth, TestDatabase } from "./helpers.js";
import { ESCROW, TOKEN, TestChain, TestIntegrations, bearer, linkWallet } from "./demo-helpers.js";

const google: GoogleIdentityProvider = {
  authorizationUrl: () => "https://accounts.google.com/test",
  exchange: async () => { throw new Error("unused"); },
  verifyCredential: async () => { throw new Error("unused"); },
};

async function otpApp(demoLocal: boolean) {
  const db = new TestDatabase();
  await db.migrate();
  const app = buildApp({ db, auth: new PostgresAuth(db, google), escrowAddress: ESCROW,
    publicOrigin: "http://localhost:3001", chainId: 31337, tokenAddress: TOKEN, tokenDecimals: 18,
    integrations: new TestIntegrations(), demoMode: true, demoLocal });
  return { app, db };
}

test("Given local demo shortcuts, When a code is requested, Then the code is returned and in the demo inbox", async () => {
  const { app, db } = await otpApp(true);
  try {
    const requested = await app.inject({ method: "POST", url: "/auth/otp/request",
      payload: { email: "Buyer@Demo.test" } });
    assert.equal(requested.statusCode, 200, requested.body);
    const { code, demo } = requested.json();
    assert.equal(demo, true);
    assert.match(code, /^\d{6}$/);
    const inbox = await app.inject({ method: "GET", url: "/demo/inbox?email=buyer@demo.test" });
    assert.equal(inbox.statusCode, 200, inbox.body);
    assert.equal(inbox.json().emails[0].template, "login_otp");
    assert.equal(inbox.json().emails[0].payload.code, code);
    const verified = await app.inject({ method: "POST", url: "/auth/otp/verify",
      payload: { email: "buyer@demo.test", code } });
    assert.equal(verified.statusCode, 200, verified.body);
  } finally { await app.close(); await db.close(); }
});

test("Given DEMO_MODE without local shortcuts, When a code is requested, Then neither the response nor an inbox reveals it", async () => {
  const { app, db } = await otpApp(false);
  try {
    const requested = await app.inject({ method: "POST", url: "/auth/otp/request",
      payload: { email: "buyer@demo.test" } });
    assert.equal(requested.statusCode, 200, requested.body);
    assert.deepEqual(requested.json(), { queued: true });
    assert.equal((await app.inject({ method: "GET", url: "/demo/inbox" })).statusCode, 404);
  } finally { await app.close(); await db.close(); }
});

test("Given local demo shortcuts, When a buyer with no business orders, Then an approved demo business is created", async () => {
  const db = new TestDatabase();
  const auth = new TestAuth();
  const app = buildApp({ db, auth, chain: new TestChain(), escrowAddress: ESCROW,
    publicOrigin: "http://localhost:3001", chainId: 31337, tokenAddress: TOKEN, tokenDecimals: 18,
    integrations: new TestIntegrations(), demoMode: true, demoLocal: true });
  try {
    await db.migrate();
    const userId = randomUUID();
    auth.users.set("user-0", { id: userId, email: "buyer@demo.test" });
    await linkWallet(app, 0, userId, privateKeyToAccount(`0x${"0b".repeat(32)}` as Hex), 31337);
    const order = await app.inject({ method: "POST", url: "/orders", headers: bearer(0), payload: {
      supplierEmail: "supplier@demo.test", totalZarp: "100", driverAtPickupZarp: "10",
      supplierAtPickupZarp: "40", supplierAtDeliveryZarp: "50", agreementText: "Demo crates, Joburg to Polokwane." } });
    assert.equal(order.statusCode, 200, order.body);
    assert.match(order.json().acceptUrl, /^http:\/\/localhost:3001\/accept\?token=/);
    const orgs = await db.query("select status, capabilities from organizations");
    assert.equal(orgs.rows[0].status, "approved");

    // Submitting a business through onboarding is also approved straight away.
    const org = await app.inject({ method: "POST", url: "/organizations", headers: bearer(0),
      payload: { legalName: "Second Demo (Pty) Ltd", registrationNumber: "2020/123456/07", capabilities: ["carrier"] } });
    const submitted = await app.inject({ method: "POST", url: `/organizations/${org.json().id}/submit`,
      headers: bearer(0) });
    assert.equal(submitted.json().status, "approved", submitted.body);
  } finally { await app.close(); await db.close(); }
});

const local = {
  DATABASE_URL: "postgres://patela:x@localhost:5432/patela", DEMO_MODE: "true", CHAIN_ID: "31337",
  BASE_RPC_URL: "http://127.0.0.1:8545", ESCROW_ADDRESS: ESCROW, TOKEN_ADDRESS: TOKEN, CHAIN_CONFIRMATIONS: "1",
  PUBLIC_ORIGIN: "http://localhost:3001", API_ORIGIN: "http://localhost:4000", DEMO_LOCAL: "true",
};

test("Given the local demo env (chain 31337, no Google client ID), Then the runtime starts", async () => {
  const { app, db } = createRuntime(local);
  await app.close();
  await db.close();
});

test("Given chain 31337 without a token, or no Google client ID outside demo mode, Then startup stops", () => {
  assert.throws(() => createRuntime({ ...local, TOKEN_ADDRESS: undefined }), /TOKEN_ADDRESS/);
  assert.throws(() => createRuntime({ ...local, DEMO_MODE: "false" }), /GOOGLE_OAUTH_CLIENT_ID/);
  assert.throws(() => createRuntime({ ...local, CHAIN_ID: "1" }), /CHAIN_ID/);
});

test("Given DATABASE_URL=pglite:memory, Then the runtime opens a migrated in-process database", async () => {
  const { app, db } = createRuntime({ ...local, DATABASE_URL: "pglite:memory" });
  try {
    const health = await app.inject({ method: "GET", url: "/health" });
    assert.equal(health.statusCode, 200);
    const tables = await db.query("select count(*)::int as n from schema_migrations");
    assert.ok(Number(tables.rows[0].n) >= 5);
  } finally { await app.close(); await db.close(); }
});

test("Given DEMO_MODE on a public API origin, with Gmail, or without DEMO_LOCAL, Then the demo inbox stays off", async () => {
  for (const extra of [{ API_ORIGIN: "https://api.example", PUBLIC_ORIGIN: "https://demo.example" },
    { SMTP_SECRET_ARN: "arn:aws:secretsmanager:af-south-1:123456789012:secret:patela-smtp" },
    // A Lambda with DEMO_MODE but no API_ORIGIN defaults to localhost: without DEMO_LOCAL it stays off.
    { DEMO_LOCAL: undefined, API_ORIGIN: undefined }]) {
    const { app, db } = createRuntime({ ...local, ...extra });
    try {
      assert.equal((await app.inject({ method: "GET", url: "/demo/inbox" })).statusCode, 404);
    } finally { await app.close(); await db.close(); }
  }
});

test("Given a wallet linked to one account, When another account links it, Then it is a 409, not a 500", async () => {
  const db = new TestDatabase();
  const auth = new TestAuth();
  const app = buildApp({ db, auth, escrowAddress: ESCROW, publicOrigin: "http://localhost:3001", chainId: 31337,
    tokenAddress: TOKEN, tokenDecimals: 18, integrations: new TestIntegrations() });
  try {
    await db.migrate();
    const wallet = privateKeyToAccount(`0x${"0c".repeat(32)}` as Hex);
    const [first, second] = [randomUUID(), randomUUID()];
    auth.users.set("user-0", { id: first, email: "one@demo.test" });
    auth.users.set("user-1", { id: second, email: "two@demo.test" });
    await linkWallet(app, 0, first, wallet, 31337);
    const challenge = await app.inject({ method: "POST", url: "/wallet/challenge", headers: bearer(1),
      payload: { wallet: wallet.address } });
    const { challengeId, typedData } = challenge.json();
    const { walletLinkTypedData } = await import("../src/service.js");
    const signature = await wallet.signTypedData(walletLinkTypedData(31337, second, wallet.address,
      typedData.message.nonce, Number(typedData.message.expiresAt)));
    const linked = await app.inject({ method: "POST", url: "/wallet/link", headers: bearer(1),
      payload: { challengeId, signature } });
    assert.equal(linked.statusCode, 409, linked.body);
  } finally { await app.close(); await db.close(); }
});
