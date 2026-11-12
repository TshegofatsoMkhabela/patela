# 08 — API Documentation (`/api/v1`)

**Document Version:** 1.0  
**Last Updated:** 2026-11-09  
**Base URL Prefix:** `/api/v1`  
**Current Implementation Status:** `PLANNED` (No backend API endpoints exist in the repository yet; scheduled across Milestones `01`–`07`).

---

## 1. Global API Conventions

1. **Transport & Format:** JSON over HTTPS (`Content-Type: application/json`). All monetary values are serialized as **integer base-unit strings** (e.g., `"amountBaseUnits": "400000000"`, `"decimals": 6`, `"symbol": "pUSD"`) to prevent IEEE 754 precision loss in JSON parsers.
2. **Authentication:** Server-managed `HttpOnly; Secure; SameSite=Lax` cookie (`patela_sid`) plus `X-CSRF-Token` header on all state-changing (`POST`, `PATCH`, `PUT`, `DELETE`) requests.
3. **Idempotency:** All financial, job-creation, application, submission, and dispute-mutation `POST`/`PATCH` endpoints require an `Idempotency-Key: <uuid-v4>` header.
4. **Standard Response Envelope:**
   ```json
   {
     "data": { ... },
     "meta": { "requestId": "req_01J...", "timestamp": "2026-11-09T00:00:00Z" }
   }
   ```
5. **Standard Error Envelope:**
   ```json
   {
     "error": {
       "code": "ESCROW_INSUFFICIENT_LOCKED_BALANCE",
       "message": "Milestone cannot be approved before on-chain funding is reconciled.",
       "details": [{ "field": "milestoneId", "issue": "Current status is NOT_FUNDED" }],
       "requestId": "req_01J..."
     }
   }
   ```

---

## 2. Proposed Endpoint Catalog (`/api/v1`)

### 2.1 Authentication & Sessions (`auth`) — *Status: `PLANNED` (`M01`)*

| Method | Path | Auth / Permission | Purpose | Idempotent |
|---|---|---|---|---|
| `POST` | `/api/v1/auth/register` | Public (Rate-limited) | Register user account + create initial profile & session. | Yes (`Idempotency-Key`) |
| `POST` | `/api/v1/auth/login` | Public (Rate-limited) | Authenticate email/password and set `patela_sid` cookie. | No |
| `POST` | `/api/v1/auth/logout` | Authenticated | Revoke current `AuthSession` and clear cookie. | Yes |
| `GET` | `/api/v1/auth/me` | Authenticated | Return current user, profile, linked wallets, and active persona. | Yes |
| `POST` | `/api/v1/auth/verify-email` | Public | Verify email token (`{ token }`). | Yes |
| `POST` | `/api/v1/auth/password-reset/request` | Public (Rate-limited) | Issue password reset token. | Yes |
| `POST` | `/api/v1/auth/password-reset/confirm` | Public (Rate-limited) | Set new Argon2id password and revoke old sessions. | Yes |

### 2.2 Users, Profiles & Wallets (`users`, `wallets`) — *Status: `PLANNED` (`M01`, `M04`)*

| Method | Path | Auth / Permission | Purpose | Idempotent |
|---|---|---|---|---|
| `GET` | `/api/v1/users/profile` | Authenticated | Fetch authenticated user's profile and trust stats. | Yes |
| `PATCH` | `/api/v1/users/profile` | Authenticated | Update displayName, handle, bio, skills, activePersona. | Yes |
| `POST` | `/api/v1/users/profile/avatar-upload-url` | Authenticated | Generate pre-signed S3 upload URL for profile image. | Yes |
| `POST` | `/api/v1/wallets/nonce` | Authenticated | Generate single-use EIP-191/SIWE nonce for wallet address on Chain `84532`. | No |
| `POST` | `/api/v1/wallets/verify` | Authenticated | Verify signature (`{ address, chainId: 84532, signature }`) and link `Wallet`. | Yes (`Idempotency-Key`) |
| `DELETE` | `/api/v1/wallets/:walletId` | Authenticated (Owner) | Unlink a wallet if not bound to an active escrow agreement. | Yes |

### 2.3 Marketplace Jobs & Applications (`jobs`, `applications`) — *Status: `PLANNED` (`M02`)*

| Method | Path | Auth / Permission | Purpose | Idempotent |
|---|---|---|---|---|
| `GET` | `/api/v1/jobs` | Public / Optional Auth | List/search `OPEN` jobs (`?q=`, `?category=`, `?skill=`, `?minBudget=`, `?sort=`). | Yes |
| `POST` | `/api/v1/jobs` | Authenticated | Create a new job draft or published job (`validateJob` enforced). | Yes (`Idempotency-Key`) |
| `GET` | `/api/v1/jobs/:jobId` | Public / Optional Auth | Get full job details, deliverables, milestone schedule, and client trust summary. | Yes |
| `PATCH` | `/api/v1/jobs/:jobId` | Authenticated (`job.clientId`) | Edit a `DRAFT` or `OPEN` job (if no accepted agreement exists). | Yes |
| `POST` | `/api/v1/jobs/:jobId/publish` | Authenticated (`job.clientId`) | Transition job from `DRAFT` to `OPEN`. | Yes |
| `POST` | `/api/v1/jobs/:jobId/archive` | Authenticated (`job.clientId`) | Archive an `OPEN` job with no funded project. | Yes |
| `POST` | `/api/v1/jobs/:jobId/applications` | Authenticated (`userId != job.clientId`) | Submit freelancer proposal (`coverLetter`, `proposedAmountBaseUnits`, `estimatedDays`). | Yes (`Idempotency-Key`) |
| `GET` | `/api/v1/jobs/:jobId/applications` | Authenticated (`job.clientId`) | List all applications submitted to the client's job. | Yes |
| `POST` | `/api/v1/applications/:applicationId/accept` | Authenticated (`job.clientId`) | Accept freelancer application and instantiate `Project` + `ProjectAgreement`. | Yes (`Idempotency-Key`) |
| `POST` | `/api/v1/applications/:applicationId/reject` | Authenticated (`job.clientId`) | Reject an application. | Yes |
| `POST` | `/api/v1/applications/:applicationId/withdraw` | Authenticated (`application.freelancerId`) | Withdraw pending application. | Yes |

