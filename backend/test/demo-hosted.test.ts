import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import type { Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { buildApp } from "../src/app.js";
import { PostgresAuth, type GoogleIdentityProvider } from "../src/auth.js";
import { TestAuth, TestDatabase } from "./helpers.js";
import { ESCROW, TOKEN, TestChain, TestIntegrations, bearer, linkWallet } from "./demo-helpers.js";

// HOSTED DEMO: the shortcuts (code shown in the app, demo inbox, auto-approved business) apply
// only to the reserved demo personas (@demo.patela.local, a domain that cannot receive mail).
// Every other address behaves exactly as in production.

const google: GoogleIdentityProvider = {
  authorizationUrl: () => "https://accounts.google.com/test",
  exchange: async () => { throw new Error("unused"); },
  verifyCredential: async () => { throw new Error("unused"); },
};

async function hostedOtpApp() {
  const db = new TestDatabase();
  await db.migrate();
  const app = buildApp({ db, auth: new PostgresAuth(db, google), escrowAddress: ESCROW,
    publicOrigin: "https://demo.example.amplifyapp.com", chainId: 84532, tokenAddress: TOKEN, tokenDecimals: 18,
    integrations: new TestIntegrations(), demoMode: true, demoHosted: true });
  return { app, db };
}

test("Given a hosted demo, When a demo persona requests a code, Then it is returned and readable in that persona's inbox only", async () => {
  const { app, db } = await hostedOtpApp();
  try {
    const requested = await app.inject({ method: "POST", url: "/auth/otp/request",
      payload: { email: "Buyer@Demo.Patela.Local" } });
    assert.equal(requested.statusCode, 200, requested.body);
    assert.equal(requested.json().demo, true);
    assert.match(requested.json().code, /^\d{6}$/);

    const inbox = await app.inject({ method: "GET", url: "/demo/inbox?email=buyer@demo.patela.local" });
    assert.equal(inbox.statusCode, 200, inbox.body);
    assert.equal(inbox.json().emails[0].payload.code, requested.json().code);

    // The whole outbox, or any non-demo address, stays hidden.
    assert.equal((await app.inject({ method: "GET", url: "/demo/inbox" })).statusCode, 404);
    assert.equal((await app.inject({ method: "GET", url: "/demo/inbox?email=someone@gmail.com" })).statusCode, 404);
  } finally { await app.close(); await db.close(); }
});

test("Given a hosted demo, When a real address requests a code, Then the code is not revealed", async () => {
  const { app, db } = await hostedOtpApp();
  try {
    const requested = await app.inject({ method: "POST", url: "/auth/otp/request",
      payload: { email: "someone@gmail.com" } });
    assert.equal(requested.statusCode, 200, requested.body);
    assert.deepEqual(requested.json(), { queued: true });
  } finally { await app.close(); await db.close(); }
});

async function hostedOrderApp() {
  const db = new TestDatabase();
  const auth = new TestAuth();
  const app = buildApp({ db, auth, chain: new TestChain(), escrowAddress: ESCROW,
    publicOrigin: "https://demo.example.amplifyapp.com", chainId: 84532, tokenAddress: TOKEN, tokenDecimals: 18,
    integrations: new TestIntegrations(), demoMode: true, demoHosted: true });
  await db.migrate();
  return { app, db, auth };
}

const ORDER = {
  supplierEmail: "supplier@demo.patela.local", totalZarp: "100", driverAtPickupZarp: "10",
  supplierAtPickupZarp: "40", supplierAtDeliveryZarp: "50", agreementText: "Demo crates, Joburg to Polokwane.",
};

test("Given a hosted demo, When the demo buyer orders without a business, Then an approved demo business is created", async () => {
  const { app, db, auth } = await hostedOrderApp();
  try {
    const userId = randomUUID();
    auth.users.set("user-0", { id: userId, email: "buyer@demo.patela.local" });
    await linkWallet(app, 0, userId, privateKeyToAccount(`0x${"0b".repeat(32)}` as Hex), 84532);
    const order = await app.inject({ method: "POST", url: "/orders", headers: bearer(0), payload: ORDER });
    assert.equal(order.statusCode, 200, order.body);
    const orgs = await db.query("select status from organizations");
    assert.equal(orgs.rows[0].status, "approved");
  } finally { await app.close(); await db.close(); }
});

test("Given a hosted demo, When a real user orders without a business, Then they still need approval", async () => {
  const { app, db, auth } = await hostedOrderApp();
  try {
    const userId = randomUUID();
    auth.users.set("user-0", { id: userId, email: "buyer@company.co.za" });
    await linkWallet(app, 0, userId, privateKeyToAccount(`0x${"0c".repeat(32)}` as Hex), 84532);
    const order = await app.inject({ method: "POST", url: "/orders", headers: bearer(0), payload: ORDER });
    assert.equal(order.statusCode, 403, order.body);
    assert.equal((await db.query("select id from organizations")).rows.length, 0);
  } finally { await app.close(); await db.close(); }
});
