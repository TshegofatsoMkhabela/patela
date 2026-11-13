# Patella Smart Contracts

This directory contains the Solidity smart contracts powering the Patella decentralized procurement, tender, milestone escrow, and logistics verification protocol on the **XRPL EVM Sidechain**.

---

## Table of Contents
1. [Overview of the Smart Contracts](#overview-of-the-smart-contracts)
   - [1. MockZARP.sol](#1-mockzarpsol)
   - [2. PatellaRegistry.sol](#2-patellaregistrysol)
   - [3. PatellaTenderTrail.sol](#3-patellatendertrailsol)
   - [4. PatellaEscrowAndLogistics.sol](#4-patellaescrowandlogisticssol)
2. [How the Contracts Work (Workflow Architecture)](#how-the-contracts-work-workflow-architecture)
3. [Required NPM Packages](#required-npm-packages)
4. [Smart Contract Deployment](#smart-contract-deployment)
5. [What is an ABI & How It Is Used](#what-is-an-abi--how-it-is-used)
6. [Connecting Contracts to JavaScript/TypeScript & Frontend Integration](#connecting-contracts-to-javascripttypescript--frontend-integration)
   - [Direct Ethers.js / Viem Integration](#direct-ethersjs--viem-integration)
   - [Integrating with the Patella Frontend Store](#integrating-with-the-patella-frontend-store)
7. [Commands Reference](#commands-reference)

---

## Overview of the Smart Contracts

Located in `contracts/contracts/`:

### 1. `MockZARP.sol`
- **Purpose**: A mock ERC-20 token representing the South African Rand pegged stablecoin (**ZARP**) for testnet settlement.
- **Key Functionality**:
  - Open minting (`mint(to, amount)`) for simulated buyers and escrow funding during testing.

### 2. `PatellaRegistry.sol`
- **Purpose**: The central identity and Role-Based Access Control (RBAC) registry leveraging OpenZeppelin's `AccessControl`.
- **Roles & State**:
  - `ADMIN_ROLE`: Authorizes business registration and verification statuses.
  - `DISPUTE_RESOLVER_ROLE`: Permissioned arbiters who can resolve contested milestone funds.
  - `EVALUATOR_ROLE`: Permissioned assessors who score procurement bids.
  - Tracks business profile states: `isRegistered`, `isVerified`, and `roleType` (`"BUYER"`, `"SUPPLIER"`, `"LOGISTICS"`).

### 3. `PatellaTenderTrail.sol`
- **Purpose**: Trust-minimized audit trail for enterprise Request for Quotations (RFQs) and tenders.
- **Key Functionality**:
  - `publishTender(...)`: Allows verified buyers to publish RFQ specification hashes, evaluation rubrics, and tender deadlines.
  - `submitBid(...)`: Allows verified suppliers to anchor encrypted bid commitments before the deadline without leaking tender details.
  - `logEvaluationScore(...)`: Allows credentialed evaluators to post evaluation score hashes.
  - `awardTender(...)`: Buyer awards the contract to the winning bidder with a public reason hash.
  - `markConverted(...)`: Binds the awarded tender to a funded escrow order ID.

### 4. `PatellaEscrowAndLogistics.sol`
- **Purpose**: Multi-milestone escrow vault with cryptographic two-party QR/signature handoff verification and dispute settlement.
- **Key Functionality**:
  - `createOrder(...)`: Establishes milestone-based payments tied to handoff steps or delivery confirmations.
  - `fundEscrow(...)`: Deposits ZARP tokens into escrow from the buyer.
  - `recordTwoPartyHandoff(...)`: Verifies dual ECDSA signatures (`giver` and `receiver`) on-chain alongside geolocation photo hashes and single-use QR nonces. Handoff confirmations automatically trigger step-locked milestone payouts.
  - `approveMilestone(...)`: Allows buyer to manually approve evidence and trigger milestone releases.
  - `claimTimeoutRelease(...)`: Auto-releases milestone funds if an auto-approve window expires without disputes.
  - `raiseDispute(...)` / `resolveDispute(...)`: Freezes funds and authorizes registry-appointed arbiters to disburse to supplier or refund buyer.

---

## How the Contracts Work (Workflow Architecture)

```
[Buyer Publishes Tender/Invoice] 
        │ (RFQ Hash, Rubric Hash)
        ▼
[Suppliers Submit Encrypted Bids] 
        │ (Encrypted Hashes anchored on-chain)
        ▼
[Tender Closes & Evaluators Score Bids]
        │
        ▼
[Buyer Awards Tender] ──> [Order Created in PatellaEscrowAndLogistics]
                                    │
                                    ▼
                             [Escrow Funded (ZARP)]
                                    │
    ┌───────────────────────────────┴───────────────────────────────┐
    ▼                                                               ▼
[Physical Custody Transfer]                               [Buyer Manual Release / Timeout]
- Giver & Receiver sign QR handoff payload                 - Buyer verifies goods
- Cryptographic proof submitted on-chain                   - Funds released to recipient
- Triggers automated milestone release                              │
    │                                                               │
    └───────────────────────────────┬───────────────────────────────┘
                                    ▼
                         [Order Completed / Settled]
```

---

## Required NPM Packages

The Hardhat environment depends on the following packages:

| Package | Type | Description |
|---|---|---|
| `hardhat` | Dev Dependency | Ethereum/EVM development environment for compiling, running, and deploying smart contracts. |
| `@nomicfoundation/hardhat-toolbox` | Dev Dependency | Bundles essential plugins: Ethers.js (`@nomicfoundation/hardhat-ethers`), Mocha test runner, Chai matchers, and type generators. |
| `@openzeppelin/contracts` | Dependency | Industry-standard secure implementations of ERC-20, AccessControl, ReentrancyGuard, and ECDSA cryptography. |
| `typescript` | Dev Dependency | Type system for robust deployment scripts and tasks. |
| `ts-node` | Dev Dependency | TypeScript execution engine for Node.js. |
| `@types/node` | Dev Dependency | TypeScript definitions for Node.js runtime and filesystem modules. |
| `dotenv` | Dev Dependency | Loads environment variables (`RPC_URL`, `DEPLOYER_PRIVATE_KEY`) from `.env`. |

---

## Smart Contract Deployment

### Deployment Process
1. **Compilation**: Hardhat parses Solidity source files in `contracts/contracts/`, runs the solc compiler (`0.8.20`), and outputs compiled artifacts in `contracts/artifacts/`.
2. **Execution**: `contracts/scripts/deploy.ts` connects to the targeted network provider (e.g. XRPL EVM Testnet RPC) using the funded private key from `.env`.
3. **Artifact Recording**: The script exports contract addresses and full ABIs into `contracts/deployments/latest.json`.

```bash
# 1. Compile contracts
npx hardhat compile

# 2. Deploy locally to ephemeral Hardhat network
npx hardhat run scripts/deploy.ts --network hardhat

# 3. Deploy to XRPL EVM Testnet
npx hardhat run scripts/deploy.ts --network testnet
```

---

## What is an ABI & How It Is Used

### What is an ABI?
An **ABI (Application Binary Interface)** is a JSON specification representing a compiled smart contract. Because smart contracts exist on the blockchain as compiled bytecode, client applications (JavaScript, TypeScript, Python) cannot know what functions exist or how to encode parameters without the ABI.

The ABI defines:
- **Functions**: Names, inputs, outputs, state mutability (`view`, `pure`, `nonpayable`).
- **Events**: Event signatures, indexed topics, and payload parameters.
- **Errors**: Custom Solidity errors for structured error handling.

### How it is generated:
When you run `npx hardhat compile`, Hardhat generates an artifact file for each contract under `contracts/artifacts/contracts/<ContractName>.sol/<ContractName>.json`. 

Our deployment script extracts the ABI directly and bundles it into `contracts/deployments/latest.json`:

```json
{
  "network": "testnet",
  "contracts": {
    "PatellaEscrowAndLogistics": {
      "address": "0x1234...abcd",
      "abi": [ ... ]
    }
  }
}
```

---

## Connecting Contracts to JavaScript/TypeScript & Frontend Integration

### Direct Ethers.js / Viem Integration

You can instantiate a contract instance in your Next.js application using `ethers.js`:

```typescript
import { ethers } from "ethers";
import deployments from "@/contracts/deployments/latest.json";

// 1. Connect to the browser wallet (e.g., MetaMask or XRPL EVM Provider)
const provider = new ethers.BrowserProvider(window.ethereum);
const signer = await provider.getSigner();

// 2. Instantiate the contract using Address and ABI
const escrowContract = new ethers.Contract(
  deployments.contracts.PatellaEscrowAndLogistics.address,
  deployments.contracts.PatellaEscrowAndLogistics.abi,
  signer
);

// 3. Call a read (view) function
const order = await escrowContract.orders(orderId);
console.log("Order status:", order.status);

// 4. Send a transaction (state change)
const tx = await escrowContract.fundEscrow(orderId);
await tx.wait(); // Wait for confirmation on the XRPL EVM Sidechain
```

### Integrating with the Patella Frontend Store

Currently, Patella's frontend uses an in-memory/localStorage demo store in `src/lib/patela-store.ts`.

To switch from simulated demo mode to live XRPL EVM contracts:
1. Copy or symlink `contracts/deployments/latest.json` to `src/contracts/deployments.json`.
2. Replace mock methods in `src/lib/patela-store.ts` (e.g., `fundJob`, `releaseMilestone`, `submitBid`) with asynchronous calls to `escrowContract` or `tenderTrailContract`.
3. Read on-chain events (`HandoffVerified`, `MilestoneReleased`, `TenderAwarded`) via `contract.on(...)` or an indexer to synchronize UI state.

---

## Commands Reference

```bash
# Inside contracts/

# Compile contracts
npx hardhat compile

# Clean build artifacts & cache
npx hardhat clean

# Run deployment script on testnet
npx hardhat run scripts/deploy.ts --network testnet

# Run deployment script locally
npx hardhat run scripts/deploy.ts --network hardhat
```

