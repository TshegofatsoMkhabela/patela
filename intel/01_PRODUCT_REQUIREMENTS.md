# 01 — Product Requirements Document (PRD)

**Document Version:** 1.0  
**Last Updated:** 2026-11-09  
**Target Release:** Base Sepolia Testnet MVP

---

## 1. Requirement Status Legend

- **`IMPLEMENTED`**: Working in production/target architecture and verified by automated tests.
- **`PROTOTYPE_ONLY`**: Simulated in browser `localStorage` (`src/lib/patela-store.ts` or `html/`) without backend, database, or on-chain persistence.
- **`IN_PROGRESS`**: Currently under active development.
- **`PLANNED`**: Specified for the Testnet MVP roadmap; not yet implemented in backend/contract code.

---

## 2. Functional Requirements (`FR-*`)

### FR-001: Unified User Registration & Session Authentication
- **Requirement Description:** Users must be able to register with email and password, verify their email, log in, log out, and reset passwords using secure server-managed HTTP-only session cookies.
- **Business Purpose:** Establish accountable identities for clients, freelancers, and administrators.
- **User Affected:** Client, Freelancer, Admin.
- **Expected Behaviour:** Passwords hashed with Argon2id; sessions stored in PostgreSQL/Redis with CSRF protection and automatic expiration/revocation.
- **Acceptance Criteria:**
  1. `POST /api/v1/auth/register` creates user and profile records with hashed password.
  2. `POST /api/v1/auth/login` issues an `HttpOnly`, `Secure`, `SameSite=Lax` session cookie.
  3. Unauthenticated requests to protected routes return `401 Unauthorized`.
- **Dependencies:** PostgreSQL, Prisma (`DB-001`–`DB-009`).
- **Priority:** P0 (Critical)
- **Implementation Status:** `PLANNED`
- **Related Milestone:** [`MILESTONE_01_AUTH_AND_DATABASE.md`](./milestones/MILESTONE_01_AUTH_AND_DATABASE.md)
- **Related Specification:** [`AUTHENTICATION_SPEC.md`](./specifications/AUTHENTICATION_SPEC.md)

### FR-002: Dual Client & Freelancer Workspace Capabilities
- **Requirement Description:** A single authenticated user account must be able to act as both a Client (posting jobs, funding escrow, approving work) and a Freelancer (applying to jobs, submitting deliverables, receiving payouts), plus have role-based access control for `ADMIN` / `ARBITRATOR`.
- **Business Purpose:** Eliminate friction for users who both hire and freelance while enforcing strict per-project authorization (a user cannot hire themselves on their own job).
- **User Affected:** Client, Freelancer.
- **Expected Behaviour:** Users can switch their active dashboard persona (`client` ↔ `worker`) in the UI while server-side guards verify whether the authenticated `userId` is the `clientId` or `freelancerId` on any specific project.
- **Acceptance Criteria:**
  1. User profile supports both client and freelancer metadata (bio, skills, portfolio links, company name).
  2. Server rejects any attempt by a user to apply to their own job (`403 Forbidden`).
- **Dependencies:** `FR-001`.
- **Priority:** P0 (Critical)
- **Implementation Status:** `PROTOTYPE_ONLY` (Role switcher exists in `html/assets/js/navigation.js`; no backend auth).
- **Related Milestone:** [`MILESTONE_01_AUTH_AND_DATABASE.md`](./milestones/MILESTONE_01_AUTH_AND_DATABASE.md)
- **Related Specification:** [`USER_AND_PROFILE_SPEC.md`](./specifications/USER_AND_PROFILE_SPEC.md)

### FR-003: Cryptographic Wallet Linking & Verification
- **Requirement Description:** Users must connect an EVM wallet on Base Sepolia (`84532`) and prove ownership via an EIP-191 / SIWE cryptographic signature challenge before funding escrow or receiving payouts.
- **Business Purpose:** Ensure that on-chain deposits and payouts are tied to verified wallet addresses owned by the client and freelancer.
- **User Affected:** Client, Freelancer.
- **Expected Behaviour:** Backend issues a single-use nonce; user signs message in wallet via `wagmi`/`viem`; backend verifies signature and stores the verified `Wallet` record.
- **Acceptance Criteria:**
  1. Wallet connection validates Chain ID `84532` (Base Sepolia) and prompts network switch if mismatched.
  2. Replayed or invalid signatures are rejected with `400 Bad Request`.
  3. Demo wallet fallback is disabled in Testnet MVP mode (or restricted to explicit sandbox preview).
