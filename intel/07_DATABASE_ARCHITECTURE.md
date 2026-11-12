# 07 — Database Architecture: Patella

**Document Version:** 1.1 (Updated for Technical Architecture v0.3)  
**Last Updated:** 2026-11-13  
**Status:** Approved Architectural Baseline

---

## 1. Relational Database Overview

Patella uses **PostgreSQL 16+** as its primary relational store. All financial amounts are stored as **64-bit integers in ZAR cents** (`BIGINT`) to completely eliminate floating-point rounding errors.

The domain model consists of **28 core entities** organized into 7 functional clusters:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        28 CORE DOMAIN ENTITIES                         │
├───────────────────────┬───────────────────────┬────────────────────────┤
│ 1. Commercial Contract│ 2. Route & Custody    │ 3. Declarative Payment │
│  • agreements         │  • route_graphs       │  • payment_plans       │
│  • agreement_versions │  • route_nodes        │  • payment_tranches    │
│  • agreement_sigs     │  • route_edges        │  • tranche_rules       │
│  • orders             │  • custody_handoffs   │  • release_instructions│
│  • order_parcels      │  • handoff_signatures │                        │
│                       │  • handoff_evidence   │                        │
│                       │  • guest_tokens       │                        │
├───────────────────────┼───────────────────────┼────────────────────────┤
│ 4. Double-Entry Money │ 5. Isolated Disputes  │ 6. Partners & Fleet    │
│  • ledger_accounts    │  • disputes           │  • users               │
│  • ledger_journals    │  • dispute_parcels    │  • partners (CIPC)     │
│  • ledger_postings    │  • dispute_evidence   │  • carrier_rate_cards  │
│                       │  • dispute_rulings    │                        │
├───────────────────────┴───────────────────────┴────────────────────────┤
│ 7. Audit & Cryptographic Anchoring                                     │
│  • chain_anchors (Base Sepolia block hashes & Merkle roots)            │
│  • auditor_access_logs (read-only compliance access logs)               │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Entity Definitions

### Cluster 1: Commercial Contracts & Consignments
1. **`agreements`**: Master agreement between buyer and supplier. Tracks status (`DRAFT`, `PENDING_SIGNATURE`, `ACTIVE`, `COMPLETED`, `DISPUTED`), canonical document hash, and active version ID.
2. **`agreement_versions`**: Immutable snapshot of terms, line items, and payment schedules whenever an amendment is negotiated.
3. **`agreement_signatures`**: Cryptographic dual signatures (buyer and supplier public keys, timestamp, EIP-712 signature hash).
4. **`orders`**: Active purchase order linked to an agreement. Contains buyer ID, supplier ID, currency (`ZAR`), total gross amount in cents, and escrow status.
5. **`order_parcels`**: Physical consignment partitions (e.g. Parcel A: 300 MT, Parcel B: 100 MT) enabling split-shipment routing and isolated dispute blast radiuses.

### Cluster 2: Route Graph & Custody
6. **`route_graphs`**: Directed graph per order. Tracks total hops, start time, completed hops, and active graph status.
7. **`route_nodes`**: Physical locations along the corridor (mines, weighbridges, cross-docks, bonded yards, discharge bays). Stores GPS coordinates, sequence index, and required proof level.
8. **`route_edges`**: Transit legs between nodes. Links source node, destination node, assigned carrier partner ID, expected transit duration, and leg status (`PENDING`, `IN_TRANSIT`, `COMPLETED`).
9. **`custody_handoffs`**: Authoritative record of physical custody transfers. Records releasing party ID, receiving party ID, node ID, parcel IDs, dual signature timestamps, and verification status.
10. **`handoff_signatures`**: Individual digital signatures from releasing driver and receiving dock clerk with device user-agent and IP.
11. **`handoff_evidence`**: Photos, weighbridge tickets, seal serial numbers, and tamper evidence documents stored in MinIO/S3.
12. **`guest_tokens`**: Short-lived, single-use mobile tokens (UUIDv4 + HMAC SHA-256) sent to drivers and receivers via SMS/WhatsApp with strict 4-hour expiration.

