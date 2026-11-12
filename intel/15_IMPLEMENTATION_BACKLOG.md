# 15 — Implementation Backlog

**Document Version:** 1.0  
**Last Updated:** 2026-11-09  
**Rule:** Never mark a task `COMPLETED` until its code is implemented, verified by automated tests, and recorded in [`history/UPDATES.md`](./history/UPDATES.md).

---

## 1. Milestone 00 — Foundation (`FND-*`)

| Task ID | Title | Description & Technical Details | Dependencies | Affected Files / Modules | Acceptance Criteria & Testing | Priority | Status |
|---|---|---|---|---|---|---|---|
| `FND-001` | Repository Audit | Inspect complete existing repository (`src/`, `html/`, `package.json`, tests) and document implemented vs. prototype-only features. | None | `intel/AUDIT_REPORT.md` | Accurate baseline audit report created; `npm test` verified. | P0 | `COMPLETED` |
| `FND-002` | Current Architecture Documentation | Document actual codebase structure, design tokens, and client-side demo stores. | `FND-001` | `intel/03_DESIGN_LANGUAGE.md`, `intel/06_CODEBASE_STRUCTURE.md` | Complete documentation of `src/` and `html/`. | P0 | `COMPLETED` |
| `FND-003` | Target Architecture Definition | Define modular monolith API, BullMQ workers, PostgreSQL schema, Base Sepolia (`84532`) escrow contract, and AI review pipeline. | `FND-001` | `intel/04_TECH_STACK.md`, `intel/05_SYSTEM_ARCHITECTURE.md`, `intel/07`–`10` | Architecture diagrams, trust boundaries, and ADRs documented. | P0 | `COMPLETED` |
| `FND-004` | Development Conventions & Rules | Establish mandatory 6-step engineering workflow and coding standards. | `FND-003` | `intel/17_DEVELOPMENT_RULES.md` | Rules documented and cross-referenced in `intel/README.md`. | P0 | `COMPLETED` |
| `FND-005` | Environment Configuration & Local Infra | Create `.env.example` and `infrastructure/docker-compose.yml` for PostgreSQL 16, Redis 7, and MinIO. | `FND-003` | `.env.example`, `infrastructure/docker-compose.yml` | `docker compose config` validates cleanly; zero secrets committed. | P0 | `COMPLETED` |
| `FND-006` | Testing Infrastructure Expansion | Configure Vitest workspace for shared packages, API integration tests, and Playwright E2E harness. | `FND-005` | `vitest.config.ts`, `package.json` | Test runner executes unit and integration suites cleanly. | P0 | `PLANNED` |
| `FND-007` | Shared Packages & Validation Strategy | Initialize `packages/shared-types` and `packages/validation` (Zod schemas + integer base-unit money helpers). | `FND-004` | `packages/shared-types/*`, `packages/validation/*` | Unit tests verify exact base-unit conversion and job/milestone Zod validation. | P0 | `PLANNED` |
| `FND-008` | Intelligence Documentation System | Create complete `intel/` directory structure, milestones, specifications, backlog, and history logs. | `FND-001`–`FND-004` | `intel/**/*` | All required Markdown files populated and cross-referenced. | P0 | `COMPLETED` |

---

## 2. Milestone 01 — Authentication & Database (`DB-*`)

