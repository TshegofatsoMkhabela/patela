# Bug Fixes Ledger

> **Classification:** Development History Ledger  
> **Last Updated:** 2026-11-09  

---

## Purpose

This file records all resolved bugs, security vulnerabilities, and technical debt items (`ISS-*`), including root cause analysis, affected files, and regression tests added.

For currently open issues discovered during the repository baseline audit (`ISS-001` through `ISS-010`), see [../16_KNOWN_ISSUES_AND_TECHNICAL_DEBT.md](../16_KNOWN_ISSUES_AND_TECHNICAL_DEBT.md).

---

## Chronological Bug Fixes

### [2026-11-09] — Resolved `ISS-001` (Simulated AI Review Auto-Approving Milestones) & `ISS-002` (Wrong Testnet Chain ID)
- **Issues Resolved:**
  - `ISS-001` (**CRITICAL**): `actions.submit()` in `src/lib/patela-store.ts` previously set milestone status directly to `"approved"` when `demoReview()` passed, bypassing client approval. Updated `actions.submit()` to transition the milestone to `"submitted"` (Advisory AI Verified — Awaiting Client Approval) and added explicit `actions.approveMilestone(jobId, mId)` and `actions.requestChanges(jobId, mId, reason)` actions and UI buttons in `src/app/jobs/[jobId]/job-view.tsx`.
  - `ISS-002` (**HIGH**): `connectWallet()` in `src/lib/patela-store.ts` previously targeted Ethereum Sepolia (`0xaa36a7` / `11155111`). Updated `connectWallet()` to request/add **Base Sepolia** (`0x14a34` / `84532`, RPC `https://sepolia.base.org`, Explorer `https://sepolia.basescan.org`) and updated the UI labels in `src/components/SiteNav.tsx`.
- **Verification:** `npx tsc --noEmit` (0 errors) and `npm test` (6/6 unit tests passing).

