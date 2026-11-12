# Patela Technical Intelligence & Development Documentation System (`intel/`)

**Last Updated:** 2026-11-09  
**Current Active Milestone:** [Milestone 00 — Foundation & Codebase Audit](./milestones/MILESTONE_00_FOUNDATION.md) (`IN_PROGRESS`)  
**Next Planned Milestone:** [Milestone 01 — Authentication & Database](./milestones/MILESTONE_01_AUTH_AND_DATABASE.md) (`PLANNED`)  
**Target Release Objective:** Base Sepolia Testnet MVP (Chain ID `84532`)

---

## 1. Purpose of `intel/`

The `intel/` directory is the **central technical intelligence, architecture specification, audit ledger, and chronological development history** for the Patela platform.

It exists to ensure that every human engineer and AI coding agent working on Patela:
1. Understands the **exact current state** of the repository versus the **intended Testnet MVP target architecture**.
2. Never mistakes client-side prototype code (`src/lib/patela-store.ts` or `html/`) for production backend, database, AI, or smart-contract infrastructure.
3. Follows a strict, repeatable engineering workflow (**Read → Define → Implement → Verify → Document**).
4. Keeps specifications, feature statuses, milestone trackers, and historical changelogs synchronized with the actual codebase after every change.

---

## 2. Documentation Categories & Navigation Guide

