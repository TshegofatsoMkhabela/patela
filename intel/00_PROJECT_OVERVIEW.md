# 00 — Project Overview: Patella

**Document Version:** 1.1 (Updated for Technical Architecture v0.3 & UX Blueprint v1.0)  
**Last Updated:** 2026-11-13  
**Status:** Approved Architectural Baseline

---

## 1. Product Vision

Patella is a **B2B order, custody, and payment coordination platform for multi-hop supply chains and logistics in South Africa**.

Patella connects **commercial buyers (consignors)** who procure bulk commodities and industrial goods with **suppliers and freight logistics carriers** who transport cargo across road, rail, and port corridors. Patella combines:

1. **Route-Agnostic Multi-Hop Logistics:** Models any logistics corridor—from direct point-to-point transport to 20-stop road, rail, cross-dock, and bonded warehouse networks—as a directed graph with explicit custody handoff proofs.
2. **Declarative Versioned Payment Plans:** Payment rules are structured data (not hardcoded code), versioned upon mutual cryptographic agreement. Tranche amounts are evaluated and released automatically upon verified milestone events.
3. **Strict Conservation of Money:** $\sum \text{tranches} = \text{escrowed total}$ in South African Rand (ZAR). Enforced at the API layer, in the internal double-entry ledger, and in the smart contract vault.
4. **Rand In, Rand Out Settlement:** Transact natively in ZAR. Fiat deposits are held in a ring-fenced client trust account with a licensed South African bank partner (e.g. Standard Bank) and converted into a 1:1 rand-pegged stablecoin (`ZARP`) locked in an on-chain `EscrowVault` on **Base Sepolia (`84532`)**.
5. **Guest-First Two-Party Mobile Handoffs:** Frontline truck drivers and warehouse receiving staff authenticate via short-lived, single-use SMS/WhatsApp tokens (`GST-01`, `GST-02`, `GST-03`). Both releasing and receiving parties execute simultaneous digital signatures from any mobile browser with **zero app installation and zero crypto wallet requirement**.
6. **Isolated Parcel Dispute Holding:** If a parcel or consignment is damaged, short, or delayed, dispute holding is isolated strictly to that parcel's assigned payment tranche. Unaffected parcels and tranches continue moving and paying without delay.
7. **Honest Trust Boundary Disclosure:** Patella explicitly discloses what technology proves and what it does not prove: a cryptographic scan confirms that two designated parties authenticated and confirmed physical handover at a specific timestamp and GPS coordinate. It is not an independent chemical/assayer condition check and does not physically prevent road hijackings.

---

## 2. Problem Statement

### 2.1 Challenges Faced by Commercial Buyers & Consignors
- **Payment Insecurity:** Paying upfront or issuing irrevocable letters of credit before cargo arrives exposes buyers to non-delivery, damaged goods, or supplier insolvency.
- **Whole-Order Freezes:** On traditional platforms, an issue with one truckload in a 20-truck consignment halts payment for the entire contract, damaging relations with honest subcontractors.
- **Fragmented Visibility:** Shipments change hands across multiple subcontractors, cross-dock warehouses, and rail operators with zero unified chain of custody.

### 2.2 Challenges Faced by Suppliers & Logistics Carriers
- **Severe Working Capital Drag:** 60- to 90-day payment terms force transport operators to finance fuel, tolls, and driver salaries before receiving payment.
- **Arbitrary Offsets & Non-Payment:** Buyers frequently delay or deduct from freight invoices citing unverifiable receiving discrepancies.
- **Tech Adoption Resistance:** Frontline drivers cannot and will not install complex mobile apps, register passwords, or manage seed phrases.

### 2.3 The Patella Solution: Four-Pillar Coordination
1. **The Route & Custody Graph:** Directed graph with explicit custody nodes, proof levels, and active custody holder accountability.
2. **The Declarative Agreement:** Versioned dual-signed contract specifying line items, split consignments, and exact payment tranche triggers.
3. **The EscrowVault & Licensed Bank Trust:** Fiat ZAR held in licensed bank trust accounts, mirrored into audited `EscrowVault` smart contracts on Base Sepolia. Releases require Release Authority (KMS/HSM) signatures.
4. **The Frictionless Handoff:** Ephemeral mobile web links enabling simultaneous dual signatures at the tailgate or loading bay in under 60 seconds.

---

## 3. Core Roles & Actors

1. **Commercial Buyer / Consignor:** Initiates orders and RFQs, funds escrow via bank deposit, reviews custody progress, inspects receiving certificates, and approves exceptions.
2. **Supplier / Seller:** Agrees to commercial terms, commits inventory, dispatches initial consignments, and receives milestone payouts.
3. **Logistics Operator / Freight Carrier:** Bids on freight routes, assigns drivers and fleet vehicles, and monitors corridor transit times.
4. **Guest Driver & Warehouse Receiver:** Uses short-lived mobile tokens to inspect cargo, record condition notes, and execute two-party handoff signatures.
5. **Auditor / Regulatory Inspector:** Uses read-only access to verify chronological custody event hashes and Base Sepolia block anchor proofs.
6. **Operations Console Agent (Admin):** Manages enterprise KYB verification, triages isolated disputes, monitors ledger vs vault reconciliation, and oversees emergency pause controls.

---

## 4. End-to-End Coordination Journey (8 Stages)

1. **Stage 1 — Order & Agreement Initiation:** Buyer creates order or RFQ (`ORD-01`, `TEN-01`); parties sign canonical agreement v1.0 (`ORD-02`).
2. **Stage 2 — Route & Parcel Configuration:** Logistics corridor configured as a directed graph (`ROUTE-01`); parcels mapped to delivery nodes.
3. **Stage 3 — Declarative Payment Plan:** Milestone triggers and tranche amounts defined (`PAY-01`); money conservation verified ($\sum \text{tranches} = \text{total}$).
4. **Stage 4 — Rand Escrow Funding:** Buyer transfers ZAR to bank trust account (`PAY-02`); `EscrowVault` locks ZARP on Base Sepolia.
5. **Stage 5 — Active Custody Tracking:** Parcels traverse route graph (`SHIP-01`); active custody holder identified at all times.
6. **Stage 6 — Two-Party Guest Handoff:** Driver and dock clerk scan ephemeral link (`GST-01`, `GST-02`); dual signatures and photos recorded.
7. **Stage 7 — Rule-Triggered Release:** Verified event satisfies declarative rule; KMS Release Authority signs release; funds settle to payee in ZAR.
8. **Stage 8 — Isolated Dispute & Audit:** Exceptions isolated to affected parcel (`DIS-01`); read-only auditor trail verified on-chain (`AUD-01`).

---

## 5. Architectural Invariants

- **Invariant 1 (Conservation of Money):** At all times, $\sum \text{tranches} = \text{escrowed total}$. Checked in API, ledger, and smart contract.
- **Invariant 2 (Release Authority):** The smart contract never accepts plain API calls; releases require rule engine evaluation + Release Authority KMS/HSM signature.
- **Invariant 3 (Guest Zero-Install):** No app download, registration, or crypto wallet is ever required for drivers or dock workers performing handoffs.
- **Invariant 4 (Isolated Holding):** An exception in Parcel $N$ holds only Tranche $N$; all other parcels and tranches continue unhindered.
- **Invariant 5 (Honest Trust):** Scans prove physical handover agreement between two identified parties, not independent assayer quality.
