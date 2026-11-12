# Architecture Decisions Log

> **Classification:** Development History Ledger  
> **Last Updated:** 2026-11-09  

---

## Purpose

This file maintains a chronological summary of key architectural decisions made for the Patela platform and links to the full Architecture Decision Records (ADRs) in [`intel/decisions/`](../decisions/README.md).

---

## Chronological Decisions

### [2026-11-09] — `ADR-0001`: Target Base Sepolia Testnet MVP Architecture
- **ADR Document:** [ADR_0001_TARGET_TESTNET_MVP_ARCHITECTURE.md](../decisions/ADR_0001_TARGET_TESTNET_MVP_ARCHITECTURE.md)
- **Status:** `Accepted`
- **Summary:** Standardized Patela's target Testnet MVP stack and invariants:
  1. **Frontend:** Consolidate the `html/` 12-screen role-aware dashboard into the primary Next.js 15 App Router (`src/app/`) application using TypeScript, Tailwind CSS 4, TanStack Query v5, wagmi v2, and viem v2.
  2. **Backend & Persistence:** Modular NestJS 11 API (`apps/api`) + PostgreSQL 16 + Prisma 6 ORM (`packages/database`) + Redis 7 + BullMQ 5 (`ai-verification`, `chain-indexer`, `notifications` queues) + S3-compatible object storage.
  3. **Blockchain & Escrow:** Base Sepolia Testnet (`Chain ID: 84532`) with a custom `PatelaEscrow.sol` smart contract (Foundry + OpenZeppelin v5) supporting `USDC`, `USDT`, and `ETH`.
  4. **Advisory AI Boundary:** AI deliverable verification is asynchronous and strictly advisory; it never autonomously releases or refunds escrow funds.
  5. **Integer Financial Math:** All monetary values and token amounts are stored and calculated in integer base units (`BigInt`), replacing floating-point arithmetic.