| Task ID | Title | Description & Technical Details | Dependencies | Affected Files / Modules | Acceptance Criteria & Testing | Priority | Status |
|---|---|---|---|---|---|---|---|
| `DB-001` | Database & NestJS API Bootstrap | Initialize `apps/api` (NestJS + Fastify) and connect Prisma to PostgreSQL. | `FND-005`, `FND-007` | `apps/api/src/main.ts`, `apps/api/src/common/prisma/*` | Health check `/api/v1/health` verifies PostgreSQL connectivity. | P0 | `PLANNED` |
| `DB-002` | Initial Prisma Schema | Author `database/prisma/schema.prisma` with core models and `BIGINT` financial fields. | `DB-001` | `database/prisma/schema.prisma` | `npx prisma validate` and `prisma generate` succeed. | P0 | `PLANNED` |
| `DB-003` | User & Profile Models | Implement `User` and `Profile` repositories with unique email and handle constraints. | `DB-002` | `apps/api/src/users/*` | Unit & DB tests verify user/profile creation and constraint enforcement. | P0 | `PLANNED` |
| `DB-004` | Authentication Sessions | Implement `AuthSession` store with HTTP-only cookie management, CSRF token binding, and session revocation. | `DB-003` | `apps/api/src/auth/session.service.ts` | Expired or revoked sessions return `401 Unauthorized`. | P0 | `PLANNED` |
| `DB-005` | User Registration | `POST /api/v1/auth/register` with Argon2id password hashing and Zod validation. | `DB-004` | `apps/api/src/auth/auth.controller.ts` | Integration test verifies registration, Argon2id hash, and duplicate email rejection (`409`). | P0 | `PLANNED` |
| `DB-006` | User Login | `POST /api/v1/auth/login` with constant-time password verification, rate limiting, and session rotation. | `DB-005` | `apps/api/src/auth/auth.service.ts` | Integration test verifies cookie issuance and invalid credential rejection (`401`). | P0 | `PLANNED` |
| `DB-007` | User Logout | `POST /api/v1/auth/logout` revoking DB session and clearing cookie. | `DB-006` | `apps/api/src/auth/auth.controller.ts` | Subsequent requests with old cookie fail with `401`. | P0 | `PLANNED` |
| `DB-008` | Email Verification | Issue and verify single-use hashed email verification tokens. | `DB-005` | `apps/api/src/auth/*` | Sets `emailVerifiedAt`; rejects expired/reused tokens. | P1 | `PLANNED` |
| `DB-009` | Password Reset Flow | Request and confirm password reset token; invalidate all prior sessions on password change. | `DB-006` | `apps/api/src/auth/*` | Integration test verifies password update and session revocation. | P1 | `PLANNED` |
| `DB-010` | User Profile Endpoints & UI | `GET/PATCH /api/v1/users/profile` + avatar upload URL + Next.js profile settings view. | `DB-006` | `apps/api/src/users/*`, `src/app/settings/*` | Profile edits persist to PostgreSQL and reflect in UI. | P0 | `PLANNED` |
| `DB-011` | Role & Permission System | Implement `SessionAuthGuard`, `RolesGuard` (`USER`, `ARBITRATOR`, `ADMIN`), and unified Client/Freelancer persona support. | `DB-004` | `apps/api/src/common/guards/*` | Guard unit/integration tests verify RBAC enforcement. | P0 | `PLANNED` |
| `DB-012` | Database Migrations & Seed Suite | Create initial SQL migrations, `CHECK` constraints, and deterministic seed script (`database/seeds`). | `DB-002`–`DB-011` | `database/migrations/*`, `database/seeds/*` | Clean DB migration + seed + integration test suite passes. | P0 | `PLANNED` |

---

## 3. Milestone 02 — Marketplace (`MKT-*`)

