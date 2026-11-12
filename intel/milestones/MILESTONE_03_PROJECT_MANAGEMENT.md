# Milestone 03: Project Management

## Objective
Convert accepted proposals into structured, auditable project workspaces with immutable project agreements, sequential milestones, private S3-compatible deliverable file uploads, versioned submissions, client revision requests, project messaging, and lifecycle notifications.

## Scope
- Implement `Project`, `ProjectAgreement`, `Submission`, `SubmissionFile`, `RevisionRequest`, `Message`, and `Notification` services.
- Integrate private S3-compatible object storage (MinIO locally / S3 / R2) with pre-signed PUT/GET URLs and SHA-256 checksum tracking.
- Port the role-aware Project Workspace (`html/project-detail.html`), Submissions view (`html/submissions.html`), Messages view (`html/messages.html`), and full-screen project/milestone detail views into Next.js.

## Dependencies
- [`MILESTONE_02_MARKETPLACE.md`](./MILESTONE_02_MARKETPLACE.md).

## Tasks
- [ ] `PRJ-001`: `Project` and `ProjectAgreement` persistence & immutable snapshot hash (`keccak256`).
- [ ] `PRJ-002`: Agreement acceptance & amendment rules.
- [ ] `PRJ-003`: Role-aware Project Workspace UI (including 7-stage lifecycle & full-screen workspace).
- [ ] `PRJ-004`: Milestone state machine service (`MilestonesService`).
- [ ] `PRJ-005`: Interactive milestone cards & full-screen milestone workspace (`PatelaDetail.openMilestone`).
- [ ] `PRJ-006`: Deliverable & `ReviewCriterion` (v1) mapping on project creation.
- [ ] `PRJ-007`: Versioned deliverable submission workflow (`v1`, `v2`, etc.).
- [ ] `PRJ-008`: Private S3 object storage service with pre-signed URLs and MIME/size validation.
- [ ] `PRJ-009`: Client revision request workflow (`POST /api/v1/milestones/:id/request-revision`).
- [ ] `PRJ-010`: Project activity timeline, thread messaging, and outbox notifications.

## Technical Implementation
- Once `ProjectAgreement` is accepted by both parties, `scopeSnapshot`, `deliverablesSnapshot`, and `milestonesSnapshot` are locked and hashed (`agreementHash`).
- File uploads use pre-signed S3 PUT URLs scoped to `projects/{projectId}/milestones/{milestoneId}/v{version}/{uuid}-{filename}` with max size `25 MB`.
- Downloads generate short-lived (`15 min`) signed GET URLs with `Content-Disposition: attachment` only after verifying the requester is the project client, freelancer, AI worker, or assigned arbitrator.

## Database Changes
- Activates `Project`, `ProjectAgreement`, `ReviewCriterion`, `Submission`, `SubmissionFile`, `RevisionRequest`, `Message`, and `Notification` tables.

## API Changes
- Implements `/api/v1/projects/*`, `/api/v1/milestones/*`, `/api/v1/submissions/*`, `/api/v1/projects/:id/messages`, and `/api/v1/notifications/*`.

## Frontend Changes
- Connects Next.js project workspace, milestone submission forms, revision modals, messaging threads, and topbar notification center to `/api/v1`.

## Backend Changes
- Introduces `apps/api/src/projects/*`, `apps/api/src/milestones/*`, `apps/api/src/submissions/*`, `apps/api/src/messaging/*`, and `apps/api/src/notifications/*`.

## Blockchain Changes
- Computes deterministic `agreementHash` (`bytes32`) and `onChainProjectId` (`bytes32`) ready for on-chain escrow registration in Milestone 04.

## Security Considerations
- Strict participant access control (`clientId` or `freelancerId`) on all project, submission, file download, and message endpoints.
- Private S3 bucket with public access blocked; `X-Content-Type-Options: nosniff` on downloads.

## Testing Requirements
- Integration tests verifying agreement immutability, milestone state transitions, versioned submission increments (`v1` → `v2`), revision requests keeping escrow locked, and unauthorized file access rejection (`403`).

## Acceptance Criteria
1. Hired projects display their immutable agreement, 7-stage lifecycle, and milestone breakdown.
2. Freelancers can upload real files to private S3 storage and create versioned submissions on funded milestones.
3. Clients can download submitted files via signed URLs and request revisions with structured feedback.

## Implementation History
- None yet (`PLANNED`).

## Known Issues
- Resolves `ISS-005` (Deliverable file input metadata-only limitation).

## Current Status
`PLANNED`

## Completion Evidence
- Pending implementation.