| Category / File | Purpose & Contents |
|---|---|
| [`AUDIT_REPORT.md`](./AUDIT_REPORT.md) | Comprehensive baseline audit of the existing repository (`src/` Next.js app + `html/` standalone prototype) conducted on `2026-11-09`. |
| [`00_PROJECT_OVERVIEW.md`](./00_PROJECT_OVERVIEW.md) | Product vision, core problem statement, 14-step end-to-end workflow, MVP scope boundaries, and confirmed vs. pending product decisions. |
| [`01_PRODUCT_REQUIREMENTS.md`](./01_PRODUCT_REQUIREMENTS.md) | Functional (`FR-*`) and Non-Functional (`NFR-*`) requirements with acceptance criteria, priorities, and current statuses. |
| [`02_FEATURES.md`](./02_FEATURES.md) | Living feature inventory across all 20 product domains (`AUTH`, `USR`, `MKT`, `APP`, `HIR`, `PRJ`, `MLS`, `DLV`, `WAL`, `ESC`, `PAY`, `AIR`, `REV`, `DSP`, `MSG`, `NTF`, `ANA`, `ADM`, `SEC`, `INF`). |
| [`03_DESIGN_LANGUAGE.md`](./03_DESIGN_LANGUAGE.md) | Complete visual design system extracted from the existing Next.js app (`src/styles/*`) and HTML dashboard prototype (`html/assets/css/*`). |
| [`04_TECH_STACK.md`](./04_TECH_STACK.md) | Comparison of the **Actual Current Stack** vs. the **Target Testnet MVP Stack** (Next.js, NestJS + Fastify, PostgreSQL + Prisma, Redis + BullMQ, Solidity + Foundry on Base Sepolia `84532`, wagmi + viem, S3) and migration path. |
| [`05_SYSTEM_ARCHITECTURE.md`](./05_SYSTEM_ARCHITECTURE.md) | End-to-end system architecture, trust boundaries, authority rules (PostgreSQL vs. Base Sepolia), and 7 Mermaid lifecycle diagrams. |
| [`06_CODEBASE_STRUCTURE.md`](./06_CODEBASE_STRUCTURE.md) | Exact current repository tree (`src/`, `html/`, `public/`) and target monorepo structure (`apps/web`, `apps/api`, `apps/worker`, `packages/*`, `contracts/`, `database/`). |
| [`07_DATABASE_ARCHITECTURE.md`](./07_DATABASE_ARCHITECTURE.md) | Target PostgreSQL + Prisma schema covering 28 domain tables, integer base-unit financial precision rules, indexes, constraints, and ER diagram. |
| [`08_API_DOCUMENTATION.md`](./08_API_DOCUMENTATION.md) | Versioned `/api/v1` REST API conventions, authentication/RBAC headers, idempotency rules, and endpoint specifications (currently `PLANNED`). |
| [`09_BLOCKCHAIN_AND_ESCROW.md`](./09_BLOCKCHAIN_AND_ESCROW.md) | Base Sepolia (`84532`) smart-contract escrow architecture, conceptual Solidity interface, 9 mandatory security invariants, and reconciliation state machine. |
| [`10_AI_REVIEW_SYSTEM.md`](./10_AI_REVIEW_SYSTEM.md) | Deterministic + LLM advisory deliverable verification pipeline, structured output schema, prompt/criteria versioning, and safety guardrails. |
| [`11_SECURITY_AND_COMPLIANCE.md`](./11_SECURITY_AND_COMPLIANCE.md) | Application, wallet, file-storage, and smart-contract security controls, plus South African legal/regulatory research checklist (FSCA, CASP, FICA, POPIA, SARB). |
| [`12_TESTING_AND_QUALITY.md`](./12_TESTING_AND_QUALITY.md) | Existing Vitest unit test audit and target testing pyramid (Unit, Integration, E2E, Foundry Fuzz & Invariant tests) + Milestone Quality Gates. |
| [`13_ENVIRONMENT_AND_DEPLOYMENT.md`](./13_ENVIRONMENT_AND_DEPLOYMENT.md) | Local development setup, `.env.example` templates, Docker services (PostgreSQL, Redis, MinIO), Foundry deployment to Base Sepolia, and secret hygiene. |
| [`14_DEVELOPMENT_ROADMAP.md`](./14_DEVELOPMENT_ROADMAP.md) | Sequential overview of Milestones `00` through `08` from prototype to Base Sepolia Testnet MVP. |
| [`15_IMPLEMENTATION_BACKLOG.md`](./15_IMPLEMENTATION_BACKLOG.md) | Granular task backlog (`FND-*`, `DB-*`, `MKT-*`, `PRJ-*`, `ESC-*`, `AI-*`, `DSP-*`, `ANA-*`, `REL-*`) with dependencies, files, tests, and statuses. |
| [`16_KNOWN_ISSUES_AND_TECHNICAL_DEBT.md`](./16_KNOWN_ISSUES_AND_TECHNICAL_DEBT.md) | Active register of prototype limitations, architectural gaps, security risks, and technical debt items (`ISS-001` through `ISS-015`). |
| [`17_DEVELOPMENT_RULES.md`](./17_DEVELOPMENT_RULES.md) | **Mandatory operating manual** for all future AI agents and developers working on Patela. |
| [`milestones/`](./milestones/README.md) | Detailed tracking documents for `MILESTONE_00` through `MILESTONE_08`. |
| [`specifications/`](./specifications/README.md) | 14 domain-specific functional & technical specifications (`AUTHENTICATION_SPEC.md` through `ANALYTICS_SPEC.md`). |
| [`history/`](./history/README.md) | Chronological development log (`UPDATES.md`, `FEATURES_ADDED.md`, `FEATURES_MODIFIED.md`, `FEATURES_REMOVED.md`, `BUG_FIXES.md`, `ARCHITECTURE_DECISIONS.md`, `BREAKING_CHANGES.md`). |
| [`decisions/`](./decisions/README.md) | Architecture Decision Records (`ADR_TEMPLATE.md` and numbered ADRs). |

---

## 3. Which Documents Must Be Read Before Implementing Features

Before writing or modifying a single line of application or contract code, every engineer or AI agent **must** read:

1. **Always Mandatory:**
   - [`intel/README.md`](./README.md) (this file)
   - [`intel/17_DEVELOPMENT_RULES.md`](./17_DEVELOPMENT_RULES.md)
   - [`intel/00_PROJECT_OVERVIEW.md`](./00_PROJECT_OVERVIEW.md)
   - [`AGENTS.md`](../AGENTS.md) (root project rules)