| Task ID | Title | Description & Technical Details | Dependencies | Affected Files / Modules | Acceptance Criteria & Testing | Priority | Status |
|---|---|---|---|---|---|---|---|
| `MKT-001` | Job, Skill & Deliverable Models | Implement Prisma models and repositories for `Job`, `JobSkill`, `Milestone`, and `Deliverable`. | `DB-012` | `database/prisma/schema.prisma`, `apps/api/src/jobs/*` | Enforces `sum(milestones.amountBaseUnits) == job.budgetBaseUnits`. | P0 | `PLANNED` |
| `MKT-002` | Job Creation API & Wizard | `POST /api/v1/jobs` + connect Next.js Post-Job wizard to backend API. | `MKT-001` | `apps/api/src/jobs/*`, `src/app/post-job/*` | Valid job persists in PostgreSQL; invalid milestone sum returns `400`. | P0 | `PLANNED` |
| `MKT-003` | Job Editing | `PATCH /api/v1/jobs/:jobId` allowing client to edit `DRAFT` or unhired `OPEN` jobs. | `MKT-002` | `apps/api/src/jobs/*` | Non-owners or hired jobs cannot be edited (`403` / `409`). | P1 | `PLANNED` |
| `MKT-004` | Job Publishing & Archiving | Transition jobs between `DRAFT`, `OPEN`, and `ARCHIVED`. | `MKT-002` | `apps/api/src/jobs/*` | State transitions logged in `ActivityLog`. | P0 | `PLANNED` |
| `MKT-005` | Job Discovery Listing | `GET /api/v1/jobs` with pagination and client trust summary. | `MKT-004` | `apps/api/src/jobs/*`, `src/app/marketplace/*` | Returns only `OPEN` jobs with deliverable and milestone counts. | P0 | `PLANNED` |
| `MKT-006` | Job Search, Filtering & Sorting | Filter by keyword, category, skill, budget range, and sort by recency/budget. | `MKT-005` | `apps/api/src/jobs/*`, `src/app/marketplace/*` | Indexed query tests verify accurate filtering and sorting. | P0 | `PLANNED` |
| `MKT-007` | Full-Screen Job Details View | Port `PatelaDetail.openJob` full-screen workspace into Next.js `/marketplace` and `/jobs/[jobId]`. | `MKT-005` | `src/app/jobs/[jobId]/*` | Full-screen job view displays brief, milestone schedule, deliverables, and client stats. | P0 | `PLANNED` |
| `MKT-008` | Freelancer Applications | `POST /api/v1/jobs/:jobId/applications` + proposal submission form in Job workspace. | `MKT-007` | `apps/api/src/applications/*` | Prevents duplicate applications (`409`) and self-application (`403`). | P0 | `PLANNED` |
| `MKT-009` | Client Application Management | Client view to inspect, shortlist, or reject freelancer proposals on their job. | `MKT-008` | `apps/api/src/applications/*` | Only `job.clientId` can list or update proposals. | P0 | `PLANNED` |
| `MKT-010` | Hiring Workflow | `POST /api/v1/applications/:id/accept` atomically transitioning job to `HIRED` and creating `Project` + `ProjectAgreement`. | `MKT-009` | `apps/api/src/applications/*`, `apps/api/src/projects/*` | Atomic transaction creates project, agreement snapshot, and milestones. | P0 | `PLANNED` |

---

## 4. Milestone 03 — Project Management (`PRJ-*`)

