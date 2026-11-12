# Milestone 06: Dispute Resolution

## Objective
Establish a fair, transparent, human-arbitrated dispute workflow that freezes disputed milestone funds in `PatelaEscrow.sol` (`raiseDispute`), collects structured evidence from both client and freelancer, and allows only an authorized human arbitrator (`ARBITRATOR` / `ADMIN`) to execute on-chain settlement (`resolveDispute`).

## Scope
- Implement `Dispute` and `DisputeEvidence` models and `/api/v1/milestones/:id/disputes` & `/api/v1/disputes/*` endpoints.
- Wire on-chain `raiseDispute` (callable by client or freelancer on a funded milestone) and `resolveDispute` (callable only by `ARBITRATOR_ROLE` on `PatelaEscrow.sol`).
- Build the Human Dispute Reviewer interface showing the signed project agreement, all submission versions, AI verification reports, project message history, and uploaded dispute evidence.

## Dependencies
- [`MILESTONE_04_WALLET_AND_ESCROW.md`](./MILESTONE_04_WALLET_AND_ESCROW.md) and [`MILESTONE_05_AI_REVIEW.md`](./MILESTONE_05_AI_REVIEW.md).

## Tasks
- [ ] `DSP-001`: `Dispute` and `DisputeEvidence` data models & repositories.
- [ ] `DSP-002`: On-chain `raiseDispute` integration & `POST /api/v1/milestones/:id/disputes`.
- [ ] `DSP-003`: Client & freelancer evidence submission (`POST /api/v1/disputes/:id/evidence`) with private S3 attachments.
- [ ] `DSP-004`: Dispute status lifecycle management (`OPEN → EVIDENCE_COLLECTION → UNDER_REVIEW → RESOLVED_*`).
- [ ] `DSP-005`: Arbitrator RBAC permissions & Human Dispute Reviewer console UI.
- [ ] `DSP-006`: Resolution decision workflow (`100% release`, `100% refund`, or `split settlement`) and on-chain `resolveDispute` execution.
- [ ] `DSP-007`: Indexer reconciliation of `DisputeResolved` event and ledger settlement.
- [ ] `DSP-008`: End-to-end dispute & contract freeze security tests.

## Technical Implementation
- When `raiseDispute(projectId, milestoneIndex, reasonHash)` is confirmed on Base Sepolia, `PatelaEscrow.sol` sets the milestone state to `Disputed`.
- While `Disputed`, any call to `approveMilestone` or `refundMilestone` reverts with `MilestoneIsDisputed()`.
- The human arbitrator inspects all evidence and executes `resolveDispute(projectId, milestoneIndex, freelancerAward, clientRefund, resolutionHash)`, where `freelancerAward + clientRefund == milestone.fundedAmount`.

## Database Changes
- Activates `Dispute` and `DisputeEvidence` tables.

## API Changes
- Implements `POST /api/v1/milestones/:milestoneId/disputes`, `GET /api/v1/disputes/:disputeId`, `POST /api/v1/disputes/:disputeId/evidence`, and `POST /api/v1/disputes/:disputeId/resolve`.

## Frontend Changes
- Connects the Dispute action in the Project & Milestone workspaces to on-chain `raiseDispute`, adds the Dispute Evidence upload panel for participants, and adds the Arbitrator Resolution workspace.

## Backend Changes
- Introduces `apps/api/src/disputes/*` and updates `apps/worker/src/blockchain-indexer/*` to handle `DisputeRaised` and `DisputeResolved`.

## Blockchain Changes
- Exercises `raiseDispute` and `resolveDispute` on `PatelaEscrow.sol`.

## Security Considerations
- Enforce `onlyRole(ARBITRATOR_ROLE)` on `resolveDispute` in Solidity and `@Roles('ARBITRATOR', 'ADMIN')` in NestJS.
- Prevent an arbitrator from resolving a dispute where `arbitratorUserId == clientId` or `arbitratorUserId == freelancerId` (conflict-of-interest guard).

## Testing Requirements
- Foundry tests proving `approveMilestone` and `refundMilestone` revert while `Disputed`, and proving `resolveDispute` enforces exact conservation of funds.
- API & E2E tests covering dispute creation, evidence uploads by both parties, unauthorized resolution rejection (`403`), and authorized split resolution reconciliation.

## Acceptance Criteria
1. Either client or freelancer can raise a dispute on a funded milestone, immediately freezing its escrow balance on-chain.
2. Both parties can submit statements and evidence files.
3. An authorized human arbitrator can review the case and execute `resolveDispute` on Base Sepolia to release, refund, or split the locked funds.

## Implementation History
- None yet (`PLANNED`).

## Known Issues
- None.

## Current Status
`PLANNED`

## Completion Evidence
- Pending implementation.

