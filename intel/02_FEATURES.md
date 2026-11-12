# 02 — Complete Feature Inventory

**Document Version:** 1.0  
**Last Updated:** 2026-11-09  
**Source of Truth Rule:** This file tracks every current and planned feature across all 20 Patela domains. Prototype-only features are explicitly marked `Prototype-only` and must not be marked `Implemented` until backed by the real database, backend API, or Base Sepolia smart contract and verified with tests.

---

## Status Legend

- **`Implemented`**: Production-grade code active in the Next.js app (`src/`) and verified.
- **`Prototype-only`**: Working in client-side `localStorage` demo (`src/lib/patela-store.ts` or `html/`) without backend/contract persistence.
- **`In progress`**: Currently being built in the active milestone.
- **`Planned`**: Specified for the Base Sepolia Testnet MVP roadmap; not yet implemented.
- **`Deferred`**: Post-MVP scope; do not implement unless explicitly approved.
- **`Deprecated` / `Removed`**: Replaced or retired feature (preserved in [`history/FEATURES_REMOVED.md`](./history/FEATURES_REMOVED.md)).

---

## 1. Authentication & Accounts (`AUTH`)

| Feature ID | Feature | Description | User | Status | Milestone | Dependencies | Acceptance Criteria | Documentation |
|---|---|---|---|---|---|---|---|---|
| `FEAT-AUTH-01` | Email & Password Registration | Create account with email, password (Argon2id), and initial display name. | Client, Freelancer | `Planned` | `M01` | `DB-001`, `DB-003` | Validated signup creates `User` + `Profile` and issues session. | [`AUTHENTICATION_SPEC.md`](./specifications/AUTHENTICATION_SPEC.md) |
| `FEAT-AUTH-02` | Session Login & Logout | Server-managed HTTP-only cookie session login, rotation, and logout revocation. | All Users | `Planned` | `M01` | `FEAT-AUTH-01` | Valid credentials set `HttpOnly` cookie; logout invalidates DB session. | [`AUTHENTICATION_SPEC.md`](./specifications/AUTHENTICATION_SPEC.md) |
| `FEAT-AUTH-03` | Email Verification | Verification token sent on registration to confirm email ownership. | All Users | `Planned` | `M01` | `FEAT-AUTH-01` | Clicking token marks `emailVerifiedAt` timestamp. | [`AUTHENTICATION_SPEC.md`](./specifications/AUTHENTICATION_SPEC.md) |
| `FEAT-AUTH-04` | Password Reset Flow | Time-limited, single-use password reset token flow. | All Users | `Planned` | `M01` | `FEAT-AUTH-01` | Reset invalidates existing sessions and updates Argon2id hash. | [`AUTHENTICATION_SPEC.md`](./specifications/AUTHENTICATION_SPEC.md) |
| `FEAT-AUTH-05` | Unified Client/Worker Persona Switcher | Switch active workspace view between Client and Freelancer without separate accounts. | Client, Freelancer | `Prototype-only` | `M01` | `FEAT-AUTH-02` | Persists active persona; server enforces per-project participant role. | [`AUTHENTICATION_SPEC.md`](./specifications/AUTHENTICATION_SPEC.md) |

---

## 2. User Profiles (`USR`)

| Feature ID | Feature | Description | User | Status | Milestone | Dependencies | Acceptance Criteria | Documentation |
|---|---|---|---|---|---|---|---|---|
| `FEAT-USR-01` | User Profile Management | Edit display name, handle, bio, title, skills, hourly/project rate, and company details. | Client, Freelancer | `Prototype-only` | `M01` | `FEAT-AUTH-01` | Saved in `html/settings.html` (`localStorage`); target persists to PostgreSQL `Profile`. | [`USER_AND_PROFILE_SPEC.md`](./specifications/USER_AND_PROFILE_SPEC.md) |
| `FEAT-USR-02` | Profile Avatar Upload | Upload and display user avatar image via object storage. | Client, Freelancer | `Planned` | `M01` | `FEAT-USR-01` | Validates image MIME/size and updates profile avatar URL. | [`USER_AND_PROFILE_SPEC.md`](./specifications/USER_AND_PROFILE_SPEC.md) |
| `FEAT-USR-03` | Counterparty Trust Summary | Display verified wallet status, completed project count, and total settled volume on job/proposal views. | Client, Freelancer | `Prototype-only` | `M02` | `FEAT-USR-01` | Calculated from reconciled project/escrow records. | [`USER_AND_PROFILE_SPEC.md`](./specifications/USER_AND_PROFILE_SPEC.md) |