- **Dependencies:** `FR-001`, `wagmi`, `viem`.
- **Priority:** P0 (Critical)
- **Implementation Status:** `PROTOTYPE_ONLY` (`src/lib/patela-store.ts` connects to Ethereum Sepolia `0xaa36a7` without signature verification).
- **Related Milestone:** [`MILESTONE_04_WALLET_AND_ESCROW.md`](./milestones/MILESTONE_04_WALLET_AND_ESCROW.md)
- **Related Specification:** [`WALLET_SPEC.md`](./specifications/WALLET_SPEC.md)

### FR-004: Structured Job Creation, Publishing & Discovery
- **Requirement Description:** Clients must be able to create, save as draft, publish, edit, and archive jobs containing a title, category, scope description, required skills, target deadline, total budget, milestone breakdown, and explicit deliverable acceptance criteria.
- **Business Purpose:** Establish unambiguous deliverable expectations before applications and escrow funding.
- **User Affected:** Client, Freelancer.
- **Expected Behaviour:** Sum of milestone amounts must equal total job budget (`validateJob`). Published jobs appear in the searchable, filterable marketplace.
- **Acceptance Criteria:**
  1. Job creation validates that `sum(milestones.amount) == job.budget` in exact integer base units.
  2. Every job and milestone has at least one verifiable deliverable criterion.
  3. Freelancers can search and filter published jobs by keyword, category, budget range, and skills.
- **Dependencies:** `FR-001`, `FR-002`.
- **Priority:** P0 (Critical)
- **Implementation Status:** `PROTOTYPE_ONLY` (Client-side validation in `src/lib/patela-store.ts` and `html/post-job.html`; persisted only to `localStorage`).
- **Related Milestone:** [`MILESTONE_02_MARKETPLACE.md`](./milestones/MILESTONE_02_MARKETPLACE.md)
- **Related Specification:** [`MARKETPLACE_SPEC.md`](./specifications/MARKETPLACE_SPEC.md)

### FR-005: Freelancer Applications & Hiring Workflow
- **Requirement Description:** Freelancers must be able to submit proposals/applications to open jobs (pitch, proposed bid/milestone confirmation, estimated timeline, relevant portfolio links), and clients must be able to review, shortlist, reject, or accept an application to initiate hiring.
- **Business Purpose:** Connect open jobs with qualified freelancers and transition agreed terms into a binding project agreement.
- **User Affected:** Client, Freelancer.
- **Expected Behaviour:** One active application per freelancer per job. Accepting an application transitions the job to `HIRED` / `IN_PROGRESS` and generates a `ProjectAgreement` and `Project`.
- **Acceptance Criteria:**
  1. Freelancer can submit and withdraw an application on an `OPEN` job.
  2. Client can view all applications for their job and accept one freelancer.
  3. Accepting an application atomically creates the `Project`, `ProjectAgreement`, and `Milestone` records in PostgreSQL.
- **Dependencies:** `FR-004`.
- **Priority:** P0 (Critical)
- **Implementation Status:** `PROTOTYPE_ONLY` (Simulated proposal form in `html/assets/js/interactions.js`; absent in `src/`).
- **Related Milestone:** [`MILESTONE_02_MARKETPLACE.md`](./milestones/MILESTONE_02_MARKETPLACE.md)
- **Related Specification:** [`APPLICATIONS_SPEC.md`](./specifications/APPLICATIONS_SPEC.md)

### FR-006: Project Workspace & Milestone Lifecycle Management
- **Requirement Description:** Each hired engagement must have a dedicated project workspace displaying agreement terms, milestone progress, deliverable checklists, escrow custody balances, AI verification reports, activity timeline, and project messaging.
- **Business Purpose:** Provide a single source of truth for work progress, financial custody, and deliverable verification.
- **User Affected:** Client, Freelancer.
- **Expected Behaviour:** Milestones follow a strict state machine (`NOT_FUNDED → FUNDED → IN_PROGRESS → SUBMITTED → UNDER_AI_REVIEW → AWAITING_CLIENT_APPROVAL → REVISION_REQUESTED | DISPUTED | APPROVED → RELEASED | REFUNDED`). Once an agreement is accepted, scope and budget cannot be unilaterally modified.
- **Acceptance Criteria:**
  1. Only the assigned client and freelancer (and authorized admins) can view the private project workspace.
  2. Every state transition is logged in `ActivityLog` with actor, timestamp, and metadata.
