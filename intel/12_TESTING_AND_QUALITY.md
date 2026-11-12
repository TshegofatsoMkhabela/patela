# 12 — Testing Strategy & Quality Assurance Gates

**Document Version:** 1.0  
**Last Updated:** 2026-11-09  

---

## 1. Current Test Coverage Audit (Baseline `2026-11-09`)

- **Test Runner Installed:** Vitest (`vitest.config.ts`).
- **Existing Test Suite:** [`src/test/patela-rules.test.ts`](../src/test/patela-rules.test.ts) — 6 unit tests covering `validateJob` and `demoReview` in `src/lib/patela-store.ts`.
  - Command: `npm test` (`vitest run`) — **6/6 passing**.
- **Prototype Integrity Script:** Custom verification script checking all 7 JS files in `html/assets/js/*.js` (`node --check`), internal HTML links across all 12 screens in `html/*.html`, and financial arithmetic reconciliation.
- **Missing Coverage (To Be Built Across `M01`–`M08`):** Database/Prisma integration tests, NestJS API e2e tests, React component tests, Playwright end-to-end tests, and Foundry smart-contract unit/fuzz/invariant tests.

---

## 2. Target Testing Pyramid

| Test Layer | Tooling | Scope & Target Coverage |
|---|---|---|
| **1. Unit Tests** | Vitest | Shared Zod schemas (`packages/validation`), integer base-unit financial math helpers, state-machine transition guards, evidence extractors, and domain services ($\ge 85\%$ branch coverage on business logic). |
| **2. Database & Repository Tests** | Vitest + Testcontainers / Local Test DB | Prisma migrations, foreign key constraints, `CHECK` constraints on integer balances, `UNIQUE` constraints on `(chainId, txHash, logIndex)` and `(userId, idempotencyKey)`, and transactional outbox rollbacks. |
| **3. API Integration Tests** | Vitest + Supertest (`@nestjs/testing`) | Every `/api/v1/*` endpoint tested for: `200/201` happy path, `400` validation errors, `401` unauthenticated, `403` cross-tenant/role violation, and `409` idempotency replay. |
| **4. Smart-Contract Unit Tests** | Foundry (`forge test`) | Every function and revert branch in `PatelaEscrow.sol` and `PatelaTestUSD.sol` (`createProject`, `fundMilestone`, `approveMilestone`, `requestRevision`, `raiseDispute`, `resolveDispute`, `refundMilestone`, fee math, access control). |
| **5. Smart-Contract Fuzz Tests** | Foundry Stateless Fuzzing | Randomized `uint256` milestone arrays, fee basis points (`0`–`1000`), and split dispute awards (`1,000+` runs per fuzz test) verifying zero rounding leaks or overflows. |
| **6. Smart-Contract Invariant Tests** | Foundry Stateful Invariant Testing | Handler-driven random sequences of funding, approvals, revisions, disputes, and refunds (`10,000+` calls) proving Invariants `INV-01` through `INV-09` in [`09_BLOCKCHAIN_AND_ESCROW.md`](./09_BLOCKCHAIN_AND_ESCROW.md). |
| **7. End-to-End (E2E) & Accessibility Tests** | Playwright + `@axe-core/playwright` + Local Anvil Node | Full browser journey from registration → job post → proposal → agreement → Anvil/Base Sepolia escrow funding → file upload → AI review → approval & payout, plus mobile (`390px`) and desktop (`1440px`) responsive/accessibility checks. |

---

## 3. Mandatory Milestone Quality Gates

A milestone in [`intel/milestones/`](./milestones/README.md) **cannot** be marked `COMPLETED` until all of the following gates pass and their command outputs are recorded in the milestone's `Completion Evidence` section:

1. **Zero Type Errors:** `tsc --noEmit` passes across all workspace packages.
2. **Zero Lint Errors:** `npm run lint` passes with zero errors.
3. **100% Passing Automated Tests:** `npm test` (and `forge test` for contract milestones) passes with zero skipped or failing assertions.
4. **Production Build Verification:** `npm run build` succeeds cleanly.
5. **Security & Authority Verification:** Server-side permission checks and financial integer constraints are verified by negative test cases.
6. **Documentation Synchronization:** `02_FEATURES.md`, `15_IMPLEMENTATION_BACKLOG.md`, the relevant spec in `specifications/`, the milestone file in `milestones/`, and `history/UPDATES.md` are updated and accurate.

