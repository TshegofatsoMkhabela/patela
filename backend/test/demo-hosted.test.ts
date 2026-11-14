import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import type { Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { buildApp } from "../src/app.js";
import { PostgresAuth, type GoogleIdentityProvider } from "../src/auth.js";
import { TestAuth, TestDatabase } from "./helpers.js";
import {
  DEMO_CHAIN_ID,
  ESCROW,
  TOKEN,
  TestChain,
  TestIntegrations,
  bearer,
  linkWallet,
} from "./demo-helpers.js";

const google: GoogleIdentityProvider = {
  authorizationUrl: () => "https://accounts.google.com/test",
  exchange: async () => {
    throw new Error("unused");
  },
  verifyCredential: async () => {
    throw new Error("unused");
  },
};

async function hostedOtpApp() {
  const db = new TestDatabase();
  await db.migrate();
  const app = buildApp({
    db,
    auth: new PostgresAuth(db, google),
    escrowAddress: ESCROW,
    publicOrigin: "https://demo.example.amplifyapp.com",
    chainId: DEMO_CHAIN_ID,
    tokenAddress: TOKEN,
    tokenDecimals: 18,
    integrations: new TestIntegrations(),
    demoMode: true,
    demoHosted: true,
  });
  return { app, db };
}

test("hosted demo returns an OTP only for reserved demo personas", async () => {
  const { app, db } = await hostedOtpApp();
  try {
    const demo = await app.inject({
      method: "POST",
      url: "/auth/otp/request",
      payload: { email: "Buyer@Demo.Patela.Local" },
    });
    assert.equal(demo.statusCode, 200, demo.body);
    assert.equal(demo.json().demo, true);
    assert.match(demo.json().code, /^\d{6}$/);

    const real = await app.inject({
      method: "POST",
      url: "/auth/otp/request",
      payload: { email: "someone@gmail.com" },
    });
    assert.deepEqual(real.json(), { queued: true });
  } finally {
    await app.close();
    await db.close();
  }
});

test("hosted demo auto-approves trading capability only for reserved demo personas", async () => {
  const db = new TestDatabase();
  const auth = new TestAuth();
  const app = buildApp({
    db,
    auth,
    chain: new TestChain(),
    escrowAddress: ESCROW,
    publicOrigin: "https://demo.example.amplifyapp.com",
    chainId: DEMO_CHAIN_ID,
    tokenAddress: TOKEN,
    tokenDecimals: 18,
    integrations: new TestIntegrations(),
    demoMode: true,
    demoHosted: true,
  });
  await db.migrate();
  try {
    const userId = randomUUID();
    auth.users.set("user-0", { id: userId, email: "buyer@demo.patela.local" });
    await linkWallet(
      app,
      0,
      userId,
      privateKeyToAccount(`0x${"0b".repeat(32)}` as Hex),
      DEMO_CHAIN_ID,
    );
    const order = await app.inject({
      method: "POST",
      url: "/orders",
      headers: bearer(0),
      payload: {
        supplierEmail: "supplier@demo.patela.local",
        totalZarp: "100",
        driverAtPickupZarp: "10",
        supplierAtPickupZarp: "40",
        supplierAtDeliveryZarp: "50",
        agreementText: "Demo crates, Johannesburg to Polokwane.",
      },
    });
    assert.equal(order.statusCode, 200, order.body);
    assert.equal((await db.query("select status from organizations")).rows[0].status, "approved");
  } finally {
    await app.close();
    await db.close();
  }
});
