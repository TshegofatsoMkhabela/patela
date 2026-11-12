# Blockchain Transactions & Ledger Specification

> **Classification:** Feature Technical Specification  
> **Status:** `Prototype Only` (`html/wallet.html` mock transaction table)  
> **Target Milestone:** [MILESTONE_04_WALLET_AND_ESCROW.md](../milestones/MILESTONE_04_WALLET_AND_ESCROW.md)  
> **Last Updated:** 2026-11-09  

---

## 1. Current Repository State

- **`src/` (Next.js App):** Does not maintain a transaction history ledger; only updates milestone status strings.
- **`html/` (Dashboard Prototype):** `html/wallet.html` and `html/client-dashboard.html` / `html/worker-dashboard.html` display mock transaction rows (`TX-9941`, `0x8f9d...3a1b`) with full-screen receipt views (`interactions.js`) and CSV export.

---

## 2. Transaction Domain Model

Every on-chain operation associated with a Patela project or milestone is recorded in the `blockchain_transactions` table ([../07_DATABASE_ARCHITECTURE.md](../07_DATABASE_ARCHITECTURE.md)):

| Field | Type | Description |
|---|---|---|
| `id` | `UUID` | Internal transaction ID |
| `txHash` | `VARCHAR(66)` | Unique `0x...` transaction hash on Base Sepolia (`84532`) |
| `chainId` | `INT` | `84532` (Base Sepolia) |
| `txType` | `Enum` | `ERC20_APPROVAL`, `ESCROW_DEPOSIT`, `ESCROW_RELEASE`, `ESCROW_REFUND`, `DISPUTE_FREEZE`, `DISPUTE_SPLIT` |
| `status` | `Enum` | `PENDING`, `CONFIRMED`, `FAILED`, `REORGED` |
| `projectId` | `UUID` | Linked `Project` |
| `milestoneId` | `UUID` | Linked `Milestone` |
| `fromAddress` | `VARCHAR(42)` | Sender wallet address |
| `toAddress` | `VARCHAR(42)` | Recipient or `PatelaEscrow` contract address |
| `tokenSymbol` | `Enum` | `USDC`, `USDT`, `ETH` |
| `amountBaseUnits` | `DECIMAL(78,0)` | Gross token amount in base units |
| `platformFeeBaseUnits` | `DECIMAL(78,0)` | Protocol fee amount (`0` for deposits) |
| `netAmountBaseUnits` | `DECIMAL(78,0)` | Net amount received by counterparty |
| `blockNumber` | `BIGINT` | Confirmed block number on Base Sepolia |
| `gasUsed` | `BIGINT` | Gas units consumed |
| `confirmedAt` | `TIMESTAMPTZ` | Block timestamp |

---

## 3. Functional Requirements

### 3.1 Real-Time Indexing & Confirmation Reconciliation
- When a user broadcasts a transaction from the frontend, the client immediately registers the `txHash` (`status = 'PENDING'`).
- A BullMQ worker (`chain-indexer`) polls `getTransactionReceipt(txHash)` and listens to `PatelaEscrow` contract logs via `viem`.
- Once confirmed (`status === 'success'` and $\ge 2$ block confirmations), the worker parses the emitted event logs, records `blockNumber`, `gasUsed`, and `confirmedAt`, and transitions the transaction to `CONFIRMED`.

### 3.2 Transaction Detail View & Explorer Links
- Selecting any transaction row opens the full-screen transaction receipt view displaying:
  - Transaction Type, Status badge, Timestamp, and Block Number.
  - Project & Milestone reference link.
  - Gross Amount, Platform Fee (`2.5%` on release), and Net Settlement Amount.
  - Sender (`fromAddress`), Escrow Contract (`PatelaEscrow`), and Recipient (`toAddress`).
  - Direct external link to **BaseScan Sepolia**: `https://sepolia.basescan.org/tx/${txHash}`.

### 3.3 Filtering & CSV Export
- Filterable by `txType`, `tokenSymbol` (`USDC`, `USDT`, `ETH`), `status`, `projectId`, and date range.
- `GET /api/v1/transactions/export.csv` exports the user's filtered transaction ledger with exact human-readable and base-unit columns for accounting.

---

## 4. API Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/transactions` | JWT | Paginated list of transactions involving the authenticated user |
| `GET` | `/api/v1/transactions/:txId` | JWT (Participant) | Full transaction receipt details |
| `GET` | `/api/v1/transactions/export.csv` | JWT | Download CSV accounting ledger |

---

## 5. Acceptance Criteria

- [ ] Duplicate submission of the same `txHash` is idempotent (`@@unique([chainId, txHash])`).
- [ ] Every transaction row provides a working BaseScan Sepolia link (`https://sepolia.basescan.org/tx/<hash>`).
- [ ] Failed on-chain transactions (`receipt.status === 'reverted'`) are marked `FAILED` and do not advance milestone state.

