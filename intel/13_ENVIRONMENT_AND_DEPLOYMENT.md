# 13 — Environment Setup & Deployment Guide

**Document Version:** 1.0  
**Last Updated:** 2026-11-09  

---

## 1. Local Development Prerequisites

| Tool | Required Version | Purpose |
|---|---|---|
| **Node.js** | `>= 22.x LTS` | Next.js frontend, NestJS API, and BullMQ worker runtime |
| **npm** | `>= 10.x` | Package management & workspace scripts |
| **Docker & Docker Compose** | `>= 26.x` | Local PostgreSQL 16, Redis 7, and MinIO (S3-compatible object storage) |
| **Foundry (`forge`, `cast`, `anvil`)** | Latest stable | Solidity smart-contract compilation, fuzz/invariant testing, and Base Sepolia deployment |
| **Git** | `>= 2.40` | Version control |

---

## 2. Running the Existing Repository Today (`Milestone 00`)

1. **Next.js Application (`src/`):**
   ```bash
   npm install
   npm run dev        # Starts Next.js dev server at http://localhost:3000
   npm test           # Runs Vitest unit tests
   npm run build      # Verifies production Next.js build
   ```
2. **Standalone HTML Dashboard Prototype (`html/`):**
   - Open [`html/index.html`](../html/index.html) directly in a browser or serve via `npx serve html` to inspect all 12 role-aware Client and Worker screens, interactive SVG charts, full-screen detail workspaces, and collapsible sidebar.

---

## 3. Target Environment Variables Template (`.env.example`)

> **SECURITY RULE:** Never commit real secrets, private keys, seed phrases, or API keys to Git. Only commit `.env.example` with safe placeholder values.

```dotenv
# -----------------------------------------------------------------------------
# 1. APPLICATION & FRONTEND
# -----------------------------------------------------------------------------
NODE_ENV=development
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api/v1
API_PORT=4000

# -----------------------------------------------------------------------------
# 2. DATABASE & REDIS (PostgreSQL 16 + Redis 7)
# -----------------------------------------------------------------------------
DATABASE_URL="postgresql://patela:patela_dev_password@localhost:5432/patela_dev?schema=public"
REDIS_URL="redis://localhost:6379"

# -----------------------------------------------------------------------------
# 3. AUTHENTICATION & SECURITY
# -----------------------------------------------------------------------------
SESSION_SECRET="replace-with-at-least-32-bytes-of-cryptographic-random-hex"
CSRF_SECRET="replace-with-at-least-32-bytes-of-cryptographic-random-hex"
SESSION_COOKIE_NAME="patela_sid"

# -----------------------------------------------------------------------------
# 4. PRIVATE OBJECT STORAGE (S3 / MinIO / Cloudflare R2)
# -----------------------------------------------------------------------------
S3_ENDPOINT="http://localhost:9000"
S3_REGION="us-east-1"
S3_BUCKET_DELIVERABLES="patela-deliverables-private"
S3_ACCESS_KEY_ID="patela_minio_admin"
S3_SECRET_ACCESS_KEY="patela_minio_secret_key"
S3_SIGNED_URL_TTL_SECONDS=900

# -----------------------------------------------------------------------------
# 5. BLOCKCHAIN — BASE SEPOLIA TESTNET (Chain ID 84532)
# -----------------------------------------------------------------------------
NEXT_PUBLIC_CHAIN_ID=84532
BASE_SEPOLIA_RPC_URL="https://sepolia.base.org"
NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL="https://sepolia.base.org"
NEXT_PUBLIC_TEST_TOKEN_ADDRESS="0x0000000000000000000000000000000000000000"
NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS="0x0000000000000000000000000000000000000000"
INDEXER_CONFIRMATION_BLOCKS=2
INDEXER_POLL_INTERVAL_MS=4000

# Used ONLY by Foundry deployment script on Base Sepolia (never by the web app)
DEPLOYER_PRIVATE_KEY=""
BASESCAN_API_KEY=""

# -----------------------------------------------------------------------------
# 6. AI DELIVERABLE REVIEW WORKER
# -----------------------------------------------------------------------------
AI_PROVIDER="gemini"
AI_MODEL_NAME="gemini-2.5-flash"
AI_API_KEY=""
AI_MAX_INPUT_CHARS=64000
AI_REQUEST_TIMEOUT_MS=45000
```

---

## 4. Target Local Infrastructure (`docker-compose.yml` — Milestone 01+)

When Milestone 01 begins, local backing services will be provisioned via `infrastructure/docker-compose.yml`:
- **`postgres`**: `postgres:16-alpine` on port `5432` with persistent volume `patela_pgdata`.
- **`redis`**: `redis:7-alpine` on port `6379` with AOF persistence enabled for BullMQ queues.
- **`minio`**: `minio/minio:latest` on ports `9000` (S3 API) and `9001` (Console) configured with a private `patela-deliverables-private` bucket.

---

## 5. Base Sepolia Contract Deployment & Verification Procedure (`Milestone 04` & `08`)

1. **Compile & Run Contract Test Suite:**
   ```bash
   cd contracts
   forge build
   forge test -vvv
   ```
2. **Deploy `PatelaTestUSD` (`pUSD`) and `PatelaEscrow` to Base Sepolia (`84532`):**
   ```bash
   forge script script/DeployBaseSepolia.s.sol:DeployBaseSepolia \
     --rpc-url $BASE_SEPOLIA_RPC_URL \
     --chain-id 84532 \
     --broadcast \
     --verify \
     --etherscan-api-key $BASESCAN_API_KEY
   ```
3. **Record Deployed Addresses:**
   - Update `packages/contracts-client` and [`09_BLOCKCHAIN_AND_ESCROW.md`](./09_BLOCKCHAIN_AND_ESCROW.md) with the verified Base Sepolia contract addresses and deployment transaction hashes.

---

## 6. Logging, Monitoring & Backup Procedures

- **Structured Logging:** JSON logs (`pino` via `@nestjs/platform-fastify`) including `requestId`, `userId`, `projectId`, `txHash`, and duration; sensitive fields (`password`, `cookie`, `authorization`) automatically redacted.
- **Database Backups:** Automated daily `pg_dump` snapshots + point-in-time recovery (PITR) WAL archiving; tested via periodic restore drills into an isolated staging database.