| Task ID | Title | Description & Technical Details | Dependencies | Affected Files / Modules | Acceptance Criteria & Testing | Priority | Status |
|---|---|---|---|---|---|---|---|
| `PRJ-001` | Project & Agreement Persistence | Implement `Project` and `ProjectAgreement` services with immutable scope/deliverable hash calculation. | `MKT-010` | `apps/api/src/projects/*` | Agreement snapshot cannot be mutated after acceptance. | P0 | `PLANNED` |
| `PRJ-002` | Agreement Acceptance & Amendment Rules | Record client and freelancer wallet bindings and sign-off timestamps on `ProjectAgreement`. | `PRJ-001` | `apps/api/src/projects/*` | Both parties must have verified wallets before escrow preparation. | P0 | `PLANNED` |
| `PRJ-003` | Role-Aware Project Workspace UI | Port `html/project-detail.html` and full-screen project workspace into Next.js authenticated routes. | `PRJ-001` | `src/app/projects/*` | Displays 7-stage lifecycle, escrow allocation bar, milestones, and role actions. | P0 | `PLANNED` |
| `PRJ-004` | Milestone State Machine Service | Enforce valid milestone state transitions and sequence rules in `MilestonesService`. | `PRJ-001` | `apps/api/src/milestones/*` | Invalid transitions throw `409 Conflict`; all transitions write `ActivityLog`. | P0 | `PLANNED` |
| `PRJ-005` | Milestone Management UI | Interactive milestone accordions + full-screen milestone workspace (`PatelaDetail.openMilestone`). | `PRJ-003`, `PRJ-004` | `src/app/projects/*` | Clicking any milestone opens its full-screen inspection workspace. | P0 | `PLANNED` |
| `PRJ-006` | Deliverable & Review Criterion Mapping | Generate versioned `ReviewCriterion` records from milestone deliverables upon agreement creation. | `PRJ-001` | `apps/api/src/milestones/*` | Every deliverable has a linked `ReviewCriterion` (version `1`). | P0 | `PLANNED` |
| `PRJ-007` | Deliverable Submission Workflow | `POST /api/v1/milestones/:id/submissions` creating versioned `Submission` (`v1`, `v2`) on funded milestones. | `PRJ-004`, `PRJ-008` | `apps/api/src/submissions/*`, `src/app/submissions/*` | Rejects submissions on `NOT_FUNDED` milestones; increments `versionNumber`. | P0 | `PLANNED` |
| `PRJ-008` | Private S3 Object Storage Integration | Pre-signed upload/download URLs, MIME/size validation ($\le 25\text{ MB}$), and SHA-256 checksum recording. | `FND-005` | `apps/api/src/submissions/storage.service.ts` | Unauthorized users cannot download files; signed URLs expire in 15m. | P0 | `PLANNED` |
| `PRJ-009` | Revision Request Workflow | `POST /api/v1/milestones/:id/request-revision` storing client feedback and moving milestone to `REVISION_REQUESTED`. | `PRJ-007` | `apps/api/src/milestones/*` | Escrow balance remains 100% locked; freelancer notified to upload `vN+1`. | P0 | `PLANNED` |
| `PRJ-010` | Project Activity, Messaging & Notifications | Implement `/api/v1/projects/:id/messages`, `/api/v1/notifications`, and `OutboxEvent` notification worker. | `PRJ-003` | `apps/api/src/messaging/*`, `apps/api/src/notifications/*` | Messages and lifecycle notifications persist and update unread badges. | P1 | `PLANNED` |

---

## 5. Milestone 04 — Wallet & Smart-Contract Escrow (`ESC-*`)

