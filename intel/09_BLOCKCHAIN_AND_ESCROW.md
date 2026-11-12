# 09 — Blockchain & Smart-Contract Escrow Architecture

**Document Version:** 1.0  
**Last Updated:** 2026-11-09  
**Target Network:** Base Sepolia Testnet (`Chain ID: 84532`)  
**Current Implementation Status:** `PLANNED` (Scheduled for [Milestone 04](./milestones/MILESTONE_04_WALLET_AND_ESCROW.md); current repo only simulates hashes in `src/lib/patela-store.ts`).

---

## 1. Network & Token Configuration

| Parameter | Specification |
|---|---|
| **Blockchain** | Base (Ethereum L2 OP Stack) |
| **Initial Target Network** | Base Sepolia Testnet |
| **Chain ID** | `84532` (Hex: `0x14a34`) |
| **Payment Asset (MVP)** | Single dedicated test ERC-20 token: **`PatelaTestUSD` (`pUSD`, 6 decimals)** |
| **Contract Framework** | Solidity `0.8.24+` compiled and tested with **Foundry** (`forge`) |
| **Frontend Integration** | `wagmi` + `viem` |

> **Critical Token Rule:** `PatelaTestUSD` (`pUSD`) is a self-deployed test ERC-20 contract on Base Sepolia with a controlled testnet faucet/mint function for onboarding test users. It must **never** be labeled or represented as official Circle `USDC`.

---

## 2. Conceptual Smart-Contract Architecture (`PatelaEscrow.sol`)

### 2.1 Core Data Structures

```solidity
enum MilestoneState {
    NotFunded,          // 0: Agreement registered, awaiting ERC-20 deposit
    Funded,             // 1: Funds locked in contract custody
    Submitted,          // 2: Deliverable hash/version recorded on-chain (optional) or off-chain
    RevisionRequested,  // 3: Client requested changes; funds remain locked
    Disputed,           // 4: Frozen against ordinary approval/refund; awaits arbitrator
    Released,           // 5: Terminal state — net payout sent to freelancer + fee to treasury
    Refunded,           // 6: Terminal state — full milestone balance returned to client
    SplitSettled        // 7: Terminal state — arbitrator split payout between freelancer & client
}

struct Milestone {
    uint256 amount;         // Exact base units (6 decimals for pUSD)
    uint256 fundedAmount;   // Actual base units deposited
    uint256 releasedAmount; // Base units released (gross)
    uint256 refundedAmount; // Base units refunded
    MilestoneState state;
}

struct ProjectEscrow {
    bytes32 projectId;
    address client;
    address freelancer;
    address token;          // Must be whitelisted PatelaTestUSD on testnet
    uint16 protocolFeeBps;  // Locked at project creation (e.g., 150 = 1.5%, max cap 1000 = 10%)
    bool exists;
}
```

### 2.2 Conceptual Contract Functions

```solidity
function createProject(
    bytes32 projectId,
    address freelancer,
    address token,
    uint256[] calldata milestoneAmounts,
    bytes32 agreementHash
) external;

function fundMilestone(bytes32 projectId, uint256 milestoneIndex) external nonReentrant;

function submitMilestone(bytes32 projectId, uint256 milestoneIndex, bytes32 submissionHash) external;

function approveMilestone(bytes32 projectId, uint256 milestoneIndex) external nonReentrant;

function requestRevision(bytes32 projectId, uint256 milestoneIndex, bytes32 reasonHash) external;

function raiseDispute(bytes32 projectId, uint256 milestoneIndex, bytes32 reasonHash) external;

function resolveDispute(
    bytes32 projectId,
    uint256 milestoneIndex,
    uint256 freelancerAward,
    uint256 clientRefund,
    bytes32 resolutionHash
) external nonReentrant onlyRole(ARBITRATOR_ROLE);

function refundMilestone(bytes32 projectId, uint256 milestoneIndex) external nonReentrant;
```

---

## 3. Mandatory Smart-Contract Security Invariants

Every implementation of `PatelaEscrow.sol` must satisfy and prove the following 9 invariants via Foundry unit, fuzz, and invariant tests:

