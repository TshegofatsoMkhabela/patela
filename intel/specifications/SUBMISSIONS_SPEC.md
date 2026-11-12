# Deliverable Submissions & Evidence Specification

> **Classification:** Feature Technical Specification  
> **Status:** `Prototype Only` (`src/app/jobs/[jobId]/job-view.tsx`, `html/submissions.html`)  
> **Target Milestone:** [MILESTONE_03_PROJECT_MANAGEMENT.md](../milestones/MILESTONE_03_PROJECT_MANAGEMENT.md)  
> **Last Updated:** 2026-11-09  

---

## 1. Current Repository State

- **`src/` (Next.js App):** Accepts a single `deliverableSummary` text string and `deliverableUrl` string in `submitMilestone()`, storing them in `localStorage`.
- **`html/` (Dashboard Prototype):** `html/submissions.html` renders rich submission cards with version numbers (`v1.0`, `v1.2`), linked repository URLs, file attachments, AI verification score rings, and a `Submit Deliverable` modal in Worker View.

---

## 2. Target Submission Architecture

Each milestone supports **versioned submissions** (`v1`, `v2`, `v3`, ...). When a client requests revisions (`REVISION_REQUESTED`), the freelancer creates a new `MilestoneSubmission` with `versionNumber = previous.versionNumber + 1` rather than overwriting previous evidence.

### 2.1 Evidence Bundle Structure
Every `MilestoneSubmission` record (`milestone_submissions` table) contains:
- `versionNumber`: Sequential integer starting at `1`.
- `summaryMarkdown`: Explanation of work completed against each acceptance criterion (min 50 chars).
- `repositoryUrl`: Optional GitHub/GitLab URL (`https://...`).
- `commitHash`: Optional 40-char git commit SHA for immutable code verification.
- `deploymentUrl`: Optional live preview URL (`https://...`).
- `checklistCompletionJson`: Mapping of each milestone acceptance criterion to `{ completed: boolean, evidenceNote: string }`.
- `bundleSha256`: Canonical SHA-256 hash computed over the submission metadata and attachment SHA-256 digests, anchoring the submission for AI verification and dispute auditability.
- `files[]` (`SubmissionFile` rows): Uploaded artifacts stored in S3/Cloudflare R2 (`pdf`, `zip`, `png`, `jpg`, `webp`, `md`, `json`, `txt`, max `50 MB` per file, max 10 files per submission).

---

## 3. Presigned S3 Upload Flow

1. Freelancer requests `POST /api/v1/submissions/upload-url` with `{ milestoneId, fileName, mimeType, sizeBytes, sha256Hash }`.
2. Backend validates file extension, MIME type whitelist, size limit ($\le 50\text{ MB}$), and verifies the caller is `project.freelancerId`.
3. Backend returns a short-lived (`10 min`) presigned S3 `PUT` URL and `storageKey`.
4. Frontend uploads the file directly to S3/R2 and includes the `storageKey` when calling `POST /api/v1/milestones/:milestoneId/submissions`.
5. Backend persists `MilestoneSubmission` + `SubmissionFile` rows, transitions the milestone to `SUBMITTED_FOR_REVIEW`, and enqueues a BullMQ job on the `ai-verification` queue.

---

## 4. API Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/v1/submissions/upload-url` | JWT (`FREELANCER`) | Generate presigned S3 PUT URL for deliverable attachment |
| `POST` | `/api/v1/milestones/:milestoneId/submissions` | JWT (`FREELANCER`) | Create a new versioned submission and trigger async AI review |
| `GET` | `/api/v1/milestones/:milestoneId/submissions` | JWT (Participant) | List all submission versions for a milestone |
| `GET` | `/api/v1/submissions/:submissionId` | JWT (Participant) | Get full submission detail, signed download URLs, and AI report |

---

## 5. Acceptance Criteria

- [ ] Submitting work to a milestone replaces nothing in prior versions; `versionNumber` increments deterministically (`1, 2, 3...`).
- [ ] Disallowed file types (`.exe`, `.sh`, `.bat`, `.dll`, `.html` with embedded scripts) are rejected with `415 Unsupported Media Type`.
- [ ] Creating a submission automatically enqueues an `ai-verification` job without auto-approving the milestone.

