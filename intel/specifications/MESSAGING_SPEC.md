# Project Messaging & Communication Specification

> **Classification:** Feature Technical Specification  
> **Status:** `Prototype Only` (`html/messages.html` local browser thread; missing in `src/`)  
> **Target Milestone:** [MILESTONE_03_PROJECT_MANAGEMENT.md](../milestones/MILESTONE_03_PROJECT_MANAGEMENT.md)  
> **Last Updated:** 2026-11-09  

---

## 1. Current Repository State

- **`src/` (Next.js App):** No messaging feature exists.
- **`html/` (Dashboard Prototype):** `html/messages.html` implements a 2-pane project workspace messenger with conversation switching, search filter, message composer, milestone context banners, and simulated automated replies in `localStorage`.

---

## 2. Domain Model

Referenced Prisma tables in [../07_DATABASE_ARCHITECTURE.md](../07_DATABASE_ARCHITECTURE.md):
- `Conversation`: Scoped 1:1 to a `Project` (`projectId`) or pre-contract shortlisted `Application` (`applicationId`).
- `ConversationParticipant`: Tracks `userId`, `lastReadAt`, and `unreadCount`.
- `Message`: Individual message record (`id`, `conversationId`, `senderId`, `messageType: 'USER' | 'SYSTEM_EVENT'`, `bodyMarkdown`, `relatedMilestoneId`, `attachmentsJson`, `createdAt`).

---

## 3. Functional Requirements

### 3.1 Project-Scoped Threads & System Events
- Every active `Project` automatically provisions a dedicated `Conversation` thread between `project.clientId` and `project.freelancerId`.
- **Auditability for Disputes:** Project threads are append-only (`Message` rows cannot be hard-deleted) so that communication history remains intact if a milestone enters arbitration.
- **Automated System Event Cards (`SYSTEM_EVENT`):** When key lifecycle events occur (`Milestone #2 Funded (3,500 USDC)`, `Submission v1.1 Uploaded`, `AI Review Completed: 94/100`, `Revision Requested`), the backend inserts an inline `SYSTEM_EVENT` message card in the project conversation timeline.

### 3.2 Real-Time Delivery (Socket.IO)
- Authenticated WebSocket namespace `/ws` joins the user to rooms `conversation:<conversationId>`.
- Sending a message via `POST /api/v1/conversations/:id/messages` (or WebSocket `message:send`) persists the message to PostgreSQL, increments `unreadCount` for the recipient, and broadcasts `message:new` in real time.
- Opening a thread calls `POST /api/v1/conversations/:id/read` to reset `unreadCount = 0` and update `lastReadAt`.

---

## 4. API Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/conversations` | JWT | List user's conversations ordered by `lastMessageAt DESC` |
| `GET` | `/api/v1/conversations/:id/messages` | JWT (Participant) | Cursor-paginated message history for a conversation |
| `POST` | `/api/v1/conversations/:id/messages` | JWT (Participant) | Send a text/attachment message in a conversation |
| `POST` | `/api/v1/conversations/:id/read` | JWT (Participant) | Mark all messages in conversation as read |

---

## 5. Acceptance Criteria

- [ ] Users who are not participants in a `Conversation` (and not `ADMIN` reviewing a dispute) receive `403 Forbidden`.
- [ ] Messages are sanitized on output and rendered safely without XSS vectors.
- [ ] Real-time unread badge counts in the sidebar navigation update immediately when a new message arrives.