| Task ID | Title | Description & Technical Details | Dependencies | Affected Files / Modules | Acceptance Criteria & Testing | Priority | Status |
|---|---|---|---|---|---|---|---|
| `ESC-001` | `wagmi` + `viem` Wallet Connection | Install and configure `wagmi` + `viem` for Base Sepolia (`84532`), replacing raw `window.ethereum` in `src/lib/patela-store.ts`. | `FND-005` | `src/lib/wagmi.ts`, `src/components/SiteNav.tsx` | Connects wallet and prompts network switch to Chain ID `84532`. | P0 | `PLANNED` |
| `ESC-002` | Wallet Linking & Signature Verification | Implement `/api/v1/wallets/nonce` and `/api/v1/wallets/verify` using `viem` `verifyMessage`. | `ESC-001`, `DB-006` | `apps/api/src/wallets/*` | Verifies EIP-191 signature, binds wallet to `User`, rejects replayed nonces. | P0 | `PLANNED` |
| `ESC-003` | Base Sepolia RPC & Foundry Setup | Initialize `contracts/` Foundry workspace configured for Base Sepolia (`84532`). | `FND-005` | `contracts/foundry.toml` | `forge build` and local Anvil fork tests run cleanly. | P0 | `PLANNED` |
| `ESC-004` | Test ERC-20 Token (`PatelaTestUSD`) | Implement `PatelaTestUSD.sol` (`pUSD`, 6 decimals) with controlled testnet faucet minting. | `ESC-003` | `contracts/src/PatelaTestUSD.sol` | Foundry unit tests verify 6-decimal math and faucet limits. | P0 | `PLANNED` |
| `ESC-005` | Escrow Contract Specification | Finalize interface `IPatelaEscrow.sol`, custom errors, events, and state transitions. | `ESC-003` | `contracts/src/interfaces/IPatelaEscrow.sol`, `intel/specifications/ESCROW_SPEC.md` | All 9 security invariants mapped to explicit contract checks. | P0 | `PLANNED` |
| `ESC-006` | Escrow Contract Implementation | Implement `PatelaEscrow.sol` with `SafeERC20`, `ReentrancyGuard`, `AccessControl`, and `Pausable`. | `ESC-004`, `ESC-005` | `contracts/src/PatelaEscrow.sol` | Compiles with zero warnings; implements all lifecycle functions. | P0 | `PLANNED` |
| `ESC-007` | Smart-Contract Unit, Fuzz & Invariant Tests | Write comprehensive Foundry unit, stateless fuzz, and stateful invariant test suites (`INV-01`–`INV-09`). | `ESC-006` | `contracts/test/**/*` | 100% function coverage; 10,000+ invariant fuzz runs pass with zero violations. | P0 | `PLANNED` |
| `ESC-008` | On-Chain Project Escrow Creation | Wire `createProject` calldata preparation and frontend contract invocation. | `ESC-006`, `PRJ-002` | `apps/api/src/escrow/*`, `packages/contracts-client/*` | Registers project and milestone amounts on-chain. | P0 | `PLANNED` |
| `ESC-009` | Milestone Funding Flow | ERC-20 `approve` + `fundMilestone` signing flow in UI and transaction tracker registration. | `ESC-008` | `src/app/projects/*`, `apps/api/src/escrow/*` | Transfers `pUSD` from client wallet to `PatelaEscrow` contract. | P0 | `PLANNED` |
| `ESC-010` | Transaction Lifecycle Tracking | Implement `Transaction` table state machine (`SUBMITTED` → `PENDING` → `CONFIRMED` → `RECONCILED` / `REVERTED`). | `ESC-009` | `apps/api/src/transactions/*` | UI displays real-time transaction status; never fakes confirmation. | P0 | `PLANNED` |
| `ESC-011` | Blockchain Event Indexer Worker | BullMQ worker polling Base Sepolia logs, enforcing confirmation depth ($N=2$), and handling reorgs. | `ESC-010` | `apps/worker/src/blockchain-indexer/*` | Idempotently indexes events into `BlockchainEvent` and updates `Escrow`. | P0 | `PLANNED` |
| `ESC-012` | Client Milestone Approval | Frontend + contract invocation of `approveMilestone(projectId, milestoneIndex)`. | `ESC-011` | `src/app/projects/*` | Only `project.client` can approve; reverts if milestone is `Disputed`. | P0 | `PLANNED` |
| `ESC-013` | Payment Release & Fee Accounting | Index `MilestoneReleased`, update `EscrowMilestone`, and record `PlatformFeeRecord`. | `ESC-012` | `apps/worker/src/blockchain-indexer/*`, `apps/api/src/transactions/*` | Net payout and protocol fee match exact base-unit contract math. | P0 | `PLANNED` |
| `ESC-014` | Milestone Refund Workflow | Implement authorized `refundMilestone` execution and indexer reconciliation. | `ESC-011` | `contracts/src/PatelaEscrow.sol`, `apps/api/src/escrow/*` | Refunds exact remaining locked balance to client wallet. | P0 | `PLANNED` |
| `ESC-015` | Escrow Reconciliation & Solvency Service | Periodic reconciliation check comparing PostgreSQL `Escrow` balances against on-chain contract state. | `ESC-011`–`ESC-014` | `apps/worker/src/blockchain-indexer/reconcile.service.ts` | Detects and alerts on any discrepancy; integration tests pass. | P0 | `PLANNED` |

---

## 6. Milestone 05 — AI Review (`AI-*`)

