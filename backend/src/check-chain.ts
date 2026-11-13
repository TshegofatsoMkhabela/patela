import { isAddress, type Address } from "viem";
import { checkChainSetup, rpcChainReader } from "./chain.js";
import { CELO_CHAIN_ID, CELO_SEPOLIA_CHAIN_ID, ZARM_CELO, ZARM_CELO_SEPOLIA } from "./service.js";

// Read-only: confirms RPC_URL, CHAIN_ID, TOKEN_ADDRESS and ESCROW_ADDRESS agree on chain.
// Usage: npm run chain:check   (reads the same variables as the API; exits 1 on any failure)

const { RPC_URL, CHAIN_ID = String(CELO_SEPOLIA_CHAIN_ID), TOKEN_ADDRESS, ESCROW_ADDRESS } = process.env;
if (!RPC_URL) throw new Error("RPC_URL is required");
const chainId = Number(CHAIN_ID);
const tokenAddress = (TOKEN_ADDRESS || (chainId === CELO_CHAIN_ID ? ZARM_CELO : ZARM_CELO_SEPOLIA)) as Address;
if (ESCROW_ADDRESS && !isAddress(ESCROW_ADDRESS)) throw new Error("Invalid ESCROW_ADDRESS");

const checks = await checkChainSetup(rpcChainReader(RPC_URL), {
  chainId, tokenAddress, escrowAddress: ESCROW_ADDRESS as Address | undefined,
});
for (const check of checks) console.log(`${check.ok ? "PASS" : "FAIL"}  ${check.name.padEnd(6)} ${check.detail}`);
process.exitCode = checks.every(check => check.ok) ? 0 : 1;
