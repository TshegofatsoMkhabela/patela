import { isAddress, zeroAddress, type Address } from "viem";
import { buildApp } from "./app.js";
import { GoogleOidcProvider, PostgresAuth } from "./auth.js";
import { BaseChainVerifier } from "./chain.js";
import { PgDatabase, type Database } from "./db.js";
import { GmailTransport, secretsManagerLoader } from "./gmail.js";
import { GoogleIntegrations } from "./integrations.js";
import { PgliteDatabase, isPgliteUrl } from "./pglite-db.js";
import { ZARP_BASE } from "./service.js";

/** Chains the API can verify: Base, Base Sepolia, and the local Hardhat node used by `npm run demo`. */
export const SUPPORTED_CHAIN_IDS = [8453, 84532, 31337] as const;
const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function createRuntime(env: NodeJS.ProcessEnv = process.env) {
  const {
    DATABASE_URL, GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET,
    BASE_RPC_URL, ESCROW_ADDRESS, PUBLIC_ORIGIN, ALLOWED_ORIGINS = "",
    API_ORIGIN = "http://localhost:4000", CHAIN_CONFIRMATIONS = "3",
    GOOGLE_MAPS_SERVER_KEY, CHAIN_ID = "8453", TOKEN_ADDRESS, TOKEN_DECIMALS = "18",
    PG_POOL_MAX = "2", ENABLE_AUTH_SMOKE_PAGE = "false", DATABASE_SSL = "false",
    SMTP_SECRET_ARN, DEMO_MODE = "false", DEMO_LOCAL = "false", COOKIE_DOMAIN, COOKIE_SAME_SITE = "Lax",
  } = env;
  if (!DATABASE_URL) throw new Error("DATABASE_URL is required");
  // Google sign-in is optional: without a client ID the email-code sign-in still works.
  if (!GOOGLE_OAUTH_CLIENT_ID && DEMO_MODE !== "true") throw new Error("GOOGLE_OAUTH_CLIENT_ID is required");
  if (ESCROW_ADDRESS && !isAddress(ESCROW_ADDRESS)) throw new Error("Invalid ESCROW_ADDRESS");
  const chainId = Number(CHAIN_ID);
  const confirmations = Number(CHAIN_CONFIRMATIONS);
  const tokenDecimals = Number(TOKEN_DECIMALS);
  const poolMax = Number(PG_POOL_MAX);
  if (!(SUPPORTED_CHAIN_IDS as readonly number[]).includes(chainId)) {
    throw new Error("CHAIN_ID must be Base (8453), Base Sepolia (84532) or a local Hardhat node (31337)");
  }
  if (!Number.isInteger(confirmations) || confirmations < 1 || confirmations > 64) throw new Error("Invalid CHAIN_CONFIRMATIONS");
  if (!Number.isInteger(tokenDecimals) || tokenDecimals < 0 || tokenDecimals > 36) throw new Error("Invalid TOKEN_DECIMALS");
  if (!Number.isInteger(poolMax) || poolMax < 1 || poolMax > 20) throw new Error("Invalid PG_POOL_MAX");
  if (chainId !== 8453 && !TOKEN_ADDRESS) throw new Error("TOKEN_ADDRESS is required on Base Sepolia and the local chain");
  const tokenAddress = TOKEN_ADDRESS ?? ZARP_BASE;
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
  const db: Database = isPgliteUrl(DATABASE_URL) ? new PgliteDatabase(DATABASE_URL)
    : new PgDatabase(DATABASE_URL, poolMax, DATABASE_SSL === "true");
  const auth = new PostgresAuth(db, new GoogleOidcProvider(GOOGLE_OAUTH_CLIENT_ID ?? "", GOOGLE_OAUTH_CLIENT_SECRET));
  const chain = BASE_RPC_URL && ESCROW_ADDRESS
    ? new BaseChainVerifier(BASE_RPC_URL, ESCROW_ADDRESS as Address, confirmations,
      chainId as (typeof SUPPORTED_CHAIN_IDS)[number], tokenAddress as Address)
    : undefined;
  // LOCAL DEMO shortcuts (codes and links shown in the app, onboarding auto-approved) need the
  // explicit DEMO_LOCAL flag that only scripts/demo.mjs sets, plus DEMO_MODE, no mail and a
  // loopback API origin. The flag matters: a deploy that omits API_ORIGIN defaults to localhost.
  const demoLocal = DEMO_LOCAL === "true" && DEMO_MODE === "true" && !SMTP_SECRET_ARN && LOOPBACK.has(new URL(API_ORIGIN).hostname);
  const app = buildApp({
    db, auth, chain, escrowAddress: (ESCROW_ADDRESS ?? zeroAddress) as Address,
    publicOrigin, apiOrigin: API_ORIGIN, allowedOrigins, cookieDomain: COOKIE_DOMAIN,
    cookieSameSite: COOKIE_SAME_SITE as "Lax" | "None" | "Strict",
    integrations: new GoogleIntegrations(GOOGLE_MAPS_SERVER_KEY),
    chainId, tokenAddress: tokenAddress as Address, tokenDecimals,
    googleClientId: GOOGLE_OAUTH_CLIENT_ID || undefined,
    enableGoogleCodeFlow: Boolean(GOOGLE_OAUTH_CLIENT_ID && GOOGLE_OAUTH_CLIENT_SECRET),
    enableAuthSmokePage: ENABLE_AUTH_SMOKE_PAGE === "true",
    mailTransport: SMTP_SECRET_ARN ? new GmailTransport(secretsManagerLoader(SMTP_SECRET_ARN)) : undefined,
    demoMode: DEMO_MODE === "true",
    demoLocal,
  });
  return { app, db };
}
