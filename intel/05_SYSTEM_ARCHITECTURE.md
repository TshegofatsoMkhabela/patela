# 05 — System Architecture & Lifecycle Diagrams

**Document Version:** 1.0  
**Last Updated:** 2026-11-09  

---

## 1. Architectural Principles & Authority Boundaries

Patela uses a **Modular Monolith Backend (`apps/api`) + Dedicated Background Worker (`apps/worker`) + Smart-Contract Escrow (`contracts/`)** architecture:

1. **Authoritative Data Ownership:**
   - **Base Sepolia Smart Contract (`PatelaEscrow.sol`)** is the **sole authority** for actual token custody, locked milestone balances, on-chain approvals, dispute locks, and payout/refund transfers. The backend never holds user private keys or custodies escrow funds in an EOA wallet.
   - **PostgreSQL (`database/prisma`)** is the **authoritative store** for off-chain marketplace state: user accounts, sessions, profiles, job descriptions, proposals, project agreements, deliverable file metadata, AI review reports, dispute evidence, messages, and notifications.
   - **Blockchain Event Indexer (`apps/worker/src/blockchain-indexer`)** continuously synchronizes on-chain events (`ProjectCreated`, `MilestoneFunded`, `MilestoneSubmitted`, `MilestoneApproved`, `MilestoneReleased`, `MilestoneRefunded`, `DisputeRaised`, `DisputeResolved`) into PostgreSQL and marks records as `RECONCILED`.
2. **Trust Boundaries:**
   - **Untrusted:** Browser client inputs, unverified transaction hashes submitted by the frontend, uploaded files, and raw LLM text outputs.
   - **Trusted (After Verification):** Server-validated session cookies, verified EIP-191 wallet signatures, finalized Base Sepolia RPC event logs at confirmed block depth, and schema-validated records inside PostgreSQL.
3. **AI Authority Boundary:**
   - The AI Review Worker has **read-only access** to submission artifacts and **write access only** to the `AiReview` table. It has **zero blockchain signing keys** and **cannot invoke `approveMilestone` or `resolveDispute`**.

---

## 2. Diagram 1: Overall System Architecture

```mermaid
flowchart TB
  subgraph ClientTier["Client Tier (Browser)"]
    NextWeb["Next.js 15 App (Client & Worker Workspaces)"]
    WalletExt["EVM Wallet (MetaMask / Coinbase Wallet via wagmi + viem)"]
  end

  subgraph BackendTier["Application Tier (Modular Monolith)"]
    NestAPI["NestJS + Fastify API (/api/v1)"]
    BullWorker["BullMQ Worker Service (AI Review, Indexer, Notifications)"]
  end

  subgraph DataTier["Persistence & Storage Tier"]
    Postgres[("PostgreSQL 16 (Prisma ORM)")]
    Redis[("Redis 7 (Queues, Rate Limits, Sessions)")]
    ObjectStore[("Private S3 Object Storage (Deliverables & Evidence)")]
  end

  subgraph ExternalTier["External Infrastructure"]
    BaseSepolia["Base Sepolia Testnet (Chain ID 84532)\nPatelaEscrow.sol + PatelaTestUSD.sol"]
    AiModel["LLM Provider API (Structured Deliverable Evaluation)"]
  end

  NextWeb <-->|"HTTPS REST (/api/v1) + HttpOnly Session"| NestAPI
  NextWeb <-->|"Pre-signed Upload/Download URLs"| ObjectStore
  NextWeb -->|"Prompt Signature / Tx Signing"| WalletExt
  WalletExt -->|"JSON-RPC Tx Broadcast"| BaseSepolia

  NestAPI <-->|"Prisma Transactions + Outbox"| Postgres
  NestAPI <-->|"Enqueue Jobs & Cache"| Redis
  NestAPI <-->|"Generate Signed URLs"| ObjectStore

  BullWorker <-->|"Consume Queues"| Redis
  BullWorker <-->|"Read/Write Reconciled State"| Postgres
  BullWorker -->|"Read Submission Artifacts"| ObjectStore
  BullWorker <-->|"Structured Prompt + JSON Schema"| AiModel
  BullWorker <-->|"viem getLogs / getTransactionReceipt"| BaseSepolia
```

---

## 3. Diagram 2: End-to-End Client-to-Freelancer Project Lifecycle

