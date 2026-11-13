import { isAddress, zeroAddress, type Address } from "viem";
import { buildApp } from "./app.js";
import { GoogleOidcProvider, PostgresAuth } from "./auth.js";
import { EvmChainVerifier } from "./chain.js";
import { PgDatabase } from "./db.js";
import { GmailTransport, secretsManagerLoader } from "./gmail.js";
import { GoogleIntegrations } from "./integrations.js";
import { CELO_CHAIN_ID, CELO_SEPOLIA_CHAIN_ID, ZARM_CELO, ZARM_CELO_SEPOLIA } from "./service.js";

export function createRuntime(env: NodeJS.ProcessEnv = process.env) {
  const {
    DATABASE_URL, GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET,
    RPC_URL, BASE_RPC_URL, ESCROW_ADDRESS, PUBLIC_ORIGIN, ALLOWED_ORIGINS = "",
    API_ORIGIN = "http://localhost:4000", CHAIN_CONFIRMATIONS = "3",
    GOOGLE_MAPS_SERVER_KEY, CHAIN_ID = String(CELO_SEPOLIA_CHAIN_ID), TOKEN_ADDRESS, TOKEN_DECIMALS = "18",
    PG_POOL_MAX = "2", ENABLE_AUTH_SMOKE_PAGE = "false", DATABASE_SSL = "false",
    SMTP_SECRET_ARN, DEMO_MODE = "false", COOKIE_DOMAIN, COOKIE_SAME_SITE = "Lax",
  } = env;
  if (!DATABASE_URL || !GOOGLE_OAUTH_CLIENT_ID) {
    throw new Error("DATABASE_URL and GOOGLE_OAUTH_CLIENT_ID are required");
  }
  if (ESCROW_ADDRESS && !isAddress(ESCROW_ADDRESS)) throw new Error("Invalid ESCROW_ADDRESS");
  const chainId = Number(CHAIN_ID);
  const confirmations = Number(CHAIN_CONFIRMATIONS);
  const tokenDecimals = Number(TOKEN_DECIMALS);
  const poolMax = Number(PG_POOL_MAX);
  if (chainId !== CELO_CHAIN_ID && chainId !== CELO_SEPOLIA_CHAIN_ID) {
    throw new Error("CHAIN_ID must be Celo or Celo Sepolia");
  }
  if (!Number.isInteger(confirmations) || confirmations < 1 || confirmations > 64) throw new Error("Invalid CHAIN_CONFIRMATIONS");
  if (!Number.isInteger(tokenDecimals) || tokenDecimals < 0 || tokenDecimals > 36) throw new Error("Invalid TOKEN_DECIMALS");
  if (!Number.isInteger(poolMax) || poolMax < 1 || poolMax > 20) throw new Error("Invalid PG_POOL_MAX");
  const tokenAddress = TOKEN_ADDRESS || (chainId === CELO_CHAIN_ID ? ZARM_CELO : ZARM_CELO_SEPOLIA);
  if (!isAddress(tokenAddress)) throw new Error("Invalid TOKEN_ADDRESS");
  const publicOrigin = PUBLIC_ORIGIN || API_ORIGIN;
  const allowedOrigins = ALLOWED_ORIGINS.split(",").map(origin => origin.trim()).filter(Boolean);
  for (const [label, origin] of [["PUBLIC_ORIGIN", publicOrigin], ["API_ORIGIN", API_ORIGIN],
    ...allowedOrigins.map(origin => ["ALLOWED_ORIGINS", origin])]) {
    const parsed = new URL(origin);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.pathname !== '/' || parsed.search || parsed.hash) {
      throw new Error(`${label} must be a web origin without a path`);
    }
  }
  if (!(["Lax", "None", "Strict"] as const).includes(COOKIE_SAME_SITE as "Lax" | "None" | "Strict")) {
    throw new Error("COOKIE_SAME_SITE must be Lax, None, or Strict");
  }
  if (COOKIE_SAME_SITE === "None" && new URL(API_ORIGIN).protocol !== "https:") {
    throw new Error("COOKIE_SAME_SITE=None requires an HTTPS API_ORIGIN");
  }
  if (COOKIE_DOMAIN && (!/^(?:\.?[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(COOKIE_DOMAIN)
    || COOKIE_DOMAIN.includes(":"))) throw new Error("Invalid COOKIE_DOMAIN");
  const db = new PgDatabase(DATABASE_URL, poolMax, DATABASE_SSL === "true");
  const auth = new PostgresAuth(db, new GoogleOidcProvider(GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET));
  const rpcUrl = RPC_URL || BASE_RPC_URL;
  // Both or neither: with neither the API serves sign-in and onboarding only; half a setup would
  // start fine and then fail every on-chain order step.
  if (Boolean(rpcUrl) !== Boolean(ESCROW_ADDRESS)) {
    throw new Error("Set both RPC_URL and ESCROW_ADDRESS to enable on-chain orders, or leave both blank");
  }
  const chain = rpcUrl && ESCROW_ADDRESS
    ? new EvmChainVerifier(rpcUrl, ESCROW_ADDRESS as Address, confirmations,
      chainId as 42220 | 11142220, tokenAddress as Address)
    : undefined;
  const app = buildApp({
    db, auth, chain, escrowAddress: (ESCROW_ADDRESS ?? zeroAddress) as Address,
    publicOrigin, apiOrigin: API_ORIGIN, allowedOrigins, cookieDomain: COOKIE_DOMAIN,
    cookieSameSite: COOKIE_SAME_SITE as "Lax" | "None" | "Strict",
    integrations: new GoogleIntegrations(GOOGLE_MAPS_SERVER_KEY),
    chainId, tokenAddress: tokenAddress as Address, tokenDecimals,
    googleClientId: GOOGLE_OAUTH_CLIENT_ID,
    enableGoogleCodeFlow: Boolean(GOOGLE_OAUTH_CLIENT_SECRET),
    enableAuthSmokePage: ENABLE_AUTH_SMOKE_PAGE === "true",
    mailTransport: SMTP_SECRET_ARN ? new GmailTransport(secretsManagerLoader(SMTP_SECRET_ARN)) : undefined,
    demoMode: DEMO_MODE === "true",
  });
  return { app, db };
}
