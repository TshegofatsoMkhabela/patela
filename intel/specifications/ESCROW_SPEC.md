# Smart Contract Escrow Specification

> **Classification:** Feature Technical Specification  
> **Status:** `Simulated` (Browser `localStorage` math in `src/` and `html/`)  
> **Target Milestone:** [MILESTONE_04_WALLET_AND_ESCROW.md](../milestones/MILESTONE_04_WALLET_AND_ESCROW.md)  
> **Last Updated:** 2026-11-09  

---

## 1. Current Repository State

- **`src/` and `html/`:** All escrow operations (`Fund Escrow`, `Approve & Release`, `Freeze Escrow`) currently mutate numeric fields in browser `localStorage`. No Solidity files exist in the repository yet.

---

## 2. Smart Contract Architecture (`PatelaEscrow.sol`)

Full Solidity specification and storage layout are defined in [../09_BLOCKCHAIN_AND_ESCROW.md](../09_BLOCKCHAIN_AND_ESCROW.md).

### 2.1 Core On-Chain Milestone States
`enum MilestoneState { NONE, FUNDED, RELEASED, REFUNDED, DISPUTED, SPLIT_RESOLVED }`

### 2.2 Supported Settlement Assets
1. **ERC-20 Stablecoins (`USDC`, `USDT`):** Transferred via OpenZeppelin `SafeERC20.safeTransferFrom` and `safeTransfer`. Checked against a contract-level token allowlist (`allowedTokens[tokenAddress] == true`).
2. **Native Base Sepolia ETH (`address(0)`):** Funded via `payable` `fundMilestoneETH` and transferred via low-level `.call{value: amount}("")` under `ReentrancyGuard`.

---

## 3. End-to-End Escrow Workflows

### 3.1 Funding a Milestone (Client)
1. Client clicks **Fund Milestone Escrow** on an `AWAITING_FUNDING` milestone.
2. Frontend calls `POST /api/v1/escrow/milestones/:milestoneId/prepare-deposit` to obtain the deterministic `bytes32 onchainMilestoneId = keccak256(abi.encodePacked(projectId, milestoneId))`, `contractAddress`, `tokenAddress`, `amountBaseUnits`, and `freelancerWallet`.
3. If `paymentToken` is `USDC` or `USDT`, frontend checks ERC-20 `allowance(clientWallet, escrowContract)`. If insufficient, prompts `approve(escrowContract, amountBaseUnits)`.
4. Frontend prompts client wallet to call `fundMilestoneERC20` (or `fundMilestoneETH`).
5. Client submits `{ txHash }` to `POST /api/v1/escrow/milestones/:milestoneId/deposit-submitted` (status: `FUNDING_PENDING`).
6. Backend chain listener (`viem` event watcher + confirmation worker) verifies the `MilestoneFunded` event on Base Sepolia (`>= 2` block confirmations), marks `EscrowDeposit.status = 'CONFIRMED'`, and transitions the milestone to `FUNDED`.

### 3.2 Approving & Releasing Funds (Client)
1. Once a milestone is in `SUBMITTED_FOR_REVIEW`, the client reviews the deliverable evidence and advisory AI report.
2. Client clicks **Approve & Release Escrow**.
3. Frontend prompts client wallet to call `releaseMilestone(onchainMilestoneId)` on `PatelaEscrow.sol`.
4. Contract deducts `platformFeeBps` (e.g., `250 bps` = `2.5%`) to `feeTreasury` and transfers net payout to `freelancerWallet`, emitting `MilestoneReleased`.
5. Backend indexer confirms `MilestoneReleased`, records the payout `BlockchainTransaction`, updates `Milestone.status = 'RELEASED'`, and checks if all project milestones are complete.

### 3.3 Freezing & Resolving Disputed Escrow
- Either `client` or `freelancer` can call `raiseDispute(onchainMilestoneId)` on-chain (or via backend dispute creation followed by on-chain freeze) while state is `FUNDED`, transitioning on-chain state to `DISPUTED`.
- While `DISPUTED`, `releaseMilestone` reverts.
- Only `ARBITRATOR_ROLE` can invoke `resolveDispute(onchainMilestoneId, clientRefundAmount, freelancerPayoutAmount)` where `clientRefundAmount + freelancerPayoutAmount == totalLockedAmount`.

---

## 4. Security Invariants

- **Checks-Effects-Interactions + `nonReentrant`** on every external state-changing function.
- **Exact Sum Conservation:** In `resolveDispute`, any mismatch between `clientRefund + freelancerPayout` and the locked milestone amount reverts with `InvalidSplitAmounts()`.
- **No AI Signer Key:** No AI service or automated worker holds private keys capable of calling `releaseMilestone` or `resolveDispute`.

---

## 5. Acceptance Criteria

- [ ] Foundry unit and fuzz tests (`packages/contracts/test/PatelaEscrow.t.sol`) achieve $\ge 95\%$ line and branch coverage.
- [ ] Double-funding, double-releasing, or unauthorized caller attempts revert with custom Solidity errors.
- [ ] Backend milestone status only transitions to `FUNDED` or `RELEASED` after verifying the corresponding Base Sepolia transaction receipt and event log.