- **Dependencies:** `FR-005`.
- **Priority:** P0 (Critical)
- **Implementation Status:** `PROTOTYPE_ONLY` (Implemented in UI prototype `html/project-detail.html` and `src/app/jobs/[jobId]/job-view.tsx` with `localStorage`).
- **Related Milestone:** [`MILESTONE_03_PROJECT_MANAGEMENT.md`](./milestones/MILESTONE_03_PROJECT_MANAGEMENT.md)
- **Related Specification:** [`PROJECTS_AND_MILESTONES_SPEC.md`](./specifications/PROJECTS_AND_MILESTONES_SPEC.md)

### FR-007: Secure Deliverable Submissions & Revision Management
- **Requirement Description:** Freelancers must be able to submit versioned deliverables (files uploaded to private S3-compatible storage, external links, and structured delivery notes) against funded milestones, and clients must be able to request targeted revisions when work is incomplete.
- **Business Purpose:** Capture verifiable evidence of completed work while protecting files from unauthorized public access.
- **User Affected:** Freelancer, Client.
- **Expected Behaviour:** Files are uploaded via pre-signed URLs or validated multipart streams with MIME-type, size, and checksum verification. Each submission increments the version (`v1`, `v2`, etc.) and triggers an AI review job. Revision requests keep escrow funds locked and return the milestone to `REVISION_REQUESTED`.
- **Acceptance Criteria:**
  1. Freelancers cannot submit deliverables to an unfunded milestone.
  2. Uploaded files are stored in a private bucket and accessed only via short-lived signed URLs for authorized project participants and the AI worker.
  3. Revision requests require structured client feedback and do not release or refund escrow funds.
- **Dependencies:** `FR-006`, S3-compatible object storage.
- **Priority:** P0 (Critical)
- **Implementation Status:** `PROTOTYPE_ONLY` (`job-view.tsx` only reads filenames in browser memory).
- **Related Milestone:** [`MILESTONE_03_PROJECT_MANAGEMENT.md`](./milestones/MILESTONE_03_PROJECT_MANAGEMENT.md)
- **Related Specification:** [`SUBMISSIONS_SPEC.md`](./specifications/SUBMISSIONS_SPEC.md)

### FR-008: Base Sepolia Smart-Contract Escrow & Milestone Funding
- **Requirement Description:** Clients must fund milestones by depositing the test ERC-20 token into the Patela Escrow Smart Contract on Base Sepolia (`84532`), and the backend must verify and reconcile on-chain events before marking milestones as `FUNDED`.
- **Business Purpose:** Guarantee that funds are cryptographically locked in a non-custodial smart contract before work is delivered.
- **User Affected:** Client, Freelancer.
- **Expected Behaviour:** Client approves ERC-20 allowance and invokes `fundMilestone`; frontend tracks transaction hash (`SUBMITTED → PENDING → CONFIRMED`); backend indexer verifies `MilestoneFunded` event on Base Sepolia and updates PostgreSQL state to `RECONCILED`.
- **Acceptance Criteria:**
  1. Funds are held by the deployed Solidity contract on Base Sepolia (`84532`), never by a backend EOA wallet.
  2. A milestone is not marked `FUNDED` in PostgreSQL solely from a frontend API call; it requires verified on-chain receipt/event confirmation.
  3. Reverted or dropped transactions are accurately reflected in the UI.
- **Dependencies:** `FR-003`, `FR-006`, Foundry contracts, Base Sepolia RPC.
- **Priority:** P0 (Critical)
- **Implementation Status:** `PROTOTYPE_ONLY` (`actions.fund` in `src/lib/patela-store.ts` generates a fake hash in `localStorage`).
- **Related Milestone:** [`MILESTONE_04_WALLET_AND_ESCROW.md`](./milestones/MILESTONE_04_WALLET_AND_ESCROW.md)
- **Related Specification:** [`ESCROW_SPEC.md`](./specifications/ESCROW_SPEC.md), [`TRANSACTIONS_SPEC.md`](./specifications/TRANSACTIONS_SPEC.md)

### FR-009: AI-Assisted Deliverable Evaluation
- **Requirement Description:** Upon deliverable submission, a background worker must evaluate the submitted evidence against the milestone's agreed deliverable criteria and generate a structured, immutable AI Verification Report.
- **Business Purpose:** Help clients and freelancers objectively assess whether deliverables match the agreed brief before approval or revision.
- **User Affected:** Client, Freelancer, Arbitrator.
- **Expected Behaviour:** The worker extracts evidence from supported file types (documents, images, source code archives, accessible URLs), evaluates each criterion (`PASS`, `FAIL`, `INCONCLUSIVE`), records confidence and limitations, and transitions the milestone to `AWAITING_CLIENT_APPROVAL`.
- **Acceptance Criteria:**
  1. AI report includes per-requirement status, evidence inspected, explanation, missing items, suggested revisions, confidence score, model identifier, and prompt/criteria version.
  2. If a file or link cannot be inspected, the AI marks the requirement `INCONCLUSIVE` and states the limitation—never fabricating verification.
  3. AI review completion **never** triggers automatic on-chain payment release.
