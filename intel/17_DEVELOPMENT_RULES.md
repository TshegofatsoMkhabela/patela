# 17 — Mandatory Development Rules & Agent Operating Manual

**Document Version:** 1.0  
**Last Updated:** 2026-11-09  
**Authority:** Mandatory for all human engineers and AI coding agents working on the Patela repository.

---

## 1. Core Operating Principle

`intel/` is the central technical knowledge base and development ledger for Patela.
**Code and documentation must evolve together in every single task.** A task is **never** complete until its implementation, automated tests, technical specification, feature status, milestone tracker, and chronological history in `intel/` are all verified and synchronized.

---

## 2. The Mandatory 6-Step Engineering Workflow

Every future task—whether adding a feature, modifying behavior, fixing a bug, or removing deprecated code—must follow these 6 steps in strict sequence:

### STEP 1: READ BEFORE CODING
Before writing or editing any code:
1. Read [`intel/README.md`](./README.md) and this file ([`intel/17_DEVELOPMENT_RULES.md`](./17_DEVELOPMENT_RULES.md)).
2. Read [`AGENTS.md`](../AGENTS.md) at the repository root.
3. Read [`intel/00_PROJECT_OVERVIEW.md`](./00_PROJECT_OVERVIEW.md).
4. Read the relevant domain specification in [`intel/specifications/`](./specifications/README.md).
5. Read the active milestone document in [`intel/milestones/`](./milestones/README.md) and task entry in [`intel/15_IMPLEMENTATION_BACKLOG.md`](./15_IMPLEMENTATION_BACKLOG.md).
6. Read [`intel/05_SYSTEM_ARCHITECTURE.md`](./05_SYSTEM_ARCHITECTURE.md) and [`intel/06_CODEBASE_STRUCTURE.md`](./06_CODEBASE_STRUCTURE.md).
7. Read recent entries in [`intel/history/UPDATES.md`](./history/UPDATES.md) and open issues in [`intel/16_KNOWN_ISSUES_AND_TECHNICAL_DEBT.md`](./16_KNOWN_ISSUES_AND_TECHNICAL_DEBT.md).
8. Inspect the actual source files that will be affected.

### STEP 2: DEFINE THE CHANGE
Before writing code, explicitly determine:
- Exact scope requested and why it is needed.
- Which existing features, modules, and files are affected.
- Whether database schema/migrations (`07_DATABASE_ARCHITECTURE.md`), API endpoints (`08_API_DOCUMENTATION.md`), smart contracts (`09_BLOCKCHAIN_AND_ESCROW.md`), or UI design tokens (`03_DESIGN_LANGUAGE.md`) are affected.
- Security, permission, financial-precision, and idempotency implications.
- Which automated tests must be added or updated.
- If a requirement is ambiguous or destructive, **ask the user for clarification before coding**.

### STEP 3: IMPLEMENT
- Follow the modular monolith architecture and existing Patela design language (deep navy `#050912`, champagne gold `#D9BD8B`, `Sora` / `Inter` / `JetBrains Mono`, generous spacing, progressive disclosure).
- Never use floating-point numbers (`number`) for backend/contract currency math—always use exact integer base units (`BigInt`).
- Never give AI review autonomous authority to release or refund escrow funds.
- Never represent simulated/demo actions or unconfirmed transaction hashes as confirmed on-chain settlements.
- Preserve unrelated working functionality and comments.

### STEP 4: VERIFY
Run and verify all applicable checks before claiming completion:
- Automated unit, integration, and contract tests (`npm test`, `forge test`).
- Linting and type-checking (`npm run lint`, `tsc --noEmit`).
- Production build verification (`npm run build`) where applicable.
- Responsive UI verification across desktop (`1440px`) and mobile (`390px`) viewports.
- If any verification step cannot be executed, explicitly document why.

### STEP 5: UPDATE THE DOCUMENTATION (`intel/`)
Every completed implementation **must** update:
1. **`intel/02_FEATURES.md`** and **`intel/15_IMPLEMENTATION_BACKLOG.md`** (update status only after verification).
2. **`intel/specifications/<DOMAIN>_SPEC.md`** (keep current intended behavior accurate).
3. **`intel/milestones/MILESTONE_0X_<NAME>.md`** (record tasks completed, tests run, and completion evidence).
4. **`intel/history/UPDATES.md`** (append a detailed entry using the mandatory template in Section 3 below).
5. **`intel/history/FEATURES_ADDED.md`**, **`FEATURES_MODIFIED.md`**, **`FEATURES_REMOVED.md`**, or **`BUG_FIXES.md`** as applicable.
6. **`intel/06_CODEBASE_STRUCTURE.md`**, **`07_DATABASE_ARCHITECTURE.md`**, or **`08_API_DOCUMENTATION.md`** if files, tables, or endpoints changed.
7. **`intel/16_KNOWN_ISSUES_AND_TECHNICAL_DEBT.md`** if issues were discovered or resolved.
8. **`intel/decisions/`** and **`intel/history/ARCHITECTURE_DECISIONS.md`** if an architectural decision was made or changed.

### STEP 6: FINAL IMPLEMENTATION REPORT
Provide a concise, structured report to the user listing:
1. What was implemented and how it works.
2. Files created, modified, and removed.
3. Database and API changes.
4. Tests performed and verification results.
5. Documentation files updated in `intel/`.
6. Known issues or limitations.
7. Recommended next implementation task.

---

## 3. Mandatory `intel/history/UPDATES.md` Entry Template

Every entry appended to [`intel/history/UPDATES.md`](./history/UPDATES.md) must follow this exact structure:

```markdown
## [YYYY-MM-DD] - [Implementation title]

### Summary
What was implemented or changed.

### Objective
Why the change was necessary.

### What was done
Detailed explanation of the implementation.

### Files created
- `path/to/file.ts`
  - Purpose and responsibilities.

### Files modified
- `path/to/file.ts`
  - What changed, why it changed, and system impact.

### Files removed
- `path/to/old-file.ts`
  - Why it was removed.

### Database changes
Schema, migrations, relationships, constraints, or data changes (or `None`).

### API changes
New, modified, or removed `/api/v1` endpoints (or `None`).

### UI changes
Affected screens, components, and user interactions (or `None`).

### Architecture changes
Changes to module responsibilities, dependencies, or system design (or `None`).

### Security considerations
Relevant security, RBAC, wallet, or smart-contract implications.

### Tests performed
Exact commands and test suites executed.

### Verification results
What passed, failed, or remains unverified.

### Known limitations
Incomplete work or outstanding concerns.

### Related tasks
Task IDs (`FND-*`, `DB-*`, etc.) and Milestone references.
```