```mermaid
sequenceDiagram
  autonumber
  actor Client
  actor Freelancer
  participant API as NestJS API & PostgreSQL
  participant S3 as Private S3 Storage
  participant Worker as BullMQ Worker (AI & Indexer)
  participant Chain as Base Sepolia (PatelaEscrow.sol)

  Client->>API: Publish Job (scope, deliverables, milestones, budget)
  Freelancer->>API: Submit Application / Proposal
  Client->>API: Accept Proposal & Finalize ProjectAgreement
  API-->>Client: Project Created (Status: AWAITING_ESCROW)

  Client->>Chain: approve(pUSD) + fundMilestone(projectId, mId, amount)
  Chain-->>Worker: Emit MilestoneFunded(projectId, mId, amount)
  Worker->>API: Reconcile Escrow & Update Milestone -> FUNDED

  Freelancer->>S3: Upload Deliverable Files via Pre-signed URL
  Freelancer->>API: Submit Milestone (file keys, links, delivery note)
  API->>Worker: Enqueue AI Deliverable Review Job

  Worker->>S3: Fetch & Extract Deliverable Evidence
  Worker->>API: Save Structured AiReview Report (PASS / FAIL / INCONCLUSIVE)
  API-->>Client: Notify: Submission & Advisory AI Report Ready

  alt Client Approves Milestone
    Client->>Chain: approveMilestone(projectId, mId)
    Chain->>Chain: Transfer Net Payout to Freelancer + Fee to Treasury
    Chain-->>Worker: Emit MilestoneReleased(projectId, mId, netAmount, fee)
    Worker->>API: Reconcile Transaction & Mark Milestone -> RELEASED
  else Client Requests Revision
    Client->>API: Request Revision (structured feedback)
    API-->>Freelancer: Milestone -> REVISION_REQUESTED (Escrow stays locked)
  else Client or Freelancer Raises Dispute
    Client->>Chain: raiseDispute(projectId, mId)
    Chain-->>Worker: Emit DisputeRaised(projectId, mId)
    Worker->>API: Freeze Milestone -> DISPUTED & Open Arbitrator Case
  end
```

---

## 4. Diagram 3: Milestone State Machine Lifecycle

```mermaid
stateDiagram-v2
  [*] --> NOT_FUNDED: Agreement Created
  NOT_FUNDED --> FUNDED: On-Chain MilestoneFunded Reconciled
  NOT_FUNDED --> CANCELLED: Agreement Cancelled Before Funding
  FUNDED --> IN_PROGRESS: Freelancer Starts Work
  FUNDED --> SUBMITTED: Deliverables Uploaded
  IN_PROGRESS --> SUBMITTED: Deliverables Uploaded
  SUBMITTED --> UNDER_AI_REVIEW: AI Review Job Started
  UNDER_AI_REVIEW --> AWAITING_CLIENT_APPROVAL: AI Report Saved (Pass/Fail/Inconclusive)
  AWAITING_CLIENT_APPROVAL --> APPROVED: Client Signs approveMilestone
  AWAITING_CLIENT_APPROVAL --> REVISION_REQUESTED: Client Requests Revision
  REVISION_REQUESTED --> SUBMITTED: Freelancer Uploads New Version (v2+)
  FUNDED --> DISPUTED: Either Party Calls raiseDispute
  IN_PROGRESS --> DISPUTED: Either Party Calls raiseDispute
  AWAITING_CLIENT_APPROVAL --> DISPUTED: Either Party Calls raiseDispute
  REVISION_REQUESTED --> DISPUTED: Either Party Calls raiseDispute
  APPROVED --> RELEASED: On-Chain MilestoneReleased Reconciled
  DISPUTED --> RELEASED: Arbitrator Resolves for Freelancer
  DISPUTED --> REFUNDED: Arbitrator Resolves for Client
  DISPUTED --> SPLIT_SETTLED: Arbitrator Resolves Split Payout
  FUNDED --> REFUNDED: Authorized Mutual Refund
```

---

## 5. Diagram 4: Escrow Funding, Custody & Release Lifecycle

```mermaid
flowchart LR
  subgraph ClientSide["1. Client Wallet"]
    CW["Client Verified Wallet\n(pUSD Test Token)"]
  end

  subgraph ContractCustody["2. PatelaEscrow.sol (Base Sepolia 84532)"]
    Vault["Isolated Milestone Vault\nLocked Balance = Funded - Released - Refunded"]
    Guard["Invariants:\n- No double payout\n- Freeze if DISPUTED\n- Exact base-unit math"]
  end

  subgraph Settlement["3. Authorized Settlement"]
    FW["Freelancer Verified Wallet\n(Net Payout = Gross - Fee)"]
    TW["Protocol Fee Recipient\n(Configurable bps)"]
    RW["Client Wallet\n(On Authorized Refund)"]
  end

  CW -->|"1. ERC20 approve + fundMilestone"| Vault
  Vault --- Guard
  Vault -->|"2a. Client approveMilestone OR Arbitrator resolveDispute"| FW
  Vault -->|"2b. Protocol Fee (e.g. 1.5%)"| TW
  Vault -->|"2c. Mutual Refund OR Arbitrator Client Refund"| RW
```