- **Dependencies:** `FR-007`, Redis + BullMQ.
- **Priority:** P0 (Critical)
- **Implementation Status:** `PROTOTYPE_ONLY` (Simulated by `demoReview` in `src/lib/patela-store.ts` and static mock reports in `html/`).
- **Related Milestone:** [`MILESTONE_05_AI_REVIEW.md`](./milestones/MILESTONE_05_AI_REVIEW.md)
- **Related Specification:** [`AI_REVIEW_SPEC.md`](./specifications/AI_REVIEW_SPEC.md)

### FR-010: Milestone Approval, Payment Release & Refunds
- **Requirement Description:** Authorized clients must be able to approve a milestone on-chain to release the escrowed funds to the freelancer's verified wallet (minus any configured protocol fee), or execute a mutually agreed/authorized refund.
- **Business Purpose:** Settle completed work transparently and verifiably on Base Sepolia.
- **User Affected:** Client, Freelancer.
- **Expected Behaviour:** Client invokes `approveMilestone` on the smart contract; contract transfers net payout to freelancer and fee to protocol treasury, emitting `MilestoneReleased`; backend indexer reconciles balances and transaction history.
- **Acceptance Criteria:**
  1. No milestone can release more than its funded amount or be paid twice.
  2. Disputed milestones cannot be released via ordinary `approveMilestone`.
  3. Reconciled payout appears in both client and freelancer transaction ledgers with verifiable Base Sepolia transaction hash and block number.
- **Dependencies:** `FR-008`, `FR-009`.
- **Priority:** P0 (Critical)
- **Implementation Status:** `PROTOTYPE_ONLY` (Simulated in `html/assets/js/app.js` and `interactions.js`).
- **Related Milestone:** [`MILESTONE_04_WALLET_AND_ESCROW.md`](./milestones/MILESTONE_04_WALLET_AND_ESCROW.md)
- **Related Specification:** [`ESCROW_SPEC.md`](./specifications/ESCROW_SPEC.md), [`TRANSACTIONS_SPEC.md`](./specifications/TRANSACTIONS_SPEC.md)

### FR-011: Dispute Creation, Evidence Submission & Human Resolution
- **Requirement Description:** Either party on a funded milestone must be able to raise a dispute, locking the milestone funds in the smart contract (`raiseDispute`) and opening a structured dispute case where both parties submit evidence for an authorized human reviewer (`ARBITRATOR` / `ADMIN`) to resolve (`resolveDispute`).
- **Business Purpose:** Protect both clients and freelancers when disagreements arise over deliverable quality or responsiveness.
- **User Affected:** Client, Freelancer, Arbitrator/Admin.
- **Expected Behaviour:** Raising a dispute freezes ordinary release/refund paths on the contract. Both parties can upload evidence and statements. The human reviewer inspects the agreement, submissions, AI report, and evidence, then executes an authorized resolution (100% release to freelancer, 100% refund to client, or custom split amount totaling the milestone balance).
- **Acceptance Criteria:**
  1. While in `DISPUTED` status, ordinary `approveMilestone` and `refundMilestone` calls revert on-chain.
  2. Only an authorized arbitrator role can execute `resolveDispute` on-chain and in the backend.
  3. Every dispute action is permanently recorded in the audit log.
- **Dependencies:** `FR-008`, `FR-009`.
- **Priority:** P0 (Critical)
- **Implementation Status:** `PROTOTYPE_ONLY` (UI confirmation modal in `html/assets/js/app.js`; no backend or contract logic).
- **Related Milestone:** [`MILESTONE_06_DISPUTE_RESOLUTION.md`](./milestones/MILESTONE_06_DISPUTE_RESOLUTION.md)
- **Related Specification:** [`DISPUTES_SPEC.md`](./specifications/DISPUTES_SPEC.md)

