# Features Removed Ledger

> **Classification:** Development History Ledger  
> **Last Updated:** 2026-11-09  

---

## Purpose

This file records all deprecated or removed features, legacy prototype simulations, or retired endpoints/components, along with the reason for removal and migration path.

---

## Planned Removals / Deprecations (Tracked for Upcoming Milestones)

The following prototype-only behaviors in `src/lib/patela-store.ts` are scheduled for removal or replacement during Milestones 01–05 (see [../16_KNOWN_ISSUES_AND_TECHNICAL_DEBT.md](../16_KNOWN_ISSUES_AND_TECHNICAL_DEBT.md)):

1. **Auto-Approval on AI Verification Pass (`ISS-001`)**: `submitMilestone()` in `src/lib/patela-store.ts` currently sets milestone status directly to `"approved"` and releases funds when `demoReview()` passes. This will be removed in Milestone 05 so AI verification is strictly advisory (`SUBMITTED_FOR_REVIEW`).
2. **Ethereum Sepolia (`0xaa36a7`) Hardcoding (`ISS-002`)**: Will be replaced with Base Sepolia (`0x14a34` / `84532`) in Milestone 04.
3. **Simulated Demo Wallet Generator (`0x71C...89A`)**: Will be gated behind an explicit development flag or replaced by real EIP-1193 + SIWE authentication in Milestone 01 and Milestone 04.

---

## Chronological Feature Removals

*No features have been removed yet since the initialization of the `intel/` documentation system on 2026-11-09.*

