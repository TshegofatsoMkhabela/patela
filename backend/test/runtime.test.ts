import assert from "node:assert/strict";
import test from "node:test";
import { createRuntime } from "../src/runtime.js";
import { ZARM_CELO, ZARM_CELO_SEPOLIA } from "../src/service.js";

// The environment infra/backend-lambda.yaml produces. pg.Pool connects lazily, so no database is needed.
const base = {
  DATABASE_URL: "postgres://patela:x@localhost:5432/patela", GOOGLE_OAUTH_CLIENT_ID: "client-id",
  PUBLIC_ORIGIN: "https://demo.example", API_ORIGIN: "https://api.example",
  PG_POOL_MAX: "2", CHAIN_CONFIRMATIONS: "3",
  RPC_URL: "", ESCROW_ADDRESS: "", DEMO_MODE: "false",
};

async function starts(extra: Record<string, string> = {}) {
  const { app, db } = createRuntime({ ...base, ...extra });
  await app.close();
  await db.close();
}

test("the stack's Celo mainnet defaults use the canonical ZARm token", async () => {
  assert.equal(ZARM_CELO, "0x4c35853A3B4e647fD266f4de678dCc8fEC410BF6");
  assert.equal(ZARM_CELO_SEPOLIA, "0x10CCfB235b0E1Ed394bACE4560C3ed016697687e");
  await starts({ CHAIN_ID: "42220" });
});

test("the stack's demo settings start on Celo Sepolia with explicit overrides", async () => {
  await starts({ CHAIN_ID: "11142220", RPC_URL: "https://forno.celo-sepolia.celo-testnet.org",
    ESCROW_ADDRESS: "0x1111111111111111111111111111111111111111",
    TOKEN_ADDRESS: "0x2222222222222222222222222222222222222222",
    SMTP_SECRET_ARN: "arn:aws:secretsmanager:af-south-1:123456789012:secret:patela-smtp", DEMO_MODE: "true" });
});

test("runtime rejects unsupported chains and malformed token overrides", () => {
  assert.throws(() => createRuntime({ ...base, CHAIN_ID: "8453" }), /Celo/);
  assert.throws(() => createRuntime({ ...base, CHAIN_ID: "42220", TOKEN_ADDRESS: "not-an-address" }),
    /TOKEN_ADDRESS/);
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
