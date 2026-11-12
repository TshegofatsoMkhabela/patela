# Milestone 02: Marketplace

## Objective
Transform Patela's client-side demo marketplace into a persistent, database-backed freelance marketplace supporting structured job creation, deliverable definitions, milestone scheduling, job discovery/search/filtering, freelancer proposals, and client hiring.

## Scope
- Implement `Job`, `JobSkill`, `Milestone`, `Deliverable`, and `Application` models and `/api/v1/jobs` & `/api/v1/applications` endpoints.
- Enforce exact integer base-unit budget validation (`sum(milestones.amountBaseUnits) == job.budgetBaseUnits`).
- Connect Next.js `/post-job`, `/marketplace`, and `/jobs/[jobId]` (including full-screen job opportunity workspace) to the backend API.
- Implement the freelancer proposal and client hiring workflow.

## Dependencies
- [`MILESTONE_01_AUTH_AND_DATABASE.md`](./MILESTONE_01_AUTH_AND_DATABASE.md).

## Tasks
- [ ] `MKT-001`: `Job`, `JobSkill`, `Milestone`, `Deliverable`, and `Application` Prisma models & repositories.
- [ ] `MKT-002`: Job creation API (`POST /api/v1/jobs`) and 5-step wizard integration.
- [ ] `MKT-003`: Job editing (`PATCH /api/v1/jobs/:jobId`) for `DRAFT` and unhired `OPEN` jobs.
- [ ] `MKT-004`: Job publishing (`DRAFT → OPEN`) and archiving (`OPEN → ARCHIVED`).
- [ ] `MKT-005`: Marketplace job discovery endpoint (`GET /api/v1/jobs`).
- [ ] `MKT-006`: Keyword search, category/skill/budget filtering, and sorting.
- [ ] `MKT-007`: Full-screen job opportunity detail workspace (`PatelaDetail.openJob` ported to Next.js).
- [ ] `MKT-008`: Freelancer application submission (`POST /api/v1/jobs/:jobId/applications`).
- [ ] `MKT-009`: Client application review, shortlisting, and rejection.
- [ ] `MKT-010`: Hiring workflow (`POST /api/v1/applications/:applicationId/accept`) creating `Project` + `ProjectAgreement`.

## Technical Implementation
- Enforce job state transitions: `DRAFT → OPEN → HIRED` (or `ARCHIVED`).
- Enforce application state transitions: `SUBMITTED → SHORTLISTED → ACCEPTED | REJECTED` (or `WITHDRAWN` by freelancer).
- When `accept` is called on an application, run a serializable PostgreSQL transaction that marks the job `HIRED`, marks the accepted application `ACCEPTED`, marks other pending applications `REJECTED`, and creates `Project`, `ProjectAgreement`, and `Milestone` records.

## Database Changes
- Activates `Job`, `JobSkill`, `Application`, `Milestone`, and `Deliverable` tables and indexes.

## API Changes
- Implements `/api/v1/jobs/*` and `/api/v1/applications/*`.

## Frontend Changes
- Replaces `localStorage` reads/writes in `/marketplace`, `/post-job`, and `/jobs/[jobId]` with API queries/mutations and adds the full-screen job detail workspace and proposal management UI.

## Backend Changes
- Introduces `apps/api/src/jobs/*` and `apps/api/src/applications/*`.

## Blockchain Changes
- None in this milestone (jobs are created and hired off-chain; escrow funding occurs in Milestone 04 after agreement acceptance).

## Security Considerations
- Verify `job.clientId == currentUser.id` on job edits and application reviews.
- Block self-hiring (`application.freelancerId != job.clientId`).
- Enforce `UNIQUE(jobId, freelancerId)` on applications and `Idempotency-Key` on job/application creation.

## Testing Requirements
- Unit tests for `BigInt` milestone sum validation and job/application state machines.
- API integration tests for job CRUD, search/filtering, duplicate proposal prevention, self-application rejection, and atomic hiring transaction.

## Acceptance Criteria
1. Clients can create, validate, publish, edit, and archive jobs persisted in PostgreSQL.
2. Freelancers can search/filter open jobs, open the full-screen job workspace, and submit a proposal.
3. Clients can review proposals and accept one to instantiate a structured project.

## Implementation History
- None yet (`PLANNED`).

## Known Issues
- Partially addresses `ISS-003` and `ISS-004` for the Marketplace domain.

## Current Status
`PLANNED`

## Completion Evidence
- Pending implementation.