---

## 3. Marketplace (`MKT`)

| Feature ID | Feature | Description | User | Status | Milestone | Dependencies | Acceptance Criteria | Documentation |
|---|---|---|---|---|---|---|---|---|
| `FEAT-MKT-01` | Marketing Landing & Informational Pages | Hero landing page (`/`) and 10 informational pages (`/how-it-works`, `/for-clients`, `/for-workers`, `/security`, `/faq`, `/about`, `/careers`, `/contact`, `/terms`, `/privacy`). | Visitor, Client, Freelancer | `Implemented` | `M00` | Next.js App Router | All routes render with responsive nav and Solutions dropdown. | [`03_DESIGN_LANGUAGE.md`](./03_DESIGN_LANGUAGE.md) |
| `FEAT-MKT-02` | Multi-Step Job Creation & Validation | Create job with title, category, scope, skills, deliverables, milestone schedule, and budget equality validation. | Client | `Prototype-only` | `M02` | `FEAT-AUTH-02` | Exists in `src/app/post-job` and `html/post-job.html` (`localStorage`); target saves to PostgreSQL. | [`MARKETPLACE_SPEC.md`](./specifications/MARKETPLACE_SPEC.md) |
| `FEAT-MKT-03` | Job Editing, Publishing & Archiving | Save job drafts, edit unpublished jobs, publish to marketplace, or archive cancelled jobs. | Client | `Planned` | `M02` | `FEAT-MKT-02` | Enforces job state machine (`DRAFT → OPEN → HIRED / ARCHIVED`). | [`MARKETPLACE_SPEC.md`](./specifications/MARKETPLACE_SPEC.md) |
| `FEAT-MKT-04` | Marketplace Discovery, Search & Filtering | Browse open jobs with keyword search, category/skill filters, and budget/recency sorting. | Freelancer | `Prototype-only` | `M02` | `FEAT-MKT-03` | Working in `html/marketplace.html` and `src/app/marketplace`; target uses indexed DB queries. | [`MARKETPLACE_SPEC.md`](./specifications/MARKETPLACE_SPEC.md) |
| `FEAT-MKT-05` | Full-Screen Job Opportunity Workspace | Immersive full-screen detail view showing full brief, milestone breakdown, deliverables, client trust profile, and proposal form. | Freelancer, Client | `Prototype-only` | `M02` | `FEAT-MKT-04` | Working in `html/assets/js/interactions.js` (`PatelaDetail.openJob`); target ported to Next.js. | [`MARKETPLACE_SPEC.md`](./specifications/MARKETPLACE_SPEC.md) |

---

## 4. Job Applications (`APP`)

| Feature ID | Feature | Description | User | Status | Milestone | Dependencies | Acceptance Criteria | Documentation |
|---|---|---|---|---|---|---|---|---|
| `FEAT-APP-01` | Freelancer Proposal Submission | Submit a proposal with cover pitch, bid amount, delivery timeline, and portfolio links. | Freelancer | `Prototype-only` | `M02` | `FEAT-MKT-04` | Working in `html/` demo store; target persists `Application` in PostgreSQL with unique `(jobId, freelancerId)`. | [`APPLICATIONS_SPEC.md`](./specifications/APPLICATIONS_SPEC.md) |
| `FEAT-APP-02` | Application Withdrawal & Status Tracking | Freelancer views submitted proposals and can withdraw a pending proposal before hiring. | Freelancer | `Planned` | `M02` | `FEAT-APP-01` | Transitions application to `WITHDRAWN`. | [`APPLICATIONS_SPEC.md`](./specifications/APPLICATIONS_SPEC.md) |
| `FEAT-APP-03` | Client Proposal Review & Shortlisting | Client reviews incoming freelancer proposals on their job and shortlists or rejects candidates. | Client | `Planned` | `M02` | `FEAT-APP-01` | Only job owner can view and update application statuses. | [`APPLICATIONS_SPEC.md`](./specifications/APPLICATIONS_SPEC.md) |

