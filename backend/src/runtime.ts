import { isAddress, zeroAddress, type Address } from "viem";
import { buildApp } from "./app.js";
import { GoogleOidcProvider, PostgresAuth } from "./auth.js";
import { BaseChainVerifier } from "./chain.js";
import { PgDatabase } from "./db.js";
import { GoogleIntegrations } from "./integrations.js";
import { ZARP_BASE } from "./service.js";

export function createRuntime(env: NodeJS.ProcessEnv = process.env) {
  const {
    DATABASE_URL, GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET,
    BASE_RPC_URL, ESCROW_ADDRESS, PUBLIC_ORIGIN,
    API_ORIGIN = "http://localhost:4000", CHAIN_CONFIRMATIONS = "3",
    GOOGLE_MAPS_SERVER_KEY, CHAIN_ID = "8453", TOKEN_ADDRESS, TOKEN_DECIMALS = "18",
    PG_POOL_MAX = "2", ENABLE_AUTH_SMOKE_PAGE = "false", DATABASE_SSL = "false",
  } = env;
  if (!DATABASE_URL || !GOOGLE_OAUTH_CLIENT_ID) {
    throw new Error("DATABASE_URL and GOOGLE_OAUTH_CLIENT_ID are required");
  }
  if (ESCROW_ADDRESS && !isAddress(ESCROW_ADDRESS)) throw new Error("Invalid ESCROW_ADDRESS");
  const chainId = Number(CHAIN_ID);
  const confirmations = Number(CHAIN_CONFIRMATIONS);
  const tokenDecimals = Number(TOKEN_DECIMALS);
  const poolMax = Number(PG_POOL_MAX);
  if (chainId !== 8453 && chainId !== 84532) throw new Error("CHAIN_ID must be Base or Base Sepolia");
  if (!Number.isInteger(confirmations) || confirmations < 1 || confirmations > 64) throw new Error("Invalid CHAIN_CONFIRMATIONS");
  if (!Number.isInteger(tokenDecimals) || tokenDecimals < 0 || tokenDecimals > 36) throw new Error("Invalid TOKEN_DECIMALS");
  if (!Number.isInteger(poolMax) || poolMax < 1 || poolMax > 20) throw new Error("Invalid PG_POOL_MAX");
  if (chainId === 84532 && !TOKEN_ADDRESS) throw new Error("TOKEN_ADDRESS is required on Base Sepolia");
  const tokenAddress = TOKEN_ADDRESS ?? ZARP_BASE;
  if (!isAddress(tokenAddress)) throw new Error("Invalid TOKEN_ADDRESS");
  const publicOrigin = PUBLIC_ORIGIN || API_ORIGIN;
  for (const [label, origin] of [["PUBLIC_ORIGIN", publicOrigin], ["API_ORIGIN", API_ORIGIN]]) {
    const parsed = new URL(origin);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.pathname !== '/' || parsed.search || parsed.hash) {
      throw new Error(`${label} must be a web origin without a path`);
    }
  }
  const db = new PgDatabase(DATABASE_URL, poolMax, DATABASE_SSL === "true");
  const auth = new PostgresAuth(db, new GoogleOidcProvider(GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET));
  const chain = BASE_RPC_URL && ESCROW_ADDRESS
    ? new BaseChainVerifier(BASE_RPC_URL, ESCROW_ADDRESS as Address, confirmations, chainId)
    : undefined;
  const app = buildApp({
    db, auth, chain, escrowAddress: (ESCROW_ADDRESS ?? zeroAddress) as Address,
    publicOrigin, apiOrigin: API_ORIGIN,
    integrations: new GoogleIntegrations(GOOGLE_MAPS_SERVER_KEY),
    chainId, tokenAddress: tokenAddress as Address, tokenDecimals,
    googleClientId: GOOGLE_OAUTH_CLIENT_ID,
    enableGoogleCodeFlow: Boolean(GOOGLE_OAUTH_CLIENT_SECRET),
    enableAuthSmokePage: ENABLE_AUTH_SMOKE_PAGE === "true",
  });
  return { app, db };
}
