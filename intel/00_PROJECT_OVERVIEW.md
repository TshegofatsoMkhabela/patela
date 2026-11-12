# 00 — Project Overview: Patela

**Document Version:** 1.0  
**Last Updated:** 2026-11-09  
**Status:** Baseline Approved for Testnet MVP Planning

---

## 1. Product Vision

Patela is a **Web3-powered freelance marketplace and deliverable trust platform** designed to make freelance engagements, milestone verification, and payments transparent, secure, and accountable.

Patela connects **clients** who need technical, creative, or professional work completed with **freelancers (workers)** who deliver that work. Unlike traditional freelance boards or generic crypto job boards, Patela combines:

1. **Structured freelance projects** with explicit acceptance criteria.
2. **Milestone-based agreements** where scope and budgets are locked before work begins.
3. **Smart-contract escrow on Base** so funds are cryptographically secured before a freelancer starts working.
4. **AI-assisted deliverable evaluation** that inspects submitted files, code, and links against the agreed deliverable checklist to produce an objective, advisory verification report.
5. **Transparent payment tracking** linking off-chain project state with independently verifiable on-chain escrow transactions.
6. **Structured revision management** when deliverables need adjustments.
7. **Human-arbitrated dispute resolution** that keeps funds locked in escrow until an authorized resolution is reached.
8. **Stablecoin-denominated settlements** (using a single test ERC-20 token for the Base Sepolia Testnet MVP).

---

## 2. Problem Statement

### 2.1 Challenges Faced by Clients
- Paying upfront or releasing milestones for work that does not satisfy technical or design requirements.
- Difficulty evaluating complex deliverables (source code, multi-file design bundles, technical audits) before approving payment.
- Fragmented communication and poor visibility into milestone progress.
- Unclear recourse when deliverables are incomplete or substandard.

### 2.2 Challenges Faced by Freelancers
- Completing substantial work only to face non-payment, ghosting, or arbitrary payment delays.
- Starting work without verifiable proof that the client actually has the funds set aside.
- Scope creep and unbounded revision demands due to vague initial briefs.
- High platform take-rates (10%–20% on traditional platforms) and multi-week withdrawal holds.

### 2.3 How Patela Solves Both Sides
Patela enforces a **Three-Pillar Trust Model**:
1. **The Work:** Structured deliverables and acceptance criteria defined per milestone before agreement sign-off.
2. **The Money:** Smart-contract escrow on Base that locks the milestone budget before work starts.
3. **The Evidence:** Deterministic + AI-assisted deliverable inspection that produces a structured report for both parties, paired with explicit client approval or human dispute resolution.

---

## 3. Target Users

1. **Clients (Hiring Teams, Founders, DAOs, Agencies, Product Managers):**
   - Need reliable engineers, designers, auditors, and creators.
   - Want confidence that escrowed funds are only released when deliverables are verified and approved.
2. **Freelancers / Workers (Developers, UI/UX Designers, Smart Contract Auditors, Technical Writers):**
   - Want cryptographic proof that milestone funds are locked in escrow before starting work.
   - Want objective deliverable criteria and fast, transparent settlement upon approval.
3. **Platform Administrators & Dispute Reviewers:**
   - Monitor marketplace integrity, review escalated disputes using submitted evidence and AI reports, and execute authorized dispute resolutions.

> **Unified Account Principle:** A single registered Patela user account can operate as **both a client and a freelancer** (switching context in the workspace) without needing separate logins.

---

## 4. Product Positioning

Patela is positioned as a **premium fintech + productivity workspace** with blockchain infrastructure operating cleanly behind the scenes.

- **What Patela IS:** Calm, minimal, trustworthy, transparent, and work-first. Inspired by the clarity of Stripe dashboards and the restraint of Apple interfaces.
- **What Patela is NOT:** A cryptocurrency exchange, a DeFi yield/speculative token portal, a cluttered job board, or an autonomous AI experiment that moves money without human authorization.

---

## 5. End-to-End Core User Journey (14 Steps)

1. **Account Creation:** A user registers and authenticates on Patela (and links their EVM wallet).
2. **Job Publication:** A client creates and publishes a job specifying description, required skills, total budget, milestones, and explicit deliverable acceptance criteria.
3. **Discovery & Proposals:** Freelancers browse open jobs in the marketplace and submit structured proposals/applications.
4. **Freelancer Selection:** The client reviews applications and selects a freelancer.
5. **Scope & Milestone Agreement:** Client and freelancer finalize the project agreement (scope, milestone amounts, due dates, and deliverable criteria).
6. **Project Creation:** A structured project workspace and agreement record are created in PostgreSQL.
7. **On-Chain Escrow Funding:** The client funds the project/milestone in the Patela Escrow Smart Contract on **Base Sepolia (`84532`)** using the test ERC-20 token.
8. **Escrow Custody Lock:** The smart contract holds the funds under strict state-machine rules; the backend indexes the `MilestoneFunded` event and reconciles database state.
9. **Deliverable Submission:** The freelancer completes the milestone work and uploads deliverable files/links and notes to private object storage.
10. **AI Deliverable Evaluation:** A background worker runs Patela's AI Review System, comparing submitted evidence against the milestone's agreed deliverable criteria.
11. **Structured Verification Report:** The AI produces an immutable, versioned report listing each requirement as `PASS`, `FAIL`, or `INCONCLUSIVE`, along with evidence inspected, confidence score, limitations, and suggested revisions.
12. **Client Review & Decision:** The client inspects the deliverables and the advisory AI report, then chooses to:
    - **Approve Milestone** (signing an on-chain release or authorized approval transaction),
    - **Request Revision** (providing structured feedback while funds stay locked), or
    - **Raise Dispute** (freezing the milestone in `DISPUTED` state for human review).