---

## 5. Hiring (`HIR`)

| Feature ID | Feature | Description | User | Status | Milestone | Dependencies | Acceptance Criteria | Documentation |
|---|---|---|---|---|---|---|---|---|
| `FEAT-HIR-01` | Application Acceptance & Project Instantiation | Client accepts a freelancer's proposal, atomically creating the `ProjectAgreement`, `Project`, and `Milestone` records. | Client | `Planned` | `M02`, `M03` | `FEAT-APP-03` | Accepting one application marks job `HIRED`, rejects remaining open applications, and creates project workspace. | [`APPLICATIONS_SPEC.md`](./specifications/APPLICATIONS_SPEC.md) |

---

## 6. Projects (`PRJ`)

| Feature ID | Feature | Description | User | Status | Milestone | Dependencies | Acceptance Criteria | Documentation |
|---|---|---|---|---|---|---|---|---|
| `FEAT-PRJ-01` | Immutable Project Agreement Snapshot | Lock agreed scope, deliverable criteria, milestone amounts, and wallet addresses upon agreement acceptance. | Client, Freelancer | `Planned` | `M03` | `FEAT-HIR-01` | Agreement terms cannot be unilaterally edited after sign-off. | [`PROJECTS_AND_MILESTONES_SPEC.md`](./specifications/PROJECTS_AND_MILESTONES_SPEC.md) |
| `FEAT-PRJ-02` | Role-Aware Project Workspace & Full-Screen View | Dedicated project workspace displaying 7-stage lifecycle, escrow allocation bar, milestone accordions, AI report, and timeline. | Client, Freelancer | `Prototype-only` | `M03` | `FEAT-PRJ-01` | Implemented in `html/project-detail.html` and `PatelaDetail.openProject`; target connected to API. | [`PROJECTS_AND_MILESTONES_SPEC.md`](./specifications/PROJECTS_AND_MILESTONES_SPEC.md) |
| `FEAT-PRJ-03` | Project Activity Audit Timeline | Chronological log of all project, milestone, submission, AI review, and escrow events. | Client, Freelancer | `Prototype-only` | `M03` | `FEAT-PRJ-02` | Backed by `ActivityLog` table in PostgreSQL. | [`PROJECTS_AND_MILESTONES_SPEC.md`](./specifications/PROJECTS_AND_MILESTONES_SPEC.md) |

---

## 7. Milestones (`MLS`)

| Feature ID | Feature | Description | User | Status | Milestone | Dependencies | Acceptance Criteria | Documentation |
|---|---|---|---|---|---|---|---|---|
| `FEAT-MLS-01` | Milestone State Machine & Sequencing | Track each milestone through `NOT_FUNDED`, `FUNDED`, `IN_PROGRESS`, `SUBMITTED`, `UNDER_AI_REVIEW`, `AWAITING_CLIENT_APPROVAL`, `REVISION_REQUESTED`, `DISPUTED`, `RELEASED`, `REFUNDED`. | Client, Freelancer | `Prototype-only` | `M03` | `FEAT-PRJ-01` | Invalid state transitions are rejected by backend service and smart contract. | [`PROJECTS_AND_MILESTONES_SPEC.md`](./specifications/PROJECTS_AND_MILESTONES_SPEC.md) |
| `FEAT-MLS-02` | Full-Screen Milestone & Submission Workspace | Dedicated full-screen workspace (`PatelaDetail.openMilestone`) for inspecting a single milestone's deliverables, AI checks, and actions. | Client, Freelancer | `Prototype-only` | `M03` | `FEAT-MLS-01` | Implemented in `html/assets/js/interactions.js`; target ported to Next.js. | [`PROJECTS_AND_MILESTONES_SPEC.md`](./specifications/PROJECTS_AND_MILESTONES_SPEC.md) |

---

## 8. Deliverables (`DLV`)