### 2.4 Projects, Milestones, Submissions & AI Reviews (`projects`, `milestones`, `submissions`, `reviews`) — *Status: `PLANNED` (`M03`, `M05`)*

| Method | Path | Auth / Permission | Purpose | Idempotent |
|---|---|---|---|---|
| `GET` | `/api/v1/projects` | Authenticated (Participant) | List projects where user is `clientId` or `freelancerId` (`?role=`, `?status=`). | Yes |
| `GET` | `/api/v1/projects/:projectId` | Authenticated (Participant / Admin) | Get full project workspace: agreement, milestones, escrow, AI reports, timeline. | Yes |
| `POST` | `/api/v1/milestones/:milestoneId/upload-urls` | Authenticated (`project.freelancerId`) | Generate private S3 pre-signed PUT URLs for deliverable files. | Yes (`Idempotency-Key`) |
| `POST` | `/api/v1/milestones/:milestoneId/submissions` | Authenticated (`project.freelancerId`) | Create versioned `Submission` (`files`, `externalLinks`, `deliveryNote`) & enqueue AI review. | Yes (`Idempotency-Key`) |
| `GET` | `/api/v1/milestones/:milestoneId/submissions` | Authenticated (Participant / Arbitrator) | List submission versions and signed download URLs for a milestone. | Yes |
| `POST` | `/api/v1/milestones/:milestoneId/request-revision` | Authenticated (`project.clientId`) | Request revision with structured feedback; keeps escrow locked. | Yes (`Idempotency-Key`) |
| `GET` | `/api/v1/submissions/:submissionId/ai-review` | Authenticated (Participant / Arbitrator) | Retrieve structured `AiReview` report for a specific submission version. | Yes |
| `POST` | `/api/v1/submissions/:submissionId/ai-review/retry` | Authenticated (Participant / Admin) | Re-enqueue failed/timed-out AI review job. | Yes (`Idempotency-Key`) |

### 2.5 Escrow, Transactions & Disputes (`escrow`, `transactions`, `disputes`) — *Status: `PLANNED` (`M04`, `M06`)*

| Method | Path | Auth / Permission | Purpose | Idempotent |
|---|---|---|---|---|
| `POST` | `/api/v1/projects/:projectId/escrow/prepare` | Authenticated (`project.clientId`) | Return deterministic `onChainProjectId`, contract address (`84532`), and encoded parameters for `createProject` / `fundMilestone`. | Yes |
| `POST` | `/api/v1/transactions/track` | Authenticated (Participant) | Register a submitted `txHash` (`SUBMITTED` state) for immediate indexer polling. | Yes (`Idempotency-Key`) |
| `GET` | `/api/v1/transactions` | Authenticated (Participant / Admin) | Filterable transaction ledger (`?type=`, `?status=`, `?projectId=`, `?from=`, `?to=`). | Yes |
| `GET` | `/api/v1/transactions/:txId` | Authenticated (Participant / Admin) | Full transaction receipt, custody flow nodes, fee breakdown, and Base Sepolia metadata. | Yes |
| `POST` | `/api/v1/milestones/:milestoneId/disputes` | Authenticated (`clientId` or `freelancerId`) | Open a `Dispute` record linked to on-chain `raiseDispute` transaction. | Yes (`Idempotency-Key`) |
| `POST` | `/api/v1/disputes/:disputeId/evidence` | Authenticated (Participant) | Submit statement and private S3 evidence attachment to an open dispute. | Yes (`Idempotency-Key`) |
| `POST` | `/api/v1/disputes/:disputeId/resolve` | Authenticated (`ARBITRATOR` / `ADMIN`) | Record arbitrator decision and track on-chain `resolveDispute` settlement transaction. | Yes (`Idempotency-Key`) |

### 2.6 Messaging, Notifications, Analytics & Admin (`messages`, `notifications`, `analytics`, `admin`) — *Status: `PLANNED` (`M03`, `M07`)*

| Method | Path | Auth / Permission | Purpose | Idempotent |
|---|---|---|---|---|
| `GET` | `/api/v1/projects/:projectId/messages` | Authenticated (Participant / Arbitrator) | Fetch paginated project messages. | Yes |
| `POST` | `/api/v1/projects/:projectId/messages` | Authenticated (Participant) | Post message in project thread. | Yes (`Idempotency-Key`) |
| `GET` | `/api/v1/notifications` | Authenticated | List user notifications and unread count. | Yes |
| `POST` | `/api/v1/notifications/mark-all-read` | Authenticated | Mark all unread notifications for the user as read. | Yes |
| `GET` | `/api/v1/analytics/client` | Authenticated | Reconciled client spending time-series (`?range=7d\|30d\|3m\|6m\|12m\|all`), category breakdown, and escrow allocation. | Yes |
| `GET` | `/api/v1/analytics/worker` | Authenticated | Reconciled freelancer earnings time-series, custody breakdown, and delivery KPIs. | Yes |
| `GET` | `/api/v1/admin/overview` | Authenticated (`ADMIN`) | Platform-wide operational metrics, active disputes, AI review health, and fee totals. | Yes |

