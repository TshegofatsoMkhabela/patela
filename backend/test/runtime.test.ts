import assert from "node:assert/strict";
import test from "node:test";
import { createRuntime } from "../src/runtime.js";

// The environment infra/backend-lambda.yaml produces. pg.Pool connects lazily, so no database is needed.
const base = {
  DATABASE_URL: "postgres://patela:x@localhost:5432/patela", GOOGLE_OAUTH_CLIENT_ID: "client-id",
  PUBLIC_ORIGIN: "https://demo.example", API_ORIGIN: "https://api.example",
  PG_POOL_MAX: "2", CHAIN_CONFIRMATIONS: "3",
  BASE_RPC_URL: "", ESCROW_ADDRESS: "", DEMO_MODE: "false",
};

async function starts(extra: Record<string, string> = {}) {
  const { app, db } = createRuntime({ ...base, ...extra });
  await app.close();
  await db.close();
}

test("the stack's mainnet defaults start: blank RPC and escrow, TOKEN_ADDRESS omitted", async () => {
  await starts({ CHAIN_ID: "8453" });
});

test("the stack's demo settings start: Base Sepolia, MockZARP, Gmail secret, demo mode", async () => {
  await starts({ CHAIN_ID: "84532", BASE_RPC_URL: "https://sepolia.base.org",
    ESCROW_ADDRESS: "0x1111111111111111111111111111111111111111",
    TOKEN_ADDRESS: "0x2222222222222222222222222222222222222222",
    SMTP_SECRET_ARN: "arn:aws:secretsmanager:af-south-1:123456789012:secret:patela-smtp", DEMO_MODE: "true" });
});

test("an empty TOKEN_ADDRESS, or Base Sepolia without one, stops startup (why the stack omits it)", () => {
  assert.throws(() => createRuntime({ ...base, CHAIN_ID: "8453", TOKEN_ADDRESS: "" }), /TOKEN_ADDRESS/);
  assert.throws(() => createRuntime({ ...base, CHAIN_ID: "84532" }), /TOKEN_ADDRESS/);
});

test("runtime accepts additional origins and an explicit cross-site cookie policy", async () => {
  await starts({ ALLOWED_ORIGINS: "https://demo.example.test, https://integration.example.test",
    COOKIE_DOMAIN: ".example.test", COOKIE_SAME_SITE: "None" });
});

test("runtime rejects unsafe or malformed browser authentication settings", () => {
  assert.throws(() => createRuntime({ ...base, ALLOWED_ORIGINS: "https://example.test/path" }),
    /ALLOWED_ORIGINS/);
  assert.throws(() => createRuntime({ ...base, COOKIE_DOMAIN: "https:\/\/example.test" }),
    /COOKIE_DOMAIN/);
  assert.throws(() => createRuntime({ ...base, COOKIE_SAME_SITE: "invalid" }), /COOKIE_SAME_SITE/);
  assert.throws(() => createRuntime({ ...base, API_ORIGIN: "http://localhost:4000", COOKIE_SAME_SITE: "None" }),
    /HTTPS API_ORIGIN/);
});

test("Given the Celo demo, When the stack starts on Celo Sepolia with test CZAR, Then it starts", async () => {
  await starts({ CHAIN_ID: "11142220", BASE_RPC_URL: "https://forno.celo-sepolia.celo-testnet.org",
    ESCROW_ADDRESS: "0x1111111111111111111111111111111111111111",
    TOKEN_ADDRESS: "0x2222222222222222222222222222222222222222", DEMO_MODE: "true" });
});

test("Given Celo Sepolia, When TOKEN_ADDRESS is missing, Then startup stops", () => {
  assert.throws(() => createRuntime({ ...base, CHAIN_ID: "11142220" }), /TOKEN_ADDRESS/);
});