| Task ID | Title | Description & Technical Details | Dependencies | Affected Files / Modules | Acceptance Criteria & Testing | Priority | Status |
|---|---|---|---|---|---|---|---|
| `AI-001` | Review Criteria & Output Schema Spec | Define Zod schemas for `ReviewCriterion` input and `AiReviewStructuredOutput`. | `PRJ-006` | `packages/validation/src/ai-review.schema.ts` | Schema rejects malformed LLM responses and enforces `PASS`/`FAIL`/`INCONCLUSIVE`. | P0 | `PLANNED` |
| `AI-002` | Submission Ingestion Trigger | Enqueue `ai-review` BullMQ job via `OutboxEvent` whenever a freelancer creates a `Submission`. | `PRJ-007` | `apps/api/src/submissions/*`, `apps/worker/src/ai-review/*` | Submission creation reliably triggers worker job. | P0 | `PLANNED` |
| `AI-003` | Safe Deliverable Evidence Extractor | Extract text, file trees, images, and public URL metadata from S3 submission files with size/timeout guards. | `AI-002`, `PRJ-008` | `apps/worker/src/ai-review/extractor.service.ts` | Marks unreachable/uninspectable artifacts explicitly; blocks zip bombs & SSRF. | P0 | `PLANNED` |
| `AI-004` | AI Review Worker & Provider Adapter | Implement `AiReviewProcessor` with versioned prompts and configurable LLM provider (`gemini` / `openai`). | `AI-001`, `AI-003` | `apps/worker/src/ai-review/ai-review.processor.ts` | Evaluates evidence and returns schema-validated structured JSON. | P0 | `PLANNED` |
| `AI-005` | Structured Review Persistence | Persist immutable `AiReview` record with model name, prompt version, confidence, and limitations. | `AI-004` | `apps/worker/src/ai-review/*` | Transitions milestone to `AWAITING_CLIENT_APPROVAL` with zero fund movement. | P0 | `PLANNED` |
| `AI-006` | Per-Requirement Evaluation Logic | Map each `Deliverable` / `ReviewCriterion` to its specific `PASS` / `FAIL` / `INCONCLUSIVE` result and suggested revision. | `AI-004` | `apps/worker/src/ai-review/*` | Uninspectable requirements always result in `INCONCLUSIVE`, never fake `PASS`. | P0 | `PLANNED` |
| `AI-007` | AI Review History & Version Comparison | API and UI to inspect AI review reports across submission versions (`v1`, `v2`, etc.). | `AI-005` | `apps/api/src/reviews/*`, `src/app/submissions/*` | Displays historical reports tied to exact submission and criteria versions. | P1 | `PLANNED` |
| `AI-008` | Retry, Timeout & Fallback Handling | Exponential backoff retries (`3` attempts) and graceful fallback to manual client review on LLM failure. | `AI-004` | `apps/worker/src/ai-review/*` | Failed AI job never blocks client from reviewing or approving milestone. | P0 | `PLANNED` |
| `AI-009` | Human Review Escalation | Allow client or freelancer to flag an inconclusive/disputed AI report for human review. | `AI-007` | `apps/api/src/reviews/*` | Records escalation flag and links to dispute workflow if raised. | P1 | `PLANNED` |
| `AI-010` | AI Review Auditability & Unit Tests | Comprehensive unit/integration tests with deterministic mock LLM fixtures verifying prompt injection defense and schema validation. | `AI-001`–`AI-009` | `apps/worker/src/ai-review/*.spec.ts` | All edge cases (empty files, corrupt archive, timeout, injection attempt) tested. | P0 | `PLANNED` |

---

## 7. Milestone 06 — Disputes (`DSP-*`)