### Cluster 3: Declarative Payment Plans
13. **`payment_plans`**: Master payment plan linked to an order version. Records total planned amount and validation status.
14. **`payment_tranches`**: Individual milestone payout tranches (e.g. Tranche 1: R 97,000, Tranche 2: R 145,500). Tracks status (`LOCKED`, `QUEUED`, `RELEASED`, `HELD_IN_DISPUTE`).
15. **`tranche_rules`**: Declarative JSON Logic rules governing release criteria (e.g. requiring dual signatures at specific node ID).
16. **`release_instructions`**: Authorized payout payloads signed by the KMS Release Authority, containing on-chain transaction hash and Base Sepolia block number.

### Cluster 4: Double-Entry Ledger & Conservation of Money
17. **`ledger_accounts`**: Chart of accounts (`CLIENT_FIAT_DEPOSIT`, `ESCROW_VAULT_ZARP_LOCKED`, `CARRIER_PAYABLE`, `SUPPLIER_PAYABLE`, `PLATFORM_FEE_INCOME`, `DISPUTE_RESERVE`).
18. **`ledger_journals`**: Atomic journal entries representing economic events (escrow funding, tranche release, dispute hold, dispute refund).
19. **`ledger_postings`**: Individual debit and credit rows. Enforces the invariant: $\sum \text{debits} = \sum \text{credits}$ for every journal entry.

### Cluster 5: Isolated Disputes
20. **`disputes`**: Exception records raised by buyers, carriers, or receivers. Tracks dispute reason, claim amount in cents, status (`OPEN`, `TRIAGED`, `RESOLVED`), and assigned ops agent.
21. **`dispute_parcels`**: Junction table mapping disputes strictly to affected parcels. Keeps unaffected parcels in normal operational flow.
22. **`dispute_evidence`**: Damage photos, independent assayer inspection reports, police case numbers, and driver statements.
23. **`dispute_rulings`**: Formal ruling issued by operations console (e.g. 80% supplier payout, 20% buyer refund) executing atomic double-entry reallocations.

### Cluster 6: Partners & Fleet Directory
24. **`users`**: System accounts (Enterprise Buyers, Suppliers, Logistics Coordinators, Admins, Read-only Auditors).
25. **`partners`**: Logistics carriers, freight forwarding companies, and terminal operators. Tracks CIPC company registration number, verified goods-in-transit insurance policy, on-time delivery score, and active fleet size.
26. **`carrier_rate_cards`**: Published and negotiated freight tariffs per corridor (rate per ton-kilometer, minimum load charges, demurrage fees).

### Cluster 7: Audit & Chain Anchoring
27: **`chain_anchors`**: Cryptographic anchor records tying off-chain PostgreSQL event batches and document hashes to Base Sepolia block numbers and transaction hashes.
28. **`auditor_access_logs`**: Immutable forensic access logs recording every document download, hash verification, and ledger inspection by external auditors.

---

## 3. Financial Invariant Constraints

1. **Exact Sum Constraint:**
   ```sql
   ALTER TABLE orders ADD CONSTRAINT chk_order_budget_tranche_sum
   CHECK (total_amount_cents = (
     SELECT COALESCE(SUM(amount_cents), 0)
     FROM payment_tranches
     WHERE payment_tranches.order_id = orders.id
   ));
   ```
2. **Double-Entry Balance Constraint:**
   For every `ledger_journal_entry_id`:
   $$\sum \text{postings.debit\_cents} = \sum \text{postings.credit\_cents}$$
3. **Isolated Dispute Partition Constraint:**
   A dispute with status `OPEN` cannot lock tranches assigned to parcels not listed in `dispute_parcels`.
