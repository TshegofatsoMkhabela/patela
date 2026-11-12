# ADR-0001: Target Base Sepolia Testnet MVP Architecture & Core Invariants

- **Status:** `Accepted`
- **Date:** 2026-11-09
- **Deciders:** Patela Lead Software Architect & Engineering Team
- **Related Milestones:** All (`MILESTONE_00` through `MILESTONE_08`)
- **Related Specifications:** [ESCROW_SPEC.md](../specifications/ESCROW_SPEC.md), [AI_REVIEW_SPEC.md](../specifications/AI_REVIEW_SPEC.md), [AUTHENTICATION_SPEC.md](../specifications/AUTHENTICATION_SPEC.md)

---

## 1. Context and Problem Statement

The baseline audit of the Patela repository ([../AUDIT_REPORT.md](../AUDIT_REPORT.md)) established that the codebase currently consists of two disconnected client-side implementations:
1. `src/`: A Next.js 15 marketing landing page and 3 client-side demo routes (`/marketplace`, `/post-job`, `/jobs/[jobId]`) backed by `localStorage` (`src/lib/patela-store.ts`).
2. `html/`: A 12-screen role-aware interactive HTML/CSS/JS dashboard prototype backed by `localStorage` (`html/assets/js/demo-data.js`).

Furthermore, `src/lib/patela-store.ts` contains three critical architectural defects:
- `ISS-001`: It automatically approves and releases milestone funds when its synchronous `demoReview()` function passes, removing client approval authority.
- `ISS-002`: It hardcodes Ethereum Sepolia (`0xaa36a7` / `11155111`) instead of Base Sepolia (`0x14a34` / `84532`).
- `ISS-004`: It stores and calculates token balances using JavaScript floating-point `number` values instead of integer base units (`BigInt`).

We need a single, authoritative target architecture to transition Patela from a browser-only prototype into a production-grade **Base Sepolia Testnet MVP**.

---

## 2. Considered Options

1. **Option A: Serverless Next.js API Routes + Third-Party Escrow Service + Auto-Releasing AI Oracle**
   - Fast initial setup, but couples long-running blockchain indexing and LLM verification to serverless timeouts and introduces catastrophic smart contract risk if an AI prompt injection triggers autonomous payout.
2. **Option B: Modular Monorepo (Next.js 15 Frontend + NestJS 11 Backend + PostgreSQL/Prisma + Redis/BullMQ + Custom `PatelaEscrow.sol` on Base Sepolia + Strictly Advisory AI Worker)**
   - Clean separation between the interactive web client, transactional API, asynchronous AI/indexer workers, and auditable Solidity escrow contract.

---

## 3. Decision Outcome

Chosen option: **Option B**.

### 3.1 Core Architectural Decisions & Non-Negotiable Invariants

1. **Single Primary Frontend (`Next.js 15 App Router`)**:
   - The `html/` prototype serves as the canonical UX/UI specification for the 12 dashboard screens, full-screen detail views, and collapsible navigation. All production features will be built in the Next.js TypeScript application using Tailwind CSS 4, TanStack Query v5, `wagmi v2`, and `viem v2`.
2. **Dedicated Backend & Relational Persistence (`NestJS 11` + `PostgreSQL 16` + `Prisma 6` + `Redis 7` / `BullMQ 5`)**:
   - All users, jobs, applications, projects, milestones, submissions, AI reports, disputes, and indexed blockchain transactions are persisted in PostgreSQL with strict state-machine validation and append-only `audit_logs`.
3. **Base Sepolia Testnet (`Chain ID: 84532`) & Custom `PatelaEscrow.sol`**:
   - All Web3 wallet interactions and escrow contracts target **Base Sepolia (`84532` / `0x14a34`)** supporting `USDC` (6 decimals), `USDT` (6 decimals), and native `ETH` (18 decimals).
4. **Advisory-Only AI Boundary (`ISS-001` Resolution)**:
   - AI deliverable verification runs asynchronously via BullMQ and produces structured confidence scores (`0–100`), requirement checks, and recommendations (`RECOMMEND_APPROVAL`, `NEEDS_CLIENT_INSPECTION`, `RECOMMEND_REVISION`).
   - **AI verification never alters escrow state or auto-approves a milestone.** Only the Client (via on-chain signature) or an Admin Arbitrator (during a formal dispute) can release escrow funds.
5. **Exact Integer Financial Math (`ISS-004` Resolution)**:
   - All monetary values in PostgreSQL (`DECIMAL(78,0)`), API DTOs (stringified integer base units), and frontend calculations (`BigInt` + `viem` `parseUnits`/`formatUnits`) use exact integer base units.

---

## 4. Consequences

### Positive
- Eliminates prompt-injection financial drain risk by keeping AI strictly advisory.
- Provides sub-second L2 transaction confirmations and negligible gas costs on Base Sepolia (`84532`).
- Ensures 100% reconciliation between on-chain `PatelaEscrow.sol` events and off-chain PostgreSQL milestone states via the `chain-indexer` BullMQ worker.

### Negative / Trade-offs
- Requires running PostgreSQL, Redis, and a NestJS service locally (mitigated via a single-command `docker-compose.yml` in `MILESTONE_00`).