| Feature ID | Feature | Description | User | Status | Milestone | Dependencies | Acceptance Criteria | Documentation |
|---|---|---|---|---|---|---|---|---|
| `FEAT-DLV-01` | Structured Deliverable Acceptance Criteria | Define measurable deliverables per milestone (title, acceptance criteria, expected evidence type). | Client | `Prototype-only` | `M02`, `M03` | `FEAT-MKT-02` | Stored as structured `ReviewCriterion` / `Deliverable` records used by AI review worker. | [`SUBMISSIONS_SPEC.md`](./specifications/SUBMISSIONS_SPEC.md) |
| `FEAT-DLV-02` | Private Object Storage Deliverable Upload | Upload deliverable files to private S3-compatible bucket with SHA-256 hash, MIME validation, and signed download URLs. | Freelancer | `Planned` | `M03` | `FEAT-MLS-01` | Unauthorized users cannot access file URLs; checksums recorded in `SubmissionFile`. | [`SUBMISSIONS_SPEC.md`](./specifications/SUBMISSIONS_SPEC.md) |
| `FEAT-DLV-03` | Versioned Submission History | Track multiple submission versions (`v1`, `v2`, etc.) per milestone with delivery notes and links. | Freelancer, Client | `Prototype-only` | `M03` | `FEAT-DLV-02` | Simulated in `html/submissions.html`; target persisted in `Submission` table. | [`SUBMISSIONS_SPEC.md`](./specifications/SUBMISSIONS_SPEC.md) |

---

## 9. Wallets (`WAL`)

| Feature ID | Feature | Description | User | Status | Milestone | Dependencies | Acceptance Criteria | Documentation |
|---|---|---|---|---|---|---|---|---|
| `FEAT-WAL-01` | Base Sepolia Wallet Connection (`wagmi` + `viem`) | Connect EVM wallets and enforce Chain ID `84532` (Base Sepolia). | Client, Freelancer | `Planned` | `M04` | `ESC-001`, `ESC-003` | Replaces raw `window.ethereum` Sepolia `0xaa36a7` call in `src/lib/patela-store.ts`. | [`WALLET_SPEC.md`](./specifications/WALLET_SPEC.md) |
| `FEAT-WAL-02` | Cryptographic Signature Wallet Linking | Verify wallet ownership via signed nonce challenge and bind address to user account. | Client, Freelancer | `Planned` | `M04` | `FEAT-WAL-01` | Signature verified server-side via `viem` `verifyMessage`. | [`WALLET_SPEC.md`](./specifications/WALLET_SPEC.md) |
| `FEAT-WAL-03` | Test ERC-20 Balance Display | Query and display user's Base Sepolia test ERC-20 (`pUSD`) wallet balance vs. contract-locked escrow balance. | Client, Freelancer | `Prototype-only` | `M04` | `FEAT-WAL-01` | Reads live on-chain `balanceOf` on Base Sepolia. | [`WALLET_SPEC.md`](./specifications/WALLET_SPEC.md) |

---

## 10. Escrow (`ESC`)

| Feature ID | Feature | Description | User | Status | Milestone | Dependencies | Acceptance Criteria | Documentation |
|---|---|---|---|---|---|---|---|---|
| `FEAT-ESC-01` | Patela Test ERC-20 Token (`pUSD`) | Mintable test ERC-20 token contract deployed on Base Sepolia (`84532`) for MVP testing. | Client, Freelancer | `Planned` | `M04` | Foundry (`ESC-004`) | Clearly named `Patela Test USD (pUSD)`; never misrepresented as official Circle USDC. | [`ESCROW_SPEC.md`](./specifications/ESCROW_SPEC.md) |
| `FEAT-ESC-02` | Patela Milestone Escrow Smart Contract | Non-custodial Solidity contract enforcing project creation, milestone funding, approval release, revision state, dispute lock, and arbitrator resolution. | Client, Freelancer, Arbitrator | `Planned` | `M04` | `FEAT-ESC-01` | Passes 100% of Foundry unit, fuzz, and invariant security tests. | [`ESCROW_SPEC.md`](./specifications/ESCROW_SPEC.md) |
| `FEAT-ESC-03` | On-Chain Milestone Funding Flow | ERC-20 `approve` + `fundMilestone` transaction signing and receipt tracking. | Client | `Prototype-only` | `M04` | `FEAT-ESC-02` | Funds transferred to contract on Base Sepolia and indexed by backend. | [`ESCROW_SPEC.md`](./specifications/ESCROW_SPEC.md) |
| `FEAT-ESC-04` | Blockchain Event Indexer & Reconciliation Worker | BullMQ worker polling/subscribing to Base Sepolia contract logs with confirmation depth and reorg handling. | System | `Planned` | `M04` | `FEAT-ESC-02`, Redis | Reconciles `EscrowMilestone` and `Transaction` states idempotently. | [`ESCROW_SPEC.md`](./specifications/ESCROW_SPEC.md) |

