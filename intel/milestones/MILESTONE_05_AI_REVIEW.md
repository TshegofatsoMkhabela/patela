# Milestone 05: AI Deliverable Review

## Objective
Implement Patela's asynchronous, advisory AI Deliverable Review System (`apps/worker/src/ai-review`) that inspects freelancer submissions against the milestone's agreed deliverable criteria and produces a structured, versioned, auditable verification report without ever having autonomous authority to release funds.

## Scope
- Implement `AiReview` persistence, BullMQ `ai-review` queue processor, and safe evidence extraction for documents, images, code archives, and public URLs.
- Validate LLM structured outputs with Zod (`PASS`, `FAIL`, `INCONCLUSIVE` per deliverable criterion).
- Record confidence scores, explicit inspection limitations, model/prompt/criteria versions, and retry/fallback states.
- Connect the AI Verification Report UI in the Project Workspace, Submissions page, and Full-Screen Milestone Workspace to `/api/v1/submissions/:id/ai-review`.

## Dependencies
- [`MILESTONE_03_PROJECT_MANAGEMENT.md`](./MILESTONE_03_PROJECT_MANAGEMENT.md) and [`MILESTONE_04_WALLET_AND_ESCROW.md`](./MILESTONE_04_WALLET_AND_ESCROW.md).

## Tasks
- [ ] `AI-001`: Review criteria & Zod output schema specification (`packages/validation`).
- [ ] `AI-002`: Transactional outbox trigger enqueuing `ai-review` job on submission creation.
- [ ] `AI-003`: Safe Deliverable Evidence Extractor (PDF/text/JSON, images, bounded `.zip` code trees, SSRF-safe public URL check).
- [ ] `AI-004`: `AiReviewProcessor` worker & provider-agnostic LLM adapter.
- [ ] `AI-005`: Structured `AiReview` persistence (`modelName`, `promptVersion`, `criteriaVersion`, `confidenceScore`, `limitations`).
- [ ] `AI-006`: Per-requirement evaluation logic ensuring uninspectable items are marked `INCONCLUSIVE`.
- [ ] `AI-007`: Review history across submission versions (`v1`, `v2`, etc.).
- [ ] `AI-008`: Exponential backoff retries, timeout handling, and non-blocking manual review fallback.
- [ ] `AI-009`: Human review escalation flag (`/api/v1/submissions/:id/ai-review/escalate`).
- [ ] `AI-010`: Unit & integration test suite covering evidence extraction, schema validation, and prompt-injection defense.

## Technical Implementation
- When a `Submission` is created, the milestone transitions to `UNDER_AI_REVIEW` and an `OutboxEvent` dispatches a BullMQ job.
- The worker downloads files from private S3, extracts bounded evidence ($\le 64,000$ chars), evaluates each `ReviewCriterion`, validates the JSON output with Zod, writes an immutable `AiReview` row, and transitions the milestone to `AWAITING_CLIENT_APPROVAL`.
- **Critical Rule:** Completing an AI review **never** invokes the smart contract or releases funds.

## Database Changes
- Activates `AiReview` and `ReviewCriterion` tables.

## API Changes
- Implements `GET /api/v1/submissions/:submissionId/ai-review` and `POST /api/v1/submissions/:submissionId/ai-review/retry`.

## Frontend Changes
- Replaces `demoReview()` in `src/lib/patela-store.ts` with real structured `AiReview` reports displaying passed/failed/inconclusive checks, evidence inspected, confidence score, and limitations.

## Backend Changes
- Introduces `apps/api/src/reviews/*` and `apps/worker/src/ai-review/*`.

## Blockchain Changes
- None (AI review is strictly off-chain advisory evidence; optionally records `reviewReportHash` off-chain/on-chain for auditability).

## Security Considerations
- Defend against prompt injection by isolating file contents inside non-executable XML/JSON data blocks.
- Protect URL fetcher against SSRF (block private/loopback IP ranges `127.0.0.0/8`, `10.0.0.0/8`, `169.254.169.254`, etc.) and never attempt to bypass CAPTCHAs or auth gates.
- Protect archive extractor against zip bombs and path traversal (`../`).

## Testing Requirements
- Unit tests for evidence extractor (valid files, oversized zip rejection, SSRF IP blocking, unreachable URL -> `INCONCLUSIVE`).
- Worker integration tests verifying `PASS`, `FAIL`, `INCONCLUSIVE`, and `ERROR` fallback states and confirming zero fund movement on `PASS`.

## Acceptance Criteria
1. Submitting deliverables triggers an asynchronous AI review that compares evidence against the milestone's agreed deliverables.
2. Uninspectable files/links are honestly reported as `INCONCLUSIVE` under `limitations`.
3. Passing AI review transitions the milestone to `AWAITING_CLIENT_APPROVAL` and waits for explicit client approval.

## Implementation History
- None yet (`PLANNED`).

## Known Issues
- Resolves `ISS-001` (Simulated AI Review Auto-Approves Milestone).

## Current Status
`PLANNED`

## Completion Evidence
- Pending implementation.