| Task ID | Title | Description & Technical Details | Dependencies | Affected Files / Modules | Acceptance Criteria & Testing | Priority | Status |
|---|---|---|---|---|---|---|---|
| `DSP-001` | Dispute & Evidence Data Models | Implement `Dispute` and `DisputeEvidence` repositories and state machine. | `DB-012` | `apps/api/src/disputes/*` | Enforces award sum constraints and participant relationships. | P0 | `PLANNED` |
| `DSP-002` | On-Chain & API Dispute Creation | Wire `raiseDispute` contract call + `POST /api/v1/milestones/:id/disputes`. | `DSP-001`, `ESC-011` | `apps/api/src/disputes/*`, `src/app/projects/*` | Locks milestone on-chain (`Disputed`) and opens dispute record. | P0 | `PLANNED` |
| `DSP-003` | Dispute Evidence Submission | `POST /api/v1/disputes/:id/evidence` with private S3 file uploads and statements from client and freelancer. | `DSP-002`, `PRJ-008` | `apps/api/src/disputes/*` | Both parties can submit evidence; non-participants rejected (`403`). | P0 | `PLANNED` |
| `DSP-004` | Dispute Status Management | Manage transitions (`OPEN` → `EVIDENCE_COLLECTION` → `UNDER_REVIEW` → `RESOLVED_*`). | `DSP-002` | `apps/api/src/disputes/*` | All status changes emit notifications and `ActivityLog` entries. | P0 | `PLANNED` |
| `DSP-005` | Arbitrator Permissions & Review Console | Build dedicated Arbitrator workspace displaying agreement, all submission versions, AI reports, and both parties' evidence. | `DSP-003`, `DB-011` | `src/app/admin/disputes/*`, `apps/api/src/disputes/*` | Accessible only to `ARBITRATOR` / `ADMIN` roles. | P0 | `PLANNED` |
| `DSP-006` | Arbitrator Resolution Workflow | Arbitrator records decision (100% freelancer, 100% client, or custom split) and signs `resolveDispute` on Base Sepolia. | `DSP-005`, `ESC-006` | `apps/api/src/disputes/*`, `contracts/src/PatelaEscrow.sol` | Validates `freelancerAward + clientRefund == lockedMilestoneAmount`. | P0 | `PLANNED` |
| `DSP-007` | Post-Resolution Escrow Settlement | Index `DisputeResolved` event and reconcile final payout/refund transactions in PostgreSQL. | `DSP-006`, `ESC-011` | `apps/worker/src/blockchain-indexer/*` | Updates `Escrow`, `Milestone`, `Transaction`, and `Dispute` records atomically. | P0 | `PLANNED` |
| `DSP-008` | Dispute End-to-End & Security Tests | Integration and Foundry tests verifying locked funds cannot move during dispute except via `resolveDispute`. | `DSP-001`–`DSP-007` | `apps/api/test/disputes.e2e-spec.ts`, `contracts/test/*` | 100% of dispute resolution paths verified. | P0 | `PLANNED` |

---

## 8. Milestone 07 — Analytics & Administration (`ANA-*`)

| Task ID | Title | Description & Technical Details | Dependencies | Affected Files / Modules | Acceptance Criteria & Testing | Priority | Status |
|---|---|---|---|---|---|---|---|
| `ANA-001` | Reconciled Financial Aggregation Service | Compute client spending, freelancer earnings, and non-overlapping escrow custody breakdowns from reconciled DB records. | `ESC-013`, `DSP-007` | `apps/api/src/analytics/*` | Uses exact `BigInt` base-unit sums; zero double-counting. | P0 | `PLANNED` |
| `ANA-002` | Client Financial Dashboard & Analytics | Port `html/client-dashboard.html` and client views in `html/analytics.html` to Next.js backed by `/api/v1/analytics/client`. | `ANA-001` | `src/app/dashboard/client/*`, `src/app/analytics/*` | Interactive SVG line/bar/donut charts and full-screen metric drilldowns work with real data. | P0 | `PLANNED` |
| `ANA-003` | Freelancer Earnings Dashboard & Analytics | Port `html/worker-dashboard.html` and worker views in `html/analytics.html` to Next.js backed by `/api/v1/analytics/worker`. | `ANA-001` | `src/app/dashboard/worker/*`, `src/app/analytics/*` | Displays settled earnings, locked escrow, pending payouts, and delivery KPIs. | P0 | `PLANNED` |
| `ANA-004` | Escrow Custody & 7-Stage Flow Visualizations | Connect the 7-stage Escrow Lifecycle and non-overlapping stacked bars in `payments` and `project-detail` to live project data. | `ANA-001` | `src/app/payments/*`, `src/app/projects/*` | Only completed events show timestamps; future stages show as upcoming. | P0 | `PLANNED` |
| `ANA-005` | Transaction Ledger & Full-Screen Receipts | Connect `/payments` table and `PatelaDetail.openTransaction` full-screen receipt view to `/api/v1/transactions`. | `ESC-010`, `ANA-001` | `src/app/payments/*` | Filterable by type, status, asset, date; links to BaseScan Sepolia (`https://sepolia.basescan.org/tx/...`). | P0 | `PLANNED` |
| `ANA-006` | Administrative Oversight Dashboard | Build Admin console (`/admin`) showing platform KPIs, active projects, AI queue status, transaction health, and protocol fees. | `DB-011`, `ANA-001` | `src/app/admin/*`, `apps/api/src/admin/*` | Strictly protected by `ADMIN` role guard. | P1 | `PLANNED` |
| `ANA-007` | User, Job & Dispute Administration | Admin moderation actions (suspend abusive user, archive policy-violating job, assign arbitrator to dispute) with audit logging. | `ANA-006` | `apps/api/src/admin/*` | Every admin action writes an immutable `ActivityLog` entry. | P1 | `PLANNED` |
| `ANA-008` | Analytics Reconciliation & Accuracy Tests | Automated tests verifying that dashboard totals equal the exact sum of underlying `Escrow` and `Transaction` records. | `ANA-001`–`ANA-007` | `apps/api/src/analytics/*.spec.ts` | Zero discrepancy between ledger transactions and analytics charts. | P0 | `PLANNED` |

