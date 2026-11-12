# Milestone 04: Wallet Integration and Smart-Contract Escrow

## Objective
Implement real, non-custodial smart-contract escrow on **Base Sepolia (`Chain ID: 84532`)** using a dedicated test ERC-20 token (`PatelaTestUSD` / `pUSD`), `wagmi` + `viem` wallet connection and signature linking, on-chain milestone funding, client approval release, refunds, and asynchronous blockchain event indexing and reconciliation.

## Scope
- Configure `wagmi` + `viem` for Base Sepolia (`84532`) and implement cryptographic wallet signature linking (`/api/v1/wallets/*`).
- Develop and test `PatelaTestUSD.sol` (`pUSD`, 6 decimals) and `PatelaEscrow.sol` in Foundry (`contracts/`).
- Implement on-chain project creation, milestone funding (`fundMilestone`), client approval (`approveMilestone`), and refund (`refundMilestone`).
- Build the BullMQ Blockchain Event Indexer (`apps/worker/src/blockchain-indexer`) to track `SUBMITTED → PENDING → CONFIRMED → RECONCILED` states, handle reorgs, and reconcile `Escrow`, `EscrowMilestone`, `Transaction`, and `PlatformFeeRecord` tables.

## Dependencies
- [`MILESTONE_03_PROJECT_MANAGEMENT.md`](./MILESTONE_03_PROJECT_MANAGEMENT.md).

## Tasks
- [ ] `ESC-001`: `wagmi` + `viem` Base Sepolia (`84532`) wallet connection.
- [ ] `ESC-002`: Wallet linking & EIP-191/SIWE signature verification.
- [ ] `ESC-003`: Base Sepolia RPC & Foundry workspace setup (`contracts/`).
- [ ] `ESC-004`: `PatelaTestUSD.sol` (`pUSD`, 6 decimals) test ERC-20 token contract.
- [ ] `ESC-005`: `IPatelaEscrow.sol` interface & security invariant specification.
- [ ] `ESC-006`: `PatelaEscrow.sol` implementation (`SafeERC20`, `ReentrancyGuard`, `AccessControl`, `Pausable`).
- [ ] `ESC-007`: Foundry unit, stateless fuzz, and stateful invariant test suites (`INV-01`–`INV-09`).
- [ ] `ESC-008`: On-chain project escrow registration (`createProject`).
- [ ] `ESC-009`: Milestone funding flow (`ERC20.approve` + `fundMilestone`).
- [ ] `ESC-010`: Transaction lifecycle tracking (`SUBMITTED`, `PENDING`, `CONFIRMED`, `RECONCILED`, `REVERTED`, `DROPPED`, `REORGED`).
- [ ] `ESC-011`: BullMQ Blockchain Event Indexer worker with confirmation depth ($N=2$) and reorg detection.
- [ ] `ESC-012`: Client milestone approval (`approveMilestone`).
- [ ] `ESC-013`: Payment release & protocol fee accounting (`PlatformFeeRecord`).
- [ ] `ESC-014`: Authorized milestone refund workflow (`refundMilestone`).
- [ ] `ESC-015`: Automated DB-to-chain solvency & balance reconciliation service.

## Technical Implementation
- `PatelaEscrow.sol` holds all locked `pUSD` tokens directly. Neither the NestJS API nor the BullMQ worker ever holds client/freelancer funds.
- Frontend submits signed transactions via `wagmi` and registers the `txHash` (`POST /api/v1/transactions/track`) as `SUBMITTED`.
- Only after the BullMQ indexer verifies the receipt (`status == 1`) and decodes the canonical event log at $\ge 2$ block confirmations does PostgreSQL transition the milestone to `FUNDED`, `RELEASED`, or `REFUNDED`.

## Database Changes
- Activates `Wallet`, `Escrow`, `EscrowMilestone`, `Transaction`, `BlockchainEvent`, and `PlatformFeeRecord` tables.

## API Changes
- Implements `/api/v1/wallets/*`, `/api/v1/projects/:id/escrow/prepare`, and `/api/v1/transactions/*`.

## Frontend Changes
- Replaces simulated `connectWallet()` and `actions.fund()` in `src/lib/patela-store.ts` with real Base Sepolia `wagmi` hooks, transaction progress indicators, and verifiable BaseScan Sepolia links.

## Backend Changes
- Introduces `apps/api/src/wallets/*`, `apps/api/src/escrow/*`, `apps/api/src/transactions/*`, and `apps/worker/src/blockchain-indexer/*`.

## Blockchain Changes
- Introduces `contracts/src/PatelaTestUSD.sol` and `contracts/src/PatelaEscrow.sol` on Base Sepolia (`84532`).

## Security Considerations
- Enforces all 9 contract security invariants in [`09_BLOCKCHAIN_AND_ESCROW.md`](../09_BLOCKCHAIN_AND_ESCROW.md).
- Validates `chainId == 84532` on both frontend wallet actions and backend signature/transaction verification.

## Testing Requirements
- Foundry unit, fuzz (`1,000+` runs), and invariant (`10,000+` calls) tests passing 100%.
- Integration tests against local Anvil node verifying event indexing, confirmation depth waiting, reverted transaction handling, and block reorg rollback.

## Acceptance Criteria
1. Users can connect a wallet on Base Sepolia (`84532`), sign a verification challenge, and mint test `pUSD`.
2. Clients can fund milestones into `PatelaEscrow.sol` and approve completed milestones to release net `pUSD` payouts on-chain.
3. Database escrow balances and transaction statuses reconcile deterministically with on-chain events.

## Implementation History
- None yet (`PLANNED`).

## Known Issues
- Resolves `ISS-002` (Wrong Sepolia Chain ID) and `ISS-008` (Single Test ERC-20 Token).

## Current Status
`PLANNED`

## Completion Evidence
- Pending implementation.

