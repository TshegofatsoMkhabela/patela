# 09 — Blockchain & Escrow Architecture: Patella

**Document Version:** 1.1 (Updated for Technical Architecture v0.3)  
**Last Updated:** 2026-11-13  
**Status:** Approved Architectural Baseline

---

## 1. Blockchain Architecture Overview

Patella deploys its on-chain custody and audit layer on **Base Sepolia (Chain ID 84532)**. All value is denominated in **South African Rand (ZAR)** using the **ZARP** rand-pegged stablecoin.

The on-chain layer consists of two core smart contracts written in **Solidity `0.8.24+`** using OpenZeppelin `5.x`:

1. **`EscrowVault.sol`**: Multi-tranche, rule-governed stablecoin escrow vault.
2. **`AnchorRegistry.sol`**: Append-only cryptographic digest and Merkle root registry for forensic auditability.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        BASE SEPOLIA (CHAIN ID 84532)                   │
├───────────────────────────────────┬────────────────────────────────────┤
│         EscrowVault.sol           │         AnchorRegistry.sol         │
│  • Holds ZARP (Rand Stablecoin)   │  • Append-only event hashes        │
│  • Enforces conservation of money │  • Canonical agreement SHA-256     │
│  • Verifies Release Authority sigs│  • Handoff dual signature roots    │
│  • Isolated parcel tranche holds  │  • Read-only auditor verifier      │
└─────────────────▲─────────────────┴──────────────────▲─────────────────┘
                  │                                    │
       EIP-712 Signed Release               Batch Anchor Digests
                  │                                    │
┌─────────────────┴────────────────────────────────────┴─────────────────┐
│                  AWS KMS / CLOUD HSM RELEASE AUTHORITY                 │
│  • Isolated private key (secp256k1)                                    │
│  • Signs release instructions only when domain rule engine checks pass │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Smart Contracts

### 2.1 `EscrowVault.sol`
- **Deposit & Tranche Registration:**
  ```solidity
  function fundOrder(
      bytes32 orderId,
      uint256 totalAmount,
      bytes32[] calldata trancheIds,
      uint256[] calldata trancheAmounts
  ) external nonReentrant whenNotPaused;
  ```
  - *Conservation Invariant Check:* Reverts immediately if:
    $$\sum_{i} \text{trancheAmounts}[i] \ne \text{totalAmount}$$
- **Rule-Triggered Release Execution:**
  ```solidity
  function releaseTranche(
      bytes32 orderId,
      bytes32 trancheId,
      address payable recipient,
      uint256 amount,
      uint256 nonce,
      bytes calldata releaseAuthoritySignature
  ) external nonReentrant whenNotPaused;
  ```
  - *Release Authority Verification:* Validates that `releaseAuthoritySignature` recovers to the designated KMS Release Authority address under EIP-712 structured data hashing.
- **Isolated Dispute Hold:**
  ```solidity
  function holdTrancheInDispute(
      bytes32 orderId,
      bytes32 trancheId
  ) external onlyRole(DISPUTE_MANAGER_ROLE);
  ```
  - Freezes only the designated tranche. Unaffected tranches on the same order can still be released.
- **Emergency Circuit Breaker:**
  - `pause()` and `unpause()` protected by a 2-of-3 multi-signature governance role.

### 2.2 `AnchorRegistry.sol`
- **Merkle & Digest Registration:**
  ```solidity
  function anchorEventDigest(
      bytes32 streamId,
      bytes32 digestHash,
      uint256 eventCount
  ) external onlyRole(ANCHOR_INDEXER_ROLE);
  ```
- **Auditor On-Chain Proof:**
  - Anyone can query `verifyAnchor(bytes32 streamId, bytes32 digestHash)` without gas fees (`view` function) to confirm that a document, signed waybill, or custody event occurred at or before that block height.

---

## 3. The Release Authority Security Model

A central vulnerability of naive Web3 escrow is allowing application servers to submit unsigned or loosely authorized release transactions.

Patella eliminates this vulnerability via an **isolated Release Authority**:
1. **Application Server Evaluates Rules:** The NestJS domain service monitors custody events and evaluates declarative JSON rules.
2. **Invariant & Ledger Verification:** The money engine checks that the internal double-entry ledger is balanced and no active dispute holds exist for the parcel.
3. **KMS Signature Request:** The backend sends a structured authorization request to AWS KMS / Cloud HSM.
4. **Hardware Signature:** KMS signs the EIP-712 typed release payload using its isolated private key.
5. **Contract Verification:** `EscrowVault.sol` verifies the signature on-chain before executing `IERC20(zarp).safeTransfer(recipient, amount)`.

---

## 4. Foundry Invariant Test Suite

The contract test suite enforces four non-negotiable mathematical invariants using Foundry (`forge test`):

```solidity
// Invariant 1: Vault solvency (vault balance must always >= sum of active tranches)
function invariant_vault_solvency() public view {
    assertGe(zarp.balanceOf(address(vault)), totalActiveTrancheSum);
}

// Invariant 2: Conservation of money (no order can be registered if tranches != total)
function invariant_conservation_of_money(uint256 total, uint256[] memory tranches) public {
    // Fuzz test verifying revert on any sum discrepancy
}

// Invariant 3: Zero release without Release Authority signature
function test_revert_unauthorized_release() public {
    vm.expectRevert("InvalidReleaseAuthoritySignature()");
    vault.releaseTranche(orderId, tId, recipient, amount, nonce, fakeSig);
}

// Invariant 4: Blast radius isolation (holding tranche A never prevents release of tranche B)
function test_isolated_dispute_holding() public {
    vault.holdTrancheInDispute(orderId, trancheB);
    vault.releaseTranche(orderId, trancheA, supplier, amountA, nonce, validSig); // Succeeds
}
```