### FR-012: Project Messaging & In-App Notifications
- **Requirement Description:** Clients and freelancers must be able to exchange messages within each project thread and receive real-time/in-app notifications for key lifecycle events (new application, hired, milestone funded, work submitted, AI review ready, revision requested, payment released, dispute opened/resolved).
- **Business Purpose:** Keep project communication auditable and ensure timely action on pending reviews or revisions.
- **User Affected:** Client, Freelancer, Admin.
- **Expected Behaviour:** Messages are persisted per project thread; notifications support unread counts and mark-as-read actions.
- **Acceptance Criteria:**
  1. Only project participants (and dispute reviewers when disputed) can read/post in a project thread.
  2. Lifecycle transitions automatically enqueue notification events via outbox/worker.
- **Dependencies:** `FR-006`.
- **Priority:** P1 (High)
- **Implementation Status:** `PROTOTYPE_ONLY` (Simulated in `html/messages.html` and topbar popover in `html/assets/js/navigation.js`).
- **Related Milestone:** [`MILESTONE_03_PROJECT_MANAGEMENT.md`](./milestones/MILESTONE_03_PROJECT_MANAGEMENT.md)
- **Related Specification:** [`MESSAGING_SPEC.md`](./specifications/MESSAGING_SPEC.md), [`NOTIFICATIONS_SPEC.md`](./specifications/NOTIFICATIONS_SPEC.md)

### FR-013: Reconciled Financial Analytics & Administrative Oversight
- **Requirement Description:** Dashboards must display accurate, non-overlapping financial metrics and charts derived from reconciled database and blockchain records, and administrators must have an oversight interface for users, jobs, projects, AI reviews, transactions, and disputes.
- **Business Purpose:** Provide complete financial transparency without double-counting or fake telemetry.
- **User Affected:** Client, Freelancer, Admin.
- **Expected Behaviour:** Client analytics show total deposited, active locked escrow, awaiting review, released spending, and refunded amounts. Worker analytics show settled earnings, locked escrow, pending payouts, and delivery metrics.
- **Acceptance Criteria:**
  1. Financial aggregations use exact integer base-unit arithmetic reconciled with Base Sepolia events.
  2. Admin dashboard enforces strict `ADMIN` role authorization and logs all administrative actions.
- **Dependencies:** `FR-008`, `FR-010`, `FR-011`.
- **Priority:** P1 (High)
- **Implementation Status:** `PROTOTYPE_ONLY` (Client/Worker analytics UI built in `html/analytics.html` with demo data; Admin UI not yet built).
- **Related Milestone:** [`MILESTONE_07_ANALYTICS_AND_ADMIN.md`](./milestones/MILESTONE_07_ANALYTICS_AND_ADMIN.md)
- **Related Specification:** [`ANALYTICS_SPEC.md`](./specifications/ANALYTICS_SPEC.md)

---

## 3. Non-Functional Requirements (`NFR-*`)

| ID | Category | Requirement | Target Metric / Verification |
|---|---|---|---|
| **NFR-001** | **Financial Precision** | Never use IEEE 754 floating-point (`number`) for financial storage or arithmetic. Store all token amounts in integer base units (`BigInt` / `NUMERIC(36,0)`) with explicit token decimals (`6` or `18`). | 100% of DB columns and API payloads use integer base-unit strings or exact decimals; verified by unit tests. |
| **NFR-002** | **Security & Authority** | Smart contract is authoritative for escrow custody; AI worker has zero signing/release authority; all mutating API endpoints enforce session auth, RBAC, and Zod/class-validator schemas. | Verified by Foundry invariant tests and API authorization integration tests. |
| **NFR-003** | **Idempotency** | All financial, submission, and webhook/indexer operations must enforce idempotency via `Idempotency-Key` headers and unique `(chainId, txHash, logIndex)` constraints. | Duplicate requests or re-indexed blocks produce zero duplicate state transitions. |
| **NFR-004** | **Usability & Design Discipline** | Preserve Patela's calm, minimal, deep-navy (`#050912`) and champagne-gold (`#D9BD8B`) design language, progressive disclosure, full-screen detail workspaces, and collapsible sidebar. | Responsive across `1440px`, `1280px`, `768px`, and `360px` viewports with zero horizontal overflow. |
| **NFR-005** | **Accessibility** | Semantic HTML landmarks, keyboard navigation (`Tab`, `Enter`, `Escape`, `Ctrl+B`), visible focus rings (`:focus-visible`), `aria-label` on icon buttons, and `prefers-reduced-motion` support. | Automated axe/Lighthouse accessibility score $\ge 95$. |
| **NFR-006** | **Reliability & Auditability** | Every project, milestone, escrow, AI review, and dispute state change must write an immutable record to `ActivityLog` and `OutboxEvent` within the same database transaction. | 100% state-transition coverage in integration tests. |