---

## 6. Diagram 5: AI Deliverable Review Pipeline

```mermaid
flowchart TD
  Sub["Freelancer Creates Submission (vN)"] --> Outbox["Transactional Outbox -> BullMQ 'ai-review' Queue"]
  Outbox --> Ingest["1. Ingestion & Criteria Loader\nLoad Milestone Deliverables + Criterion Version"]
  Ingest --> Extract["2. Safe Evidence Extractor\nInspect PDFs/Docs, Images, Code Zips, Accessible URLs"]
  Extract --> CheckInspectable{"Can All Artifacts Be Inspected?"}
  CheckInspectable -->|"Unreachable URL / Corrupt Binary"| FlagLimitation["Record Explicit Limitation\n(Never Fabricate Verification)"]
  CheckInspectable -->|"Inspectable"| Evaluate["3. Requirement Evaluator\nCompare Evidence vs. Agreed Deliverables"]
  FlagLimitation --> Evaluate
  Evaluate --> Validate["4. Zod Output Schema Validator\nEnforce PASS | FAIL | INCONCLUSIVE per Criterion"]
  Validate --> Persist["5. Persist Immutable AiReview Record\nStore Model ID, Prompt Version, Confidence, Tokens"]
  Persist --> Notify["6. Transition Milestone -> AWAITING_CLIENT_APPROVAL\nNotify Client & Freelancer (Zero Fund Movement)"]
```

---

## 7. Diagram 6: Dispute Resolution Lifecycle

```mermaid
flowchart TD
  Trigger["Client or Freelancer Raises Dispute"] --> OnChainLock["1. On-Chain raiseDispute(projectId, mId)\nContract Locks Milestone Against Ordinary Approval"]
  OnChainLock --> OpenCase["2. Backend Creates Dispute Record (Status: OPEN)\nNotifies Counterparty & Arbitrator Queue"]
  OpenCase --> Evidence["3. Evidence Collection Window (STATUS: UNDER_REVIEW)\nClient & Freelancer Upload Statements & Files to Private S3"]
  Evidence --> ArbReview["4. Human Arbitrator Inspection\nReviews Signed Agreement, Submission Versions, AI Report & Evidence"]
  ArbReview --> Decision{"5. Arbitrator Decision"}
  Decision -->|"Full Release to Freelancer"| TxRelease["Arbitrator Executes resolveDispute(release=100%, refund=0%)"]
  Decision -->|"Full Refund to Client"| TxRefund["Arbitrator Executes resolveDispute(release=0%, refund=100%)"]
  Decision -->|"Split Settlement"| TxSplit["Arbitrator Executes resolveDispute(freelancerAmt, clientAmt)"]
  TxRelease --> Reconcile["6. Indexer Confirms DisputeResolved Event\nMarks Dispute RESOLVED & Updates Ledger"]
  TxRefund --> Reconcile
  TxSplit --> Reconcile
```

---

## 8. Diagram 7: Blockchain Event Synchronization & Reconciliation

```mermaid
flowchart TD
  FrontendTx["Frontend Submits Signed Tx via wagmi"] --> RecordSubmitted["POST /api/v1/transactions/track\nDB Status: SUBMITTED (Untrusted)"]
  RecordSubmitted --> ReceiptPoller["BullMQ Indexer Polls Base Sepolia RPC\n(eth_getTransactionReceipt & eth_getLogs)"]
  ReceiptPoller --> StatusCheck{"Receipt Status?"}
  StatusCheck -->|"Pending in Mempool"| KeepPending["DB Status: PENDING"]
  StatusCheck -->|"status == 0x0"| MarkReverted["DB Status: REVERTED\nUnlock UI & Notify User"]
  StatusCheck -->|"Dropped / Replaced"| MarkReplaced["DB Status: DROPPED / REPLACED"]
  StatusCheck -->|"status == 0x1 (1 Block)"| MarkConfirmed["DB Status: CONFIRMED\nWait for Confirmation Depth (N=2+ blocks)"]
  MarkConfirmed --> ReorgCheck{"Canonical Chain Hash Matches?"}
  ReorgCheck -->|"Block Hash Mismatch (Reorg)"| RollbackReorg["Mark Event REORGED\nRe-evaluate Escrow Balance from Canonical Logs"]
  ReorgCheck -->|"Canonical & Verified Event Log"| ReconcileDB["DB Status: RECONCILED\nUpdate Escrow & Milestone Balances Atomically"]
```