2. **Task-Specific Mandatory Reading:**
   - The relevant domain specification in [`intel/specifications/`](./specifications/README.md)
   - The active milestone document in [`intel/milestones/`](./milestones/README.md)
   - The task definition in [`intel/15_IMPLEMENTATION_BACKLOG.md`](./15_IMPLEMENTATION_BACKLOG.md)
   - [`intel/05_SYSTEM_ARCHITECTURE.md`](./05_SYSTEM_ARCHITECTURE.md) and [`intel/06_CODEBASE_STRUCTURE.md`](./06_CODEBASE_STRUCTURE.md)
   - If touching database models: [`intel/07_DATABASE_ARCHITECTURE.md`](./07_DATABASE_ARCHITECTURE.md)
   - If touching APIs: [`intel/08_API_DOCUMENTATION.md`](./08_API_DOCUMENTATION.md)
   - If touching wallets or contracts: [`intel/09_BLOCKCHAIN_AND_ESCROW.md`](./09_BLOCKCHAIN_AND_ESCROW.md)
   - If touching AI evaluation: [`intel/10_AI_REVIEW_SYSTEM.md`](./10_AI_REVIEW_SYSTEM.md)
   - If touching UI components: [`intel/03_DESIGN_LANGUAGE.md`](./03_DESIGN_LANGUAGE.md)
   - Recent entries in [`intel/history/UPDATES.md`](./history/UPDATES.md)

---

## 4. How Milestone Documentation Works

- Development is divided into **9 sequential milestones** (`MILESTONE_00` to `MILESTONE_08`) documented in [`intel/milestones/`](./milestones/README.md).
- Each milestone uses one of the official statuses:
  - `NOT_STARTED` | `PLANNED` | `IN_PROGRESS` | `BLOCKED` | `IN_REVIEW` | `COMPLETED` | `DEFERRED`
- **Current Milestone Identification:** Check the header of this `intel/README.md` and [`intel/milestones/README.md`](./milestones/README.md). Currently, **Milestone 00 (`MILESTONE_00_FOUNDATION.md`)** is `IN_PROGRESS` (with the repository audit and `intel/` documentation system completed), and **Milestone 01 (`MILESTONE_01_AUTH_AND_DATABASE.md`)** is the next milestone to execute.
- A milestone cannot transition to `COMPLETED` until all tasks in its scope are implemented, tested, verified against acceptance criteria, and recorded in `Completion Evidence`.

---

## 5. How Implementation History Is Maintained

Every code change must be recorded in [`intel/history/`](./history/README.md) during **Step 5** of the development workflow:
- [`history/UPDATES.md`](./history/UPDATES.md): Central chronological log of every completed task (files created/modified/removed, DB/API/UI/architecture changes, tests run, verification results).
- [`history/FEATURES_ADDED.md`](./history/FEATURES_ADDED.md): Detailed record of newly implemented features.
- [`history/FEATURES_MODIFIED.md`](./history/FEATURES_MODIFIED.md): Before/after record of changed features.
- [`history/FEATURES_REMOVED.md`](./history/FEATURES_REMOVED.md): Permanent audit record of deprecated/removed features and what replaced them.
- [`history/BUG_FIXES.md`](./history/BUG_FIXES.md): Root cause, fix, and regression tests for resolved defects.
- [`history/ARCHITECTURE_DECISIONS.md`](./history/ARCHITECTURE_DECISIONS.md): Summary index of architectural decisions and links to ADRs in [`intel/decisions/`](./decisions/README.md).
- [`history/BREAKING_CHANGES.md`](./history/BREAKING_CHANGES.md): Record of any breaking API, schema, contract, or state-storage changes.

---

## 6. Quick Checklist for Updating Documentation After Any Change

1. Update feature status in [`02_FEATURES.md`](./02_FEATURES.md) and task status in [`15_IMPLEMENTATION_BACKLOG.md`](./15_IMPLEMENTATION_BACKLOG.md).
2. Update the domain specification in [`specifications/`](./specifications/README.md) if behavior, schema, or endpoints changed.
3. Update [`06_CODEBASE_STRUCTURE.md`](./06_CODEBASE_STRUCTURE.md), [`07_DATABASE_ARCHITECTURE.md`](./07_DATABASE_ARCHITECTURE.md), or [`08_API_DOCUMENTATION.md`](./08_API_DOCUMENTATION.md) if files, tables, or routes were added/changed.
4. Update the active milestone file in [`milestones/`](./milestones/README.md).
5. Append a complete entry to [`history/UPDATES.md`](./history/UPDATES.md) and the appropriate `FEATURES_*` or `BUG_FIXES.md` file.
6. Update [`16_KNOWN_ISSUES_AND_TECHNICAL_DEBT.md`](./16_KNOWN_ISSUES_AND_TECHNICAL_DEBT.md) if tech debt was introduced or resolved.