---

## 11. Payments (`PAY`)

| Feature ID | Feature | Description | User | Status | Milestone | Dependencies | Acceptance Criteria | Documentation |
|---|---|---|---|---|---|---|---|---|
| `FEAT-PAY-01` | Client Milestone Approval & Payout Release | Client approves milestone on-chain (`approveMilestone`), releasing net payout to freelancer and protocol fee to fee recipient. | Client | `Prototype-only` | `M04` | `FEAT-ESC-03` | Contract transfers exact base units; emits `MilestoneReleased`; backend reconciles. | [`TRANSACTIONS_SPEC.md`](./specifications/TRANSACTIONS_SPEC.md) |
| `FEAT-PAY-02` | Milestone Refund Workflow | Return unspent locked milestone funds to client wallet under contract-authorized cancellation or dispute rules. | Client, Arbitrator | `Prototype-only` | `M04` | `FEAT-ESC-02` | Cannot exceed remaining milestone escrow balance; emits `MilestoneRefunded`. | [`TRANSACTIONS_SPEC.md`](./specifications/TRANSACTIONS_SPEC.md) |
| `FEAT-PAY-03` | Transaction Ledger & Full-Screen Receipt | Filterable transaction table and full-screen receipt view showing 3-node custody flow, fee breakdown, and Base Sepolia explorer link. | Client, Freelancer | `Prototype-only` | `M04`, `M07` | `FEAT-ESC-04` | UI built in `html/payments.html` and `PatelaDetail.openTransaction`; target backed by `Transaction` table. | [`TRANSACTIONS_SPEC.md`](./specifications/TRANSACTIONS_SPEC.md) |

---

## 12. AI Reviews (`AIR`)

| Feature ID | Feature | Description | User | Status | Milestone | Dependencies | Acceptance Criteria | Documentation |
|---|---|---|---|---|---|---|---|---|
| `FEAT-AIR-01` | Deliverable Evidence Extractor | Extract text, metadata, file trees, and code snippets from uploaded documents, images, archives, and accessible URLs. | System | `Planned` | `M05` | `FEAT-DLV-02` | Safely bounds file sizes and marks uninspectable artifacts explicitly. | [`AI_REVIEW_SPEC.md`](./specifications/AI_REVIEW_SPEC.md) |
| `FEAT-AIR-02` | Structured Advisory AI Review Worker | BullMQ worker comparing extracted evidence against `ReviewCriterion` records and producing schema-validated JSON output (`PASS`/`FAIL`/`INCONCLUSIVE`). | System | `Prototype-only` | `M05` | `FEAT-AIR-01` | Stores immutable `AiReview` record with model, prompt version, confidence, and limitations; never releases funds. | [`AI_REVIEW_SPEC.md`](./specifications/AI_REVIEW_SPEC.md) |
| `FEAT-AIR-03` | AI Verification Report UI & Escalation | Display per-criterion check results, confidence score, explanation, and human review escalation in project and submission views. | Client, Freelancer | `Prototype-only` | `M05` | `FEAT-AIR-02` | UI implemented in `html/project-detail.html` and `html/submissions.html`. | [`AI_REVIEW_SPEC.md`](./specifications/AI_REVIEW_SPEC.md) |

---

## 13. Revisions (`REV`)

