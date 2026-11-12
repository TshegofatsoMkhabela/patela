# 08 — API Documentation: Patella

**Document Version:** 1.1 (Updated for Technical Architecture v0.3)  
**Last Updated:** 2026-11-13  
**Status:** Approved Architectural Baseline

---

## 1. REST API Overview

The Patella API is served via NestJS + Fastify at `/api/v1/*`. All financial values are communicated as integer cents in ZAR (`amount_cents`). All date/times are ISO 8601 UTC.

Standard response envelope:
```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "meta": { "timestamp": "2026-11-13T00:00:00Z", "requestId": "req_8941" }
}
```

---

## 2. Core API Endpoints

### 2.1 Orders & Canonical Agreements (`ORD-01`, `ORD-02`, `TEN-01`)
- **`GET /api/v1/orders`**: List orders filtered by status (`DRAFT`, `ACTIVE`, `IN_TRANSIT`, `DISPUTED`, `COMPLETED`), role (buyer/supplier/carrier), and search queries.
- **`POST /api/v1/orders`**: Create a new commercial order with line items, consignment parcels, and assigned participants.
- **`GET /api/v1/orders/:id`**: Fetch full order details including canonical agreement v1.0, active version hash, route graph ID, and payment plan ID.
- **`POST /api/v1/orders/:id/sign`**: Submit cryptographic signature for canonical agreement (buyer or supplier). When both parties sign, status transitions to `PENDING_FUNDING`.
- **`POST /api/v1/orders/:id/rfq/tender-bids`**: Submit encrypted freight tender bid for freight carriers (`TEN-01`).
- **`POST /api/v1/orders/:id/rfq/award`**: Award RFQ tender to selected carrier, automatically mapping carrier to route edges.

### 2.2 Route Graph & Custody Corridor (`ROUTE-01`, `SHIP-01`)
- **`POST /api/v1/routes`**: Create route graph template (Simple Direct, Multi-Hop Road/Rail, Split Consignment, Hub-and-Spoke).
- **`GET /api/v1/routes/:id`**: Retrieve full directed graph topology (nodes, edges, active custody holder, proof requirements).
- **`POST /api/v1/routes/:id/validate`**: Execute graph cycle detection, sequence connectivity, and proof-level validation.
- **`GET /api/v1/routes/:id/active-custody`**: Query currently accountable carrier/node for each parcel.

### 2.3 Declarative Payment Plans & Escrow Funding (`PAY-01`, `PAY-02`, `PAY-03`)
- **`POST /api/v1/payments/plans`**: Submit declarative payment plan with milestone tranches and JSON Logic release rules.
  - *Invariant Validation:* Rejects with `422 Unprocessable Entity` if $\sum \text{tranches} \ne \text{order.total\_amount\_cents}$.
- **`POST /api/v1/escrow/fund`**: Initiate 5-stage funding pipeline: generates bank deposit reference for Standard Bank client trust account.
- **`POST /api/v1/escrow/confirm-mint`**: Webhook from treasury service confirming ZARP minted/transferred into Base Sepolia `EscrowVault`.
- **`GET /api/v1/payments/balances`**: Returns ZAR financial buckets: **Available**, **Locked in Escrow**, and **Payable / Releasable**.
- **`GET /api/v1/payments/ledger`**: Query double-entry general ledger journal entries and postings for the organization.

### 2.4 Guest Mobile Handoff Engine (`GST-01`, `GST-02`, `GST-03`)
- **`POST /api/v1/handoffs/token`**: Generate single-use ephemeral token (4-hour TTL) for a designated node and phone number. Dispatches SMS/WhatsApp link.
- **`GET /api/v1/handoffs/guest/:token`**: Resolve guest portal session: displays handover details, parcel checklist, condition notes, and signature pads without requiring login.
- **`POST /api/v1/handoffs/guest/:token/execute`**: Submit simultaneous dual digital signatures (releasing driver + receiving dock clerk) with GPS location and attached condition photos.
  - *Engine Execution:* Records custody transfer, permanently consumes token, appends event to audit log, and triggers rule engine evaluation.

### 2.5 Isolated Parcel Disputes & Exceptions (`DIS-01`)
- **`POST /api/v1/disputes`**: Open commercial dispute specifying affected parcel IDs, claim amount, reason (`DAMAGE`, `SHORTAGE`, `DELAY`), and evidence attachments.
  - *Blast Radius Enforcement:* Holds only the affected parcel's payment tranche; all unaffected parcels remain `ACTIVE`.
- **`GET /api/v1/disputes/:id`**: Retrieve dispute triage dossier, evidence photos, assayer certificates, and timeline.
- **`POST /api/v1/disputes/:id/ruling`**: Operations agent submits formal ruling (percentage split or full refund) and executes atomic ledger reallocations.

### 2.6 Carrier Partner Directory (`PART-01`, `PART-02`)
- **`GET /api/v1/partners`**: Search vetted freight carriers with filters for CIPC registration, goods-in-transit insurance limits, and corridor experience.
- **`GET /api/v1/partners/:id/rate-card`**: Fetch freight rate schedules (rate per ton-km, minimum dispatch fees).

### 2.7 Auditor Trail & Blockchain Anchors (`AUD-01`, `AUD-02`)
- **`GET /api/v1/audit/trail/:orderId`**: Query append-only chronological custody event log with actor IDs, timestamps, and SHA-256 byte hashes.
- **`POST /api/v1/audit/verify-document`**: Accepts file payload or hash; verifies whether exact SHA-256 matches an on-chain Base Sepolia `AnchorRegistry` entry.

### 2.8 Operations Console & Emergency Controls (`OPS-01` to `OPS-05`)
- **`GET /api/v1/operations/triage`**: Triage queues for pending KYB verifications, open disputes, and unconfirmed bank deposits.
- **`POST /api/v1/operations/pause`**: Multi-signature admin emergency pause for `EscrowVault` smart contract.
- **`GET /api/v1/operations/reconciliation`**: Automated reconciliation matrix comparing Standard Bank trust balances, Base Sepolia `EscrowVault` balances, and PostgreSQL internal ledger totals.
