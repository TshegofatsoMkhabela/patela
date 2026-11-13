import { checkChainSetup, rpcChainReader } from "./chain.js";
import { chainConfig } from "./runtime.js";

// Read-only: confirms RPC_URL, CHAIN_ID, TOKEN_ADDRESS and ESCROW_ADDRESS agree on chain, using
// the same parsing as the API. Usage: npm run chain:check   (exits 1 on any failure)

const { rpcUrl, ...expected } = chainConfig();
if (!rpcUrl) throw new Error("RPC_URL is required");

const checks = await checkChainSetup(rpcChainReader(rpcUrl), expected);
for (const check of checks)
  console.log(`${check.ok ? "PASS" : "FAIL"}  ${check.name.padEnd(6)} ${check.detail}`);
process.exitCode = checks.every((check) => check.ok) ? 0 : 1;
