# 04 — Technology Stack & Migration Plan

**Document Version:** 1.0  
**Last Updated:** 2026-11-09  

---

## 1. Current Repository Stack vs. Target Testnet MVP Stack

| Layer | Current Repository State (Inspected `2026-11-09`) | Target Testnet MVP Stack | Status & Gap |
|---|---|---|---|
| **Frontend Framework** | Next.js `15.2.0` (App Router) + React `19.2.0` + TypeScript `5.8.3` in `src/`, plus standalone vanilla HTML/CSS/JS prototype in `html/` | Next.js `15.x` (App Router) + TypeScript `5.8.x` unifying the marketing site and the role-aware dashboards from `html/` | **Frontend Installed**; dashboard views in `html/` need porting into Next.js routes |
| **Styling** | Custom CSS (`src/styles/patela*.css`, `html/assets/css/*.css`) + Tailwind CSS `4.2.1` | Preserve custom Patela CSS design tokens + Tailwind CSS utilities | **Implemented** |
| **Backend API** | None (client-side `localStorage` only) | **NestJS + Fastify (`@nestjs/platform-fastify`) + TypeScript** modular monolith serving `/api/v1` | **Not Installed / Planned (`M01`)** |
| **Database** | None (`localStorage` keys `patela-demo-v1` and `patela_proto_state_v3`) | **PostgreSQL 16+** | **Not Installed / Planned (`M01`)** |
| **ORM & Migrations** | None | **Prisma ORM** (`prisma/schema.prisma` + `prisma migrate`) | **Not Installed / Planned (`M01`)** |
| **Authentication** | None | Server-managed HTTP-only session cookies + Argon2id password hashing + EIP-191/SIWE wallet signature verification | **Not Installed / Planned (`M01`)** |
| **Validation** | `zod` `^3.25.76` + `react-hook-form` `^7.71.2` installed in `package.json` | Shared **Zod** schemas (`packages/validation`) used by both Next.js frontend and NestJS backend | **Zod Installed**; shared package planned |
| **Background Jobs & Queues** | `setTimeout(..., 2800)` in browser | **Redis 7+ & BullMQ** (`apps/worker`) for AI deliverable reviews, Base Sepolia event indexing, and notifications | **Not Installed / Planned (`M04`, `M05`)** |
| **Smart Contracts** | None | **Solidity `0.8.24+`** (`PatelaEscrow.sol`, `PatelaTestUSD.sol`) with OpenZeppelin `5.x` (`SafeERC20`, `ReentrancyGuard`, `AccessControl`) | **Not Installed / Planned (`M04`)** |
| **Contract Tooling** | None | **Foundry** (`forge`, `cast`, `anvil`) for compilation, unit/fuzz/invariant testing, and deployment scripts | **Not Installed / Planned (`M04`)** |
| **Blockchain Network** | Hardcoded Ethereum Sepolia (`0xaa36a7` / `11155111`) in `src/lib/patela-store.ts` | **Base Sepolia Testnet** (`Chain ID: 84532` / hex `0x14a34`) | **Needs Migration (`M04`)** |
| **Payment Token** | Simulated multi-coin array (`USDC`, `USDT`, `DAI`, `PYUSD`, `EURC`) | **Single Dedicated Test ERC-20 Token** (`Patela Test USD` / `pUSD`, 6 decimals) deployed on Base Sepolia | **Planned (`M04`)** |
| **Wallet Integration** | Raw `window.ethereum.request` with fake `0xDEMO...` fallback | **`wagmi` + `viem` + `@tanstack/react-query`** configured for Base Sepolia (`84532`) | `@tanstack/react-query` installed; `wagmi` & `viem` planned (`M04`) |
| **File Storage** | None (reads `File.name` and `File.size` in memory only) | **Private S3-Compatible Object Storage** (MinIO locally / Cloudflare R2 or AWS S3 in cloud) with pre-signed URLs | **Not Installed / Planned (`M03`)** |
| **AI Review System** | 15-character note heuristic (`demoReview`) | Dedicated backend worker module (`apps/worker/src/ai-review`) with structured JSON schema validation and criteria versioning | **Not Installed / Planned (`M05`)** |
| **Testing** | Vitest `3.0.0` (1 file, 6 unit tests) | Vitest (unit/integration), Supertest (API), Playwright (E2E), Foundry `forge test` (unit/fuzz/invariant) | **Vitest Installed**; expansion planned |

---

## 2. Base Sepolia Network & Token Configuration (`Chain ID 84532`)

All blockchain interactions for the Testnet MVP target **Base Sepolia** exclusively:

| Parameter | Value |
|---|---|
| **Network Name** | Base Sepolia |
| **Chain ID (Decimal)** | `84532` |
| **Chain ID (Hex)** | `0x14a34` |
| **Native Gas Currency** | Sepolia ETH (`ETH`, 18 decimals) |
| **Default Public RPC** | `https://sepolia.base.org` (Alchemy/Infura/QuickNode RPC configured via env in backend/indexer) |
| **Block Explorer** | `https://sepolia.basescan.org` |
| **Test Payment Token** | `PatelaTestUSD` (`pUSD`, 6 decimals, standard ERC-20 deployed by Patela on Base Sepolia) |

> **Strict Representation Rule:** The self-deployed test ERC-20 token must be labeled `pUSD (Testnet)` or `Patela Test USD` in the UI and documentation. It must **never** be represented as official Circle `USDC`.

---

## 3. Incremental Migration Strategy (From Prototype to Testnet MVP)

Rather than discarding the working repository or performing a destructive rewrite, Patela will evolve incrementally across Milestones `00`–`08`:

1. **Preserve the Isolated `html/` Prototype Reference:**
   - Keep `html/` intact as the interactive UI/UX reference specification for all Client and Worker dashboard screens, full-screen detail views, and responsive collapsible sidebar behavior.
2. **Evolve the Repository into a Clean Workspace Structure (`M00`–`M01`):**
   - Introduce `apps/api` (NestJS + Fastify), `apps/worker` (BullMQ workers), `packages/shared-types`, `packages/validation` (Zod), `database/prisma`, and `contracts/` (Foundry) while keeping the existing Next.js application working cleanly.
3. **Replace Client-Side `localStorage` Domain by Domain (`M01`–`M05`):**
   - **M01:** Add PostgreSQL + Prisma + Session Auth (`/api/v1/auth/*`, `/api/v1/users/*`).
   - **M02:** Replace `localStorage` jobs in `/marketplace` and `/post-job` with `/api/v1/jobs` and `/api/v1/applications`.
   - **M03:** Port the dashboard & project workspaces from `html/` into authenticated Next.js routes backed by `/api/v1/projects`, `/api/v1/milestones`, and private S3 file uploads.
   - **M04:** Replace `connectWallet()` and `actions.fund()` in `src/lib/patela-store.ts` with `wagmi` + `viem` on Base Sepolia (`84532`), real `PatelaEscrow.sol` contract calls, and the BullMQ blockchain event indexer.
   - **M05:** Replace `demoReview()` with the asynchronous BullMQ AI Review Worker.
   - **M06–M07:** Add human dispute resolution (`resolveDispute`) and reconciled financial analytics.
4. **Cleanup & Deprecation:**
   - Prune unused `@radix-ui/*` wrappers (`ISS-005`) once the Next.js dashboard components are finalized, and retire `src/lib/patela-store.ts` once all views read from `/api/v1` (while keeping any remaining sandbox preview explicitly labeled `demo` per `AGENTS.md`).