13. **Escrow Settlement:** Once an authorized contract condition is met (client approval or authorized dispute resolution), the smart contract transfers the net payout to the freelancer (and any configured protocol fee to the fee recipient) or refunds the client.
14. **Lifecycle & Financial Tracking:** Both parties track milestone progress, AI review history, on-chain transaction hashes, and reconciled financial analytics in their dashboards.

> **CRITICAL ARCHITECTURAL INVARIANT:** AI reviews are **advisory evidence only**. AI never has autonomous authority to release or refund escrow funds.

---

## 6. Testnet MVP Scope Boundaries

### 6.1 Included in the Base Sepolia Testnet MVP
- Server-managed authentication (registration, login, logout, password reset, session cookies) + unified Client/Freelancer account roles.
- User profiles and cryptographic wallet linking (`wagmi` + `viem` + EIP-191/EIP-4361 signature verification).
- Full job lifecycle (draft, publish, edit, archive, browse, search, filter) and freelancer proposal/application workflow.
- Project agreements, milestones, deliverable checklists, private S3-compatible file submissions, and revision requests.
- Base Sepolia (`84532`) smart-contract escrow + **one dedicated test ERC-20 token** (`Patela Test Token` / `pUSD`).
- Real on-chain milestone funding, approval release, refund, and dispute settlement with backend event indexing and reconciliation.
- Asynchronous AI deliverable review worker producing structured `PASS` / `FAIL` / `INCONCLUSIVE` reports.
- Human-arbitrated dispute workflow with evidence submission and admin resolution interface.
- Reconciled client spending & freelancer earnings dashboards, project messaging, notifications, and admin oversight tools.

### 6.2 Explicitly Excluded / Deferred from the Testnet MVP
- Mainnet deployment with real customer funds (blocked pending formal smart-contract security audit and South African legal/regulatory clearance).
- Multiple blockchain networks (e.g., Arbitrum, Polygon, Solana, Ethereum Mainnet) — **Base Sepolia only** for MVP.
- Multiple payment tokens — **one test ERC-20 token only** for MVP.
- Fiat on/off-ramps or credit card gateways.
- Autonomous AI-triggered on-chain releases without client approval or human arbitration.
- Native iOS/Android mobile apps (the web application is mobile-responsive).
- Platform governance tokens, staking, or decentralized juror voting protocols.

---

## 7. Confirmed Decisions vs. Open Assumptions Requiring Approval

### 7.1 Confirmed Decisions
- **Frontend:** Next.js (App Router) + TypeScript, preserving the established Patela deep-navy & champagne-gold design language.
- **Backend:** Custom NestJS + Fastify + TypeScript modular monolith (`/api/v1`).
- **Database:** PostgreSQL + Prisma ORM with integer base-unit financial representation.
- **Queue / Workers:** Redis + BullMQ for AI review jobs, blockchain indexing, and notifications.
- **Blockchain & Contracts:** Base Sepolia (`84532`), Solidity + Foundry, `wagmi` + `viem`, single test ERC-20 token.
- **AI Authority:** Strictly advisory; cannot release funds autonomously.

### 7.2 Assumptions & Open Product Questions (Tracked in `decisions/`)
1. **Milestone Funding Granularity:** Whether clients must fund all milestones upfront upon agreement creation or fund milestones sequentially (`fundMilestone(projectId, milestoneIndex)`). *Default design supports per-milestone funding with an option to batch-fund all milestones.*
2. **Client Unresponsiveness Timeout:** Whether the smart contract should include a configurable review timeout window after deliverable submission, or whether an unresponsive client simply gives the freelancer the right to escalate to a human dispute reviewer. *Default MVP design: escalation to human dispute resolution rather than automatic timeout payout, preserving strict authorization.*
3. **Platform Fee Percentage:** Prototype UI displays `1.5%` (`150 bps`). Contract and backend will make `protocolFeeBps` configurable per escrow agreement (defaulting to `150 bps` on testnet, capped at a safe maximum in the contract).
4. **LLM Provider for AI Review Worker:** OpenAI (`gpt-4o` / `gpt-4o-mini`), Anthropic (`claude-3-5-sonnet`), or Google Gemini (`gemini-2.5-pro` / `gemini-2.5-flash`) behind a provider-agnostic `AiReviewProvider` interface.