| Feature ID | Feature | Description | User | Status | Milestone | Dependencies | Acceptance Criteria | Documentation |
|---|---|---|---|---|---|---|---|---|
| `FEAT-REV-01` | Client Revision Request Workflow | Client requests targeted changes on a submitted milestone with structured notes while keeping escrow funds locked. | Client | `Prototype-only` | `M03` | `FEAT-DLV-03` | Transitions milestone to `REVISION_REQUESTED` without moving escrow funds; notifies freelancer. | [`SUBMISSIONS_SPEC.md`](./specifications/SUBMISSIONS_SPEC.md) |

---

## 14. Disputes (`DSP`)

| Feature ID | Feature | Description | User | Status | Milestone | Dependencies | Acceptance Criteria | Documentation |
|---|---|---|---|---|---|---|---|---|
| `FEAT-DSP-01` | On-Chain & Off-Chain Dispute Creation | Client or freelancer raises a dispute on a funded milestone, locking escrow funds (`raiseDispute`) and opening a `Dispute` case. | Client, Freelancer | `Prototype-only` | `M06` | `FEAT-ESC-02` | Freezes milestone against ordinary approval; records reason and initiator. | [`DISPUTES_SPEC.md`](./specifications/DISPUTES_SPEC.md) |
| `FEAT-DSP-02` | Dispute Evidence Submission | Both parties upload supporting evidence files and statements to the dispute record. | Client, Freelancer | `Planned` | `M06` | `FEAT-DSP-01` | Evidence linked to `DisputeEvidence` with private storage and timestamps. | [`DISPUTES_SPEC.md`](./specifications/DISPUTES_SPEC.md) |
| `FEAT-DSP-03` | Human Arbitrator Resolution & Settlement | Authorized arbitrator reviews brief, submissions, AI report, and evidence, then executes `resolveDispute` on-chain to release, refund, or split funds. | Arbitrator / Admin | `Planned` | `M06` | `FEAT-DSP-02` | Enforces `onlyArbitrator` on-chain and `ARBITRATOR` RBAC in API; logs full audit trail. | [`DISPUTES_SPEC.md`](./specifications/DISPUTES_SPEC.md) |

---

## 15. Messaging (`MSG`)

| Feature ID | Feature | Description | User | Status | Milestone | Dependencies | Acceptance Criteria | Documentation |
|---|---|---|---|---|---|---|---|---|
| `FEAT-MSG-01` | Project Thread Messaging | Real-time/persisted messaging between client and freelancer scoped to each project. | Client, Freelancer | `Prototype-only` | `M03` | `FEAT-PRJ-02` | UI working in `html/messages.html`; target persists to `Message` table with participant access control. | [`MESSAGING_SPEC.md`](./specifications/MESSAGING_SPEC.md) |

---

## 16. Notifications (`NTF`)

| Feature ID | Feature | Description | User | Status | Milestone | Dependencies | Acceptance Criteria | Documentation |
|---|---|---|---|---|---|---|---|---|
| `FEAT-NTF-01` | In-App Lifecycle Notifications | Topbar notification center with unread badge, mark-as-read, and deep links to affected project/milestone/transaction. | Client, Freelancer, Admin | `Prototype-only` | `M03` | `FEAT-AUTH-02` | UI working in `html/assets/js/navigation.js`; target driven by `OutboxEvent` + `Notification` table. | [`NOTIFICATIONS_SPEC.md`](./specifications/NOTIFICATIONS_SPEC.md) |

---

## 17. Analytics (`ANA`)

| Feature ID | Feature | Description | User | Status | Milestone | Dependencies | Acceptance Criteria | Documentation |
|---|---|---|---|---|---|---|---|---|
| `FEAT-ANA-01` | Client Spending & Escrow Analytics | Time-series spending charts (`7d`–`all`), category allocation donut chart, non-overlapping escrow custody bar, and project comparison. | Client | `Prototype-only` | `M07` | `FEAT-ESC-04` | UI built in `html/analytics.html`; target computed from reconciled PostgreSQL records. | [`ANALYTICS_SPEC.md`](./specifications/ANALYTICS_SPEC.md) |
| `FEAT-ANA-02` | Freelancer Earnings & Delivery Analytics | Settled earnings time-series (`daily`/`weekly`/`monthly`), earnings custody bar, payout ledger, and delivery performance metrics. | Freelancer | `Prototype-only` | `M07` | `FEAT-ESC-04` | UI built in `html/analytics.html`; target computed from reconciled PostgreSQL records. | [`ANALYTICS_SPEC.md`](./specifications/ANALYTICS_SPEC.md) |