---

## 9. Milestone 08 — Testing, Security & Base Sepolia Release (`REL-*`)

| Task ID | Title | Description & Technical Details | Dependencies | Affected Files / Modules | Acceptance Criteria & Testing | Priority | Status |
|---|---|---|---|---|---|---|---|
| `REL-001` | End-to-End Playwright Test Suite | Automated browser E2E tests covering the full 14-step client-to-freelancer workflow and dispute flow. | `M01`–`M07` | `e2e/**/*` | Full E2E suite passes on desktop (`1440px`) and mobile (`390px`) viewports. | P0 | `PLANNED` |
| `REL-002` | Smart-Contract Security & Invariant Audit | Extended Foundry fuzz/invariant campaign (`50,000+` runs) + static analysis checklist (`Slither` / manual line-by-line review). | `ESC-007`, `DSP-008` | `contracts/**/*`, `intel/11_SECURITY_AND_COMPLIANCE.md` | Zero high/medium/low unresolved contract vulnerabilities. | P0 | `PLANNED` |
| `REL-003` | Base Sepolia Deployment & Verification | Deploy `PatelaTestUSD` (`pUSD`) and `PatelaEscrow` to Base Sepolia (`84532`) and verify source code on BaseScan Sepolia. | `REL-002` | `contracts/script/DeployBaseSepolia.s.sol`, `packages/contracts-client/*` | Contracts verified on BaseScan Sepolia; addresses recorded in `intel/09_BLOCKCHAIN_AND_ESCROW.md`. | P0 | `PLANNED` |
| `REL-004` | Test Token Faucet & User Onboarding | Provide an in-app Base Sepolia `pUSD` test token faucet and clear onboarding instructions for testnet evaluators. | `REL-003` | `src/app/payments/*`, `apps/api/src/escrow/*` | Test users can mint test `pUSD` on Base Sepolia with rate-limit protection. | P0 | `PLANNED` |
| `REL-005` | Failure, Reorg & Recovery Drills | Test RPC timeouts, reverted transactions, LLM provider outages, and database backup restoration. | `REL-001` | `apps/worker/*`, `apps/api/*` | System recovers gracefully without corrupting escrow state. | P0 | `PLANNED` |
| `REL-006` | Final Documentation & MVP Acceptance Sign-Off | Verify all `intel/` documents match the deployed Base Sepolia MVP and execute the final acceptance checklist. | `REL-001`–`REL-005` | `intel/**/*` | All Milestone `00`–`08` completion evidence recorded. | P0 | `PLANNED` |

