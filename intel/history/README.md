# Patela Development History & Change Ledger (`intel/history/`)

> **Classification:** Mandatory Development Ledger Index  
> **Last Updated:** 2026-11-09  

---

## 1. Purpose

The `intel/history/` directory is Patela's permanent, chronological record of every architectural decision, feature addition, modification, removal, bug fix, and breaking change across the repository.

Every task that modifies application code, database schemas, smart contracts, or specifications must update the relevant ledger files in this directory before completion, in accordance with [17_DEVELOPMENT_RULES.md](../17_DEVELOPMENT_RULES.md).

---

## 2. History Files Index

| File | Purpose | When to Update |
|---|---|---|
| [UPDATES.md](./UPDATES.md) | Master chronological changelog of all tasks, audits, and implementation milestones | Every completed task |
| [FEATURES_ADDED.md](./FEATURES_ADDED.md) | Record of newly implemented features and capabilities | Whenever a feature transitions to `Implemented` or a new capability is added |
| [FEATURES_MODIFIED.md](./FEATURES_MODIFIED.md) | Record of behavior changes, UI refactors, or workflow updates to existing features | Whenever an existing feature is altered |
| [FEATURES_REMOVED.md](./FEATURES_REMOVED.md) | Record of deprecated or deleted features, demo fallbacks, or legacy code | Whenever a feature or prototype simulation is removed |
| [BUG_FIXES.md](./BUG_FIXES.md) | Record of resolved defects, root causes, and regression tests added | Whenever a bug or known issue (`ISS-*`) is fixed |
| [ARCHITECTURE_DECISIONS.md](./ARCHITECTURE_DECISIONS.md) | Chronological log of architectural choices and references to formal ADRs in `../decisions/` | Whenever a stack, contract, schema, or system boundary decision is made |
| [BREAKING_CHANGES.md](./BREAKING_CHANGES.md) | Record of breaking changes to APIs, database migrations, environment variables, or smart contract ABIs | Whenever a change requires migration steps or breaks backward compatibility |

---

## 3. Required Entry Format

Every entry in [UPDATES.md](./UPDATES.md) must follow the standard template defined in [17_DEVELOPMENT_RULES.md](../17_DEVELOPMENT_RULES.md):

```markdown
## [YYYY-MM-DD] - Short Title of Change

### Summary
What changed and why.

### Type
Feature Added | Feature Modified | Feature Removed | Bug Fix | Refactor | Documentation | Security | Database | Smart Contract

### Related Milestone
Milestone number and name.

### Files Created
- path/to/file

### Files Modified
- path/to/file

### Files Removed
- path/to/file

### Database Impact
Describe schema or migration changes, or state "None".

### API Impact
Describe endpoint changes, or state "None".

### Smart Contract Impact
Describe contract changes, or state "None".

### UI/UX Impact
Describe interface changes, or state "None".

### Testing Performed
Describe tests run and results.

### Follow-Up Needed
List remaining work or state "None".
```

