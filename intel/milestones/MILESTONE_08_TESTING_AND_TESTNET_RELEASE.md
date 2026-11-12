# Milestone 08: Testing, Security and Testnet Release

## Objective
Conduct comprehensive end-to-end testing, smart-contract fuzz/invariant security verification, failure/recovery drills, and deploy + verify the complete Patela MVP on **Base Sepolia (`Chain ID: 84532`)** with test token onboarding and final documentation sign-off.

## Scope
- Execute full Playwright E2E test suites across desktop and mobile viewports covering the 14-step workflow and dispute resolution.
- Run extended Foundry fuzz and stateful invariant campaigns (`50,000+` calls) and security audit checklist on `PatelaEscrow.sol` and `PatelaTestUSD.sol`.
- Deploy and verify `PatelaTestUSD` and `PatelaEscrow` on Base Sepolia (`https://sepolia.basescan.org`).
- Provide test `pUSD` faucet distribution and guided onboarding for Base Sepolia evaluators.
- Perform final synchronization and verification of all `intel/` documents.

## Dependencies
- [`MILESTONE_01_AUTH_AND_DATABASE.md`](./MILESTONE_01_AUTH_AND_DATABASE.md) through [`MILESTONE_07_ANALYTICS_AND_ADMIN.md`](./MILESTONE_07_ANALYTICS_AND_ADMIN.md).

## Tasks
- [ ] `REL-001`: Full Playwright End-to-End (E2E) & accessibility (`axe-core`) test suite.
- [ ] `REL-002`: Smart-contract security review, static analysis, and extended Foundry invariant campaign.
- [ ] `REL-003`: Base Sepolia (`84532`) contract deployment and BaseScan source verification.
- [ ] `REL-004`: Testnet `pUSD` faucet & evaluator onboarding guide.
- [ ] `REL-005`: Failure, RPC outage, transaction revert, block reorg, and DB backup recovery drills.
- [ ] `REL-006`: Final `intel/` documentation audit and Testnet MVP acceptance sign-off.

## Technical Implementation
- Deploy contracts via `forge script script/DeployBaseSepolia.s.sol --rpc-url $BASE_SEPOLIA_RPC_URL --chain-id 84532 --broadcast --verify`.
- Run E2E acceptance scenarios verifying that a user can register, link a Base Sepolia wallet, mint test `pUSD`, post a job, apply as a freelancer, sign an agreement, lock `pUSD` in `PatelaEscrow.sol`, upload deliverables to private S3, receive a structured AI verification report, approve the milestone (or resolve a dispute), and verify the settled payout on BaseScan Sepolia.

## Database Changes
- Final production-ready indexes and migration verification; zero pending unapplied migrations.

## API Changes
- Adds rate-limited `POST /api/v1/escrow/testnet-faucet` (or direct contract `mintTestTokens()` helper) for Base Sepolia `pUSD` onboarding.

## Frontend Changes
- Displays verified Base Sepolia contract addresses, BaseScan links, and a clear `"Base Sepolia Testnet MVP — Uses Test pUSD (No Real Monetary Value)"` environment banner.

## Backend Changes
- Production-hardened logging, health/readiness probes (`/api/v1/health/live`, `/api/v1/health/ready`), and graceful shutdown for API and BullMQ workers.

## Blockchain Changes
- Live deployment and verification of `PatelaTestUSD.sol` and `PatelaEscrow.sol` on Base Sepolia (`84532`).

## Security Considerations
- Dependency vulnerability audit (`npm audit`), secret scan verification, CORS/CSP header hardening, and confirmation that South African legal/regulatory requirements in [`11_SECURITY_AND_COMPLIANCE.md`](../11_SECURITY_AND_COMPLIANCE.md) remain gated before any future mainnet consideration.

## Testing Requirements
- All unit, integration, API, E2E, and Foundry unit/fuzz/invariant suites passing 100%.

## Acceptance Criteria
1. Complete 14-step workflow and dispute resolution workflow execute end-to-end on Base Sepolia (`84532`).
2. Smart contracts are deployed and verified on BaseScan Sepolia with zero unresolved security findings.
3. All `intel/` documentation matches the deployed codebase 100%.

## Implementation History
- None yet (`PLANNED`).

## Known Issues
- None.

## Current Status
`PLANNED`

## Completion Evidence
- Pending implementation.

