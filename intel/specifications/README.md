# Feature Technical Specifications Index (`intel/specifications/`)

> **Classification:** Feature Specification Directory Index  
> **Last Updated:** 2026-11-09  

---

## 1. Purpose

The `intel/specifications/` directory contains deep, domain-specific functional and technical specifications for each core subsystem of the Patela platform. Every specification clearly separates:
1. **Current Repository Status** (`src/` Next.js app vs. `html/` standalone prototype).
2. **Domain Model & State Machine** (states, valid transitions, and invariants).
3. **Database Entities & Fields** (referencing [../07_DATABASE_ARCHITECTURE.md](../07_DATABASE_ARCHITECTURE.md)).
4. **API Endpoints & Payloads** (referencing [../08_API_DOCUMENTATION.md](../08_API_DOCUMENTATION.md)).
5. **UI/UX Screens & Interactions** (referencing [../03_DESIGN_LANGUAGE.md](../03_DESIGN_LANGUAGE.md)).
6. **Security, Edge Cases & Acceptance Criteria**.

---

## 2. Specification Catalogue

| # | File | Subsystem | Current Status | Target Milestone |
|---|---|---|---|---|
| 1 | [AUTHENTICATION_SPEC.md](./AUTHENTICATION_SPEC.md) | Email/Password + SIWE (EIP-4361) Auth, Sessions & RBAC | `Missing` (Prototype role toggle only) | [MILESTONE_01](../milestones/MILESTONE_01_AUTH_AND_DATABASE.md) |
| 2 | [USER_AND_PROFILE_SPEC.md](./USER_AND_PROFILE_SPEC.md) | Client & Freelancer Profiles, Skills, Trust Score, Settings | `Prototype Only` (`html/settings.html`) | [MILESTONE_01](../milestones/MILESTONE_01_AUTH_AND_DATABASE.md) |
| 3 | [MARKETPLACE_SPEC.md](./MARKETPLACE_SPEC.md) | Job Creation, Search, Filtering, Budget & Milestone Templates | `Prototype Only` (`src/app/marketplace`, `html/jobs.html`) | [MILESTONE_02](../milestones/MILESTONE_02_MARKETPLACE.md) |
| 4 | [APPLICATIONS_SPEC.md](./APPLICATIONS_SPEC.md) | Freelancer Proposals, Proposed Milestones, Client Review & Acceptance | `Prototype Only` (`html/jobs.html` modal) | [MILESTONE_02](../milestones/MILESTONE_02_MARKETPLACE.md) |
| 5 | [PROJECTS_AND_MILESTONES_SPEC.md](./PROJECTS_AND_MILESTONES_SPEC.md) | Contract Generation, Milestone State Machine & Deliverable Checklists | `Prototype Only` (`src/app/jobs/[jobId]`, `html/projects.html`) | [MILESTONE_03](../milestones/MILESTONE_03_PROJECT_MANAGEMENT.md) |
| 6 | [SUBMISSIONS_SPEC.md](./SUBMISSIONS_SPEC.md) | Presigned S3 Evidence Uploads, Versioned Submissions & Checksum Hashing | `Prototype Only` (`html/submissions.html`) | [MILESTONE_03](../milestones/MILESTONE_03_PROJECT_MANAGEMENT.md) |
| 7 | [WALLET_SPEC.md](./WALLET_SPEC.md) | EIP-1193 Connection, Base Sepolia (`84532`) Switching & Token Balances | `Partial / Buggy` (`src/` uses `11155111`) | [MILESTONE_04](../milestones/MILESTONE_04_WALLET_AND_ESCROW.md) |
| 8 | [ESCROW_SPEC.md](./ESCROW_SPEC.md) | `PatelaEscrow.sol` Smart Contract, Deposit, Approval Release & Dispute Freeze | `Simulated` (`localStorage` math) | [MILESTONE_04](../milestones/MILESTONE_04_WALLET_AND_ESCROW.md) |
| 9 | [TRANSACTIONS_SPEC.md](./TRANSACTIONS_SPEC.md) | On-Chain Event Indexing, Transaction Ledger & CSV Export | `Prototype Only` (`html/wallet.html`) | [MILESTONE_04](../milestones/MILESTONE_04_WALLET_AND_ESCROW.md) |
| 10 | [AI_REVIEW_SPEC.md](./AI_REVIEW_SPEC.md) | Asynchronous BullMQ Verification Worker, Scoring Rubric & Advisory Boundary | `Simulated / Buggy` (`ISS-001` auto-approves) | [MILESTONE_05](../milestones/MILESTONE_05_AI_REVIEW.md) |
| 11 | [DISPUTES_SPEC.md](./DISPUTES_SPEC.md) | Dispute Opening, Escrow Freeze, Evidence Bundles & Admin Resolution | `Prototype Only` (`html/disputes.html`) | [MILESTONE_06](../milestones/MILESTONE_06_DISPUTE_RESOLUTION.md) |
| 12 | [MESSAGING_SPEC.md](./MESSAGING_SPEC.md) | Project-Scoped Threads, Real-Time Socket.IO Delivery & Attachments | `Prototype Only` (`html/messages.html`) | [MILESTONE_03](../milestones/MILESTONE_03_PROJECT_MANAGEMENT.md) |
| 13 | [NOTIFICATIONS_SPEC.md](./NOTIFICATIONS_SPEC.md) | In-App Notification Feed, Read State & Real-Time Push | `Prototype Only` (`html/notifications.html`) | [MILESTONE_07](../milestones/MILESTONE_07_ANALYTICS_AND_ADMIN.md) |
| 14 | [ANALYTICS_SPEC.md](./ANALYTICS_SPEC.md) | Client Spend/Escrow Metrics, Worker Earnings Velocity & Admin KPIs | `Prototype Only` (`html/analytics.html`) | [MILESTONE_07](../milestones/MILESTONE_07_ANALYTICS_AND_ADMIN.md) |

