import assert from "node:assert/strict";
import test from "node:test";
import type { Address, Hex } from "viem";
import { checkChainSetup, type ChainReader } from "../src/chain.js";
import { CELO_SEPOLIA_CHAIN_ID, ZARM_CELO_SEPOLIA } from "../src/service.js";

const escrow = "0x1111111111111111111111111111111111111111" as Address;
const expected = { chainId: CELO_SEPOLIA_CHAIN_ID, tokenAddress: ZARM_CELO_SEPOLIA, escrowAddress: escrow };

/** A chain that matches `expected` unless a field is overridden. */
function reader(over: Partial<{
  chainId: number; tokenCode: Hex | undefined; escrowCode: Hex | undefined;
  symbol: string; decimals: number; paymentToken: Address;
}> = {}): ChainReader {
  const chain = { chainId: CELO_SEPOLIA_CHAIN_ID, tokenCode: "0x60" as Hex, escrowCode: "0x60" as Hex,
    symbol: "ZARm", decimals: 18, paymentToken: ZARM_CELO_SEPOLIA, ...over };
  return {
    chainId: async () => chain.chainId,
    code: async address => address.toLowerCase() === escrow ? chain.escrowCode : chain.tokenCode,
    read: async (_address, name) => chain[name],
  };
}

const failed = async (r: ChainReader, setup: Parameters<typeof checkChainSetup>[1] = expected) =>
  (await checkChainSetup(r, setup)).filter(c => !c.ok).map(c => c.name);

test("a matching Celo Sepolia setup passes every check", async () => {
  const checks = await checkChainSetup(reader(), expected);
  assert.deepEqual(checks.map(c => c.name), ["chain", "token", "escrow"]);
  assert.ok(checks.every(c => c.ok), JSON.stringify(checks));
});

test("an RPC on another chain fails the chain check", async () => {
  assert.deepEqual(await failed(reader({ chainId: 8453 })), ["chain"]);
});

test("a token that is not 18-decimal ZARm fails the token check", async () => {
  assert.deepEqual(await failed(reader({ symbol: "cUSD" })), ["token"]);
  assert.deepEqual(await failed(reader({ decimals: 6 })), ["token"]);
  assert.deepEqual(await failed(reader({ tokenCode: undefined })), ["token"]);
});

test("a missing escrow, or one paying out another token, fails the escrow check", async () => {
  assert.deepEqual(await failed(reader({ escrowCode: undefined })), ["escrow"]);
  assert.deepEqual(await failed(reader({ paymentToken: "0x2222222222222222222222222222222222222222" })),
    ["escrow"]);
  assert.deepEqual(await failed(reader(), { ...expected, escrowAddress: undefined }), ["escrow"]);
});

test("a failing RPC call is reported on that check instead of throwing", async () => {
  const broken = { ...reader(), read: async () => { throw new Error("execution reverted"); } };
  const checks = await checkChainSetup(broken, expected);
  assert.deepEqual(checks.filter(c => !c.ok).map(c => c.name), ["token", "escrow"]);
  assert.match(checks[1].detail, /execution reverted/);
});
