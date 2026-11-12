# Notifications & Activity Feed Specification

> **Classification:** Feature Technical Specification  
> **Status:** `Prototype Only` (`html/notifications.html` in-memory/localStorage feed)  
> **Target Milestone:** [MILESTONE_07_ANALYTICS_AND_ADMIN.md](../milestones/MILESTONE_07_ANALYTICS_AND_ADMIN.md)  
> **Last Updated:** 2026-11-09  

---

## 1. Current Repository State

- **`src/` (Next.js App):** No notification system exists.
- **`html/` (Dashboard Prototype):** `html/notifications.html` and the topbar notification bell provide category filtering (`All`, `Escrow & Payments`, `AI Verification`, `Projects & Milestones`, `Disputes`), unread indicators, `Mark all as read`, and full-screen notification detail views.

---

## 2. Notification Categories & Trigger Events

| Category | Trigger Event | Recipient(s) | Deep Link Target |
|---|---|---|---|
| `ESCROW_PAYMENT` | Milestone funded on Base Sepolia (`MilestoneFunded`) | Freelancer, Client | `/dashboard/milestones/:id` |
| `ESCROW_PAYMENT` | Milestone approved & released (`MilestoneReleased`) | Freelancer, Client | `/dashboard/transactions/:txId` |
| `SUBMISSION` | Freelancer submits new deliverable version (`vN`) | Client | `/dashboard/submissions/:id` |
| `SUBMISSION` | Client requests milestone revisions | Freelancer | `/dashboard/milestones/:id` |
| `AI_REVIEW` | AI verification report completed (`COMPLETED`) | Client, Freelancer | `/dashboard/ai-reviews/:reportId` |
| `APPLICATION` | New freelancer proposal received on open job | Client | `/dashboard/jobs/:jobId` |
| `APPLICATION` | Proposal accepted and contract created | Freelancer | `/dashboard/projects/:projectId` |
| `DISPUTE` | Dispute opened or arbitrator ruling recorded | Client, Freelancer, Admin | `/dashboard/disputes/:disputeId` |
| `MESSAGE` | New direct message while user is offline/away | Recipient | `/dashboard/messages?c=:convId` |

---

## 3. Delivery Architecture

1. Domain services emit an internal event or enqueue a job on the `notifications` BullMQ queue.
2. The Notification Service writes a persistent `Notification` row (`notifications` table) with `{ userId, category, title, body, actionUrl, metadataJson, readAt: null }`.
3. The Socket.IO gateway pushes `notification:new` to the user's private room `user:<userId>` so the topbar bell badge and toast update immediately without polling.

---

## 4. API Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/notifications` | JWT | List paginated notifications (filterable by `category` and `unreadOnly`) |
| `GET` | `/api/v1/notifications/unread-count` | JWT | Return unread count by category |
| `PATCH` | `/api/v1/notifications/:id/read` | JWT (Owner) | Mark a single notification as read |
| `POST` | `/api/v1/notifications/read-all` | JWT | Mark all unread notifications for the user as read |

---

## 5. Acceptance Criteria

- [ ] Every escrow deposit, submission, AI report completion, and dispute state change generates a persistent notification for the affected counterparty.
- [ ] Clicking a notification marks it as read (`readAt = NOW()`) and navigates directly to the linked resource.