1. **No Unauthorized Fund Movement (`INV-01`):**
   - Only `client` can call `approveMilestone`.
   - Only `freelancer` (or `ARBITRATOR_ROLE`) can authorize `refundMilestone` once a milestone is `Funded`.
   - Only an address holding `ARBITRATOR_ROLE` can call `resolveDispute`, and only when `state == MilestoneState.Disputed`.
2. **Conservation of Milestone Value (`INV-02`):**
   - For every milestone $i$: $\text{releasedAmount}_i + \text{refundedAmount}_i \le \text{fundedAmount}_i$.
   - No milestone can ever release or refund more than its `fundedAmount`.
3. **Single Settlement / No Double Payment (`INV-03`):**
   - Once a milestone enters `Released`, `Refunded`, or `SplitSettled`, its state is terminal; any subsequent call to `approveMilestone`, `refundMilestone`, or `resolveDispute` reverts with `InvalidMilestoneState()`.
4. **Dispute Freeze Guarantee (`INV-04`):**
   - When `state == MilestoneState.Disputed`, calling `approveMilestone` or `refundMilestone` **must revert**. Funds remain locked until `resolveDispute` is executed by `ARBITRATOR_ROLE`.
5. **Revision Requests Never Move Funds (`INV-05`):**
   - `requestRevision` transitions state from `Funded` or `Submitted` to `RevisionRequested` and emits `RevisionRequested`, with **zero ERC-20 transfers**.
6. **Global Solvency Invariant (`INV-06`):**
   - `IERC20(token).balanceOf(address(escrowContract)) >= sum(all active milestones' locked balances)`.
7. **Complete Event Traceability (`INV-07`):**
   - Every state-changing function emits a strongly-typed Solidity event (`ProjectCreated`, `MilestoneFunded`, `MilestoneSubmitted`, `RevisionRequested`, `MilestoneReleased`, `MilestoneRefunded`, `DisputeRaised`, `DisputeResolved`) containing `indexed bytes32 projectId` and `uint256 milestoneIndex`.
8. **Reentrancy & Safe Token Handling (`INV-08`):**
   - All functions performing external ERC-20 calls use OpenZeppelin `ReentrancyGuard` (`nonReentrant`), `SafeERC20` (`safeTransfer`, `safeTransferFrom`), and strict **Checks-Effects-Interactions (CEI)** ordering.
9. **Zero AI Signing Authority (`INV-09`):**
   - There is no `AI_ROLE` in the smart contract. AI verification happens off-chain as advisory evidence for the client and human arbitrator.

---

## 4. Release Rules, Timeouts & Reconciliation Lifecycle

### 4.1 Explicit Release & Refund Rules
- **Ordinary Release:** Requires `msg.sender == project.client` and `state` in `{Funded, Submitted, RevisionRequested}`. Calculates `fee = (fundedAmount * protocolFeeBps) / 10_000` and `netPayout = fundedAmount - fee`. Transfers `netPayout` to `project.freelancer` and `fee` to `feeRecipient`.
- **Unresponsive Counterparty Handling:** If a client becomes unresponsive after deliverable submission and AI review, the freelancer calls `raiseDispute(projectId, milestoneIndex)` to freeze the milestone and escalate to an authorized human arbitrator (`ARBITRATOR_ROLE`), who can verify the submission and AI report and execute `resolveDispute`.

### 4.2 Transaction Tracking & Reconciliation States
Never mark a database record as `FUNDED` or `RELEASED` merely because the browser submitted a transaction hash. Every transaction progresses through:
- `SUBMITTED`: Frontend sent `txHash` to `POST /api/v1/transactions/track`.
- `PENDING`: Transaction observed in mempool / awaiting receipt.
- `CONFIRMED`: Receipt returned `status == 1` at block $B$; awaiting confirmation depth ($N = 2$ blocks on Base Sepolia).
- `RECONCILED`: Canonical block hash verified at $B + N$, event log decoded, and `Escrow` / `EscrowMilestone` / `Milestone` tables atomically updated.
- `FAILED` / `REVERTED`: Receipt returned `status == 0` or pre-broadcast failure.
- `REPLACED` / `DROPPED`: Nonce superseded or evicted from mempool.
- `REORGED`: Previously indexed `blockHash` no longer matches canonical chain; indexer rolls back derived state and re-applies canonical logs.

