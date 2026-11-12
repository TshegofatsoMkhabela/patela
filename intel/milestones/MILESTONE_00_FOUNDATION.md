# Milestone 00: Foundation and Codebase Audit

## Objective
Establish a stable engineering foundation, audit the existing Patela repository (`src/` and `html/`), separate prototype-only functionality from production requirements, define the target Base Sepolia Testnet MVP architecture, and stand up the complete `intel/` documentation system, shared validation packages, and local infrastructure configuration.

## Scope
- Audit existing Next.js (`src/`) and standalone HTML (`html/`) codebases.
- Create the complete `intel/` documentation system (`00`–`17`, `milestones/`, `specifications/`, `history/`, `decisions/`).
- Define coding standards, financial integer precision rules, and mandatory agent development rules.
- Prepare `.env.example`, local Docker Compose (`postgres`, `redis`, `minio`), and shared TypeScript/Zod packages (`packages/shared-types`, `packages/validation`).

## Dependencies
- None (Entry point milestone).

## Tasks
- [x] `FND-001`: Repository audit ([`AUDIT_REPORT.md`](../AUDIT_REPORT.md)).
- [x] `FND-002`: Current architecture documentation ([`03_DESIGN_LANGUAGE.md`](../03_DESIGN_LANGUAGE.md), [`06_CODEBASE_STRUCTURE.md`](../06_CODEBASE_STRUCTURE.md)).
- [x] `FND-003`: Target architecture definition ([`04_TECH_STACK.md`](../04_TECH_STACK.md), [`05_SYSTEM_ARCHITECTURE.md`](../05_SYSTEM_ARCHITECTURE.md), [`07`–`10`](../07_DATABASE_ARCHITECTURE.md)).
- [x] `FND-004`: Development conventions & mandatory workflow ([`17_DEVELOPMENT_RULES.md`](../17_DEVELOPMENT_RULES.md)).
- [ ] `FND-005`: Environment configuration (`.env.example`) and local Docker Compose (`infrastructure/docker-compose.yml`).
- [ ] `FND-006`: Testing infrastructure expansion for monorepo packages and API integration tests.
- [ ] `FND-007`: Shared packages (`packages/shared-types`, `packages/validation`) with exact `BigInt` base-unit helpers.
- [x] `FND-008`: Complete `intel/` documentation system.

## Technical Implementation
- Conducted full static and runtime inspection of `src/` (Next.js 15.2, React 19.2, Tailwind 4.2, Vitest 3.0) and `html/` (12-screen role-aware dashboard prototype).
- Created 50+ structured Markdown specifications, milestone trackers, ADRs, and changelogs inside `intel/`.

## Database Changes
- None applied yet. Target 28-entity PostgreSQL + Prisma architecture documented in [`07_DATABASE_ARCHITECTURE.md`](../07_DATABASE_ARCHITECTURE.md).

## API Changes
- None applied yet. Target `/api/v1` REST API specification documented in [`08_API_DOCUMENTATION.md`](../08_API_DOCUMENTATION.md).

## Frontend Changes
- None modified during the initial audit. Existing Next.js app (`src/`) and `html/` prototype preserved intact.

## Backend Changes
- None applied yet; modular monolith structure defined for `apps/api` and `apps/worker`.

## Blockchain Changes
- None applied yet; Base Sepolia (`84532`) escrow contract architecture and 9 invariants defined in [`09_BLOCKCHAIN_AND_ESCROW.md`](../09_BLOCKCHAIN_AND_ESCROW.md).

## Security Considerations
- Identified critical prototype discrepancies (`ISS-001` AI auto-release in demo store, `ISS-002` wrong Sepolia chain ID `0xaa36a7`, `ISS-004` floating-point currency math) and documented remediations in [`16_KNOWN_ISSUES_AND_TECHNICAL_DEBT.md`](../16_KNOWN_ISSUES_AND_TECHNICAL_DEBT.md).

## Testing Requirements
- Existing Vitest unit test suite (`npm test`) verified passing (`6/6` tests in `src/test/patela-rules.test.ts`).
- `FND-006` and `FND-007` will add unit tests for integer base-unit financial arithmetic and shared Zod schemas.

## Acceptance Criteria
1. Complete `intel/` documentation hierarchy exists with zero empty placeholder files.
2. Repository audit accurately distinguishes implemented marketing UI from prototype-only `localStorage` features.
3. `.env.example`, `infrastructure/docker-compose.yml`, `packages/shared-types`, and `packages/validation` are created and tested (`FND-005`–`FND-007`).

## Implementation History
- `2026-11-09`: Completed `FND-001`, `FND-002`, `FND-003`, `FND-004`, and `FND-008` (see [`history/UPDATES.md`](../history/UPDATES.md)).

## Known Issues
- See [`16_KNOWN_ISSUES_AND_TECHNICAL_DEBT.md`](../16_KNOWN_ISSUES_AND_TECHNICAL_DEBT.md) (`ISS-001` through `ISS-010`).

## Current Status
`IN_PROGRESS`

## Completion Evidence
- **Completed Tasks (`2026-11-09`):**
  - `npm test` executed: `1 passed (6 tests)` in `src/test/patela-rules.test.ts`.
  - All 55 files in `intel/` created and cross-referenced.
- **Remaining to Close Milestone 00:** Execute `FND-005`, `FND-006`, and `FND-007`.