---

## 18. Administration (`ADM`)

| Feature ID | Feature | Description | User | Status | Milestone | Dependencies | Acceptance Criteria | Documentation |
|---|---|---|---|---|---|---|---|---|
| `FEAT-ADM-01` | Admin Oversight & Moderation Console | Admin interface to monitor users, moderate jobs, inspect AI review queues, audit transactions, and manage disputes. | Admin, Arbitrator | `Planned` | `M07` | `FEAT-AUTH-02`, `FEAT-DSP-03` | Enforces `ADMIN` role; records all moderation actions in `ActivityLog`. | [`ANALYTICS_SPEC.md`](./specifications/ANALYTICS_SPEC.md) |

---

## 19. Security (`SEC`)

| Feature ID | Feature | Description | User | Status | Milestone | Dependencies | Acceptance Criteria | Documentation |
|---|---|---|---|---|---|---|---|---|
| `FEAT-SEC-01` | Input Validation, Rate Limiting & Idempotency | Global request validation, rate limiting on auth/uploads/AI, and `IdempotencyKey` enforcement on financial mutations. | System | `Planned` | `M01`–`M08` | NestJS, Redis | Rejects malformed payloads and duplicate financial requests safely. | [`11_SECURITY_AND_COMPLIANCE.md`](./11_SECURITY_AND_COMPLIANCE.md) |
| `FEAT-SEC-02` | Smart-Contract Invariant & Reentrancy Protection | OpenZeppelin `ReentrancyGuard`, `SafeERC20`, strict access modifiers, and Foundry invariant test suite. | System | `Planned` | `M04`, `M08` | Foundry | Zero invariant violations across 10,000+ fuzz runs. | [`09_BLOCKCHAIN_AND_ESCROW.md`](./09_BLOCKCHAIN_AND_ESCROW.md) |

---

## 20. Infrastructure (`INF`)

| Feature ID | Feature | Description | User | Status | Milestone | Dependencies | Acceptance Criteria | Documentation |
|---|---|---|---|---|---|---|---|---|
| `FEAT-INF-01` | Collapsible Sidebar & Mobile-First App Shell | Responsive dashboard shell with persistent `236px` ↔ `72px` collapsible desktop sidebar (`Ctrl+B`), mobile slide-over drawer, and mobile bottom nav bar. | Client, Freelancer | `Prototype-only` | `M00` | `html/assets/js/navigation.js` | Implemented in `html/` and served natively through Next.js (`/html/*` and `/dashboard/*` redirects) with bidirectional `localStorage` state sync (`patela-demo-v1` ↔ `patela_proto_state_v3`). | [`03_DESIGN_LANGUAGE.md`](./03_DESIGN_LANGUAGE.md) |
| `FEAT-INF-02` | Local Docker & Base Sepolia Deployment Pipeline | Reproducible Docker Compose setup (PostgreSQL, Redis, MinIO) and Foundry deployment/verification scripts for Base Sepolia. | Developer | `Planned` | `M00`, `M04`, `M08` | Docker, Foundry | Single command starts local infra; contracts verified on BaseScan Sepolia. | [`13_ENVIRONMENT_AND_DEPLOYMENT.md`](./13_ENVIRONMENT_AND_DEPLOYMENT.md) |
| `FEAT-INF-03` | Unified Next.js + Dashboard Bridge & iOS Fluid Motion | Seamless route handler (`/html/[[...slug]]`), `/dashboard` redirects, bidirectional demo store bridge (`patela-store.ts` ↔ `demo-data.js`), ambient video/glass unification, and iOS spring animations. | Visitor, Client, Freelancer | `Implemented` | `M00` | `src/app/html/[[...slug]]/route.ts`, `src/lib/patela-store.ts`, `html/assets/js/navigation.js` | Every public page and app route links cleanly into `/html/*` and vice versa with shared visual atmosphere and synchronized demo jobs. | [`03_DESIGN_LANGUAGE.md`](./03_DESIGN_LANGUAGE.md) |

