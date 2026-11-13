import assert from "node:assert/strict";
import test from "node:test";
import { createRuntime } from "../src/runtime.js";

// The environment infra/backend-lambda.yaml produces. pg.Pool connects lazily, so no database is needed.
const base = {
  DATABASE_URL: "postgres://patela:x@localhost:5432/patela", GOOGLE_OAUTH_CLIENT_ID: "client-id",
  PUBLIC_ORIGIN: "https://demo.example", PG_POOL_MAX: "2", CHAIN_CONFIRMATIONS: "3",
  BASE_RPC_URL: "", ESCROW_ADDRESS: "", DEMO_MODE: "false",
};

async function starts(env: Record<string, string>) {
  const { app, db } = createRuntime(env);
  await app.close();
  await db.close();
}

test("the stack's mainnet defaults start: blank RPC and escrow, TOKEN_ADDRESS omitted", async () => {
  await starts({ ...base, CHAIN_ID: "8453" });
});

test("the stack's demo settings start: Base Sepolia, MockZARP, Gmail secret, demo mode", async () => {
  await starts({ ...base, CHAIN_ID: "84532", BASE_RPC_URL: "https://sepolia.base.org",
    ESCROW_ADDRESS: "0x1111111111111111111111111111111111111111",
    TOKEN_ADDRESS: "0x2222222222222222222222222222222222222222",
    SMTP_SECRET_ARN: "arn:aws:secretsmanager:af-south-1:123456789012:secret:patela-smtp", DEMO_MODE: "true" });
});

test("an empty TOKEN_ADDRESS, or Base Sepolia without one, stops startup (why the stack omits it)", () => {
  assert.throws(() => createRuntime({ ...base, CHAIN_ID: "8453", TOKEN_ADDRESS: "" }), /TOKEN_ADDRESS/);
  assert.throws(() => createRuntime({ ...base, CHAIN_ID: "84532" }), /TOKEN_ADDRESS/);
});
