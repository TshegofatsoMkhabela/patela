# Milestone 07: Analytics and Administration

## Objective
Connect Patela's Client and Freelancer financial dashboards, interactive SVG charts, and transaction ledgers to real, reconciled PostgreSQL and Base Sepolia data, and build the platform Administration console for operational oversight, moderation, and audit logging.

## Scope
- Implement `AnalyticsService` (`/api/v1/analytics/client`, `/api/v1/analytics/worker`) computing time-series spending/earnings, category breakdowns, and non-overlapping escrow custody allocations from reconciled `Escrow`, `EscrowMilestone`, and `Transaction` records.
- Port the Client Overview (`html/client-dashboard.html`), Worker Overview (`html/worker-dashboard.html`), Analytics (`html/analytics.html`), and Payments (`html/payments.html`) views into Next.js backed by live API data.
- Build the Admin Console (`/admin` + `/api/v1/admin/*`) for user management, job moderation, project/escrow monitoring, AI review queue health, dispute assignment, platform fee reporting, and `ActivityLog` auditing.

## Dependencies
- [`MILESTONE_04_WALLET_AND_ESCROW.md`](./MILESTONE_04_WALLET_AND_ESCROW.md), [`MILESTONE_05_AI_REVIEW.md`](./MILESTONE_05_AI_REVIEW.md), and [`MILESTONE_06_DISPUTE_RESOLUTION.md`](./MILESTONE_06_DISPUTE_RESOLUTION.md).

## Tasks
- [ ] `ANA-001`: Reconciled `BigInt` financial aggregation service (`apps/api/src/analytics/*`).
- [ ] `ANA-002`: Client Overview & Financial Analytics Next.js integration.
- [ ] `ANA-003`: Freelancer Overview & Earnings Analytics Next.js integration.
- [ ] `ANA-004`: Non-overlapping escrow allocation bars & 7-stage financial flow diagram bound to live state.
- [ ] `ANA-005`: Filterable Transaction Ledger & Full-Screen Transaction Receipt (`PatelaDetail.openTransaction`) with BaseScan Sepolia links.
- [ ] `ANA-006`: Administrative oversight dashboard (`/admin` + `GET /api/v1/admin/overview`).
- [ ] `ANA-007`: Admin user, job, and dispute moderation actions with mandatory `ActivityLog` entries.
- [ ] `ANA-008`: Financial reconciliation & analytics accuracy test suite.

## Technical Implementation
- All aggregations sum integer base units (`BIGINT`) in PostgreSQL and verify the non-overlapping identity:
  $$\text{Total Deposited} = \text{Active Locked} + \text{Awaiting Approval} + \text{Released} + \text{Refunded}$$
- Never mix simulated demo figures with real authenticated user figures; authenticated accounts with zero activity see clean empty states (`0.00 pUSD`).

## Database Changes
- Adds read-optimized composite indexes on `Transaction(initiatedById, status, createdAt)` and `EscrowMilestone(onChainStatus)` if needed.

## API Changes
- Implements `/api/v1/analytics/client`, `/api/v1/analytics/worker`, and `/api/v1/admin/*`.

## Frontend Changes
- Completes the migration of all 12 screens from the `html/` prototype into authenticated Next.js routes with the collapsible sidebar (`236px` ↔ `72px`) and full-screen detail workspaces.

## Backend Changes
- Introduces `apps/api/src/analytics/*` and `apps/api/src/admin/*`.

## Blockchain Changes
- None (reads reconciled `Escrow`, `Transaction`, and `BlockchainEvent` tables).

## Security Considerations
- Client analytics only aggregate projects where `project.clientId == currentUser.id`; Worker analytics only aggregate projects where `project.freelancerId == currentUser.id`.
- All `/api/v1/admin/*` routes enforce `@Roles('ADMIN')` and record actor IP and reason in `ActivityLog`.

## Testing Requirements
- Unit & integration tests verifying that `totalDeposited == locked + awaitingApproval + released + refunded` across all project states and that cross-user data leakage is impossible.

## Acceptance Criteria
1. Client and Freelancer dashboards and interactive SVG charts (`7d`, `30d`, `3m`, `6m`, `12m`, `all`) reflect exact reconciled database and Base Sepolia records.
2. Clicking any KPI metric card or transaction row opens its full-screen breakdown or receipt workspace.
3. Administrators can monitor platform activity, fees, AI reviews, and disputes from `/admin`.

## Implementation History
- None yet (`PLANNED`).

## Known Issues
- Resolves `ISS-007` (Unifies `html/` dashboard prototype into Next.js) and `ISS-009` (Prunes unused UI wrappers).

## Current Status
`PLANNED`

## Completion Evidence
- Pending implementation.

