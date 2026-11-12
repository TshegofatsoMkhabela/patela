# 04 — Technology Stack: Patella

**Document Version:** 1.1 (Updated for Technical Architecture v0.3)  
**Last Updated:** 2026-11-13  
**Status:** Approved Architectural Baseline

---

## 1. 4-Tier System Architecture Overview

According to *Patella Technical Architecture v0.3* (@Thabiso), Patella is structured across four clean architectural tiers:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        TIER 1: CLIENTS & PORTALS                       │
│  Next.js 15 SPA (src/)  │  Guest Mobile Web (GST)  │  Operations Console│
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTPS / REST / JSON
┌───────────────────────────────────▼────────────────────────────────────┐
│                      TIER 2: API GATEWAY & BFF                         │
│   NestJS + Fastify  │  Session & Rate Limiting  │  Twilio SMS/WhatsApp │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Internal Event Bus & DI
┌───────────────────────────────────▼────────────────────────────────────┐
│                    TIER 3: DOMAIN SERVICES & WORKERS                   │
│  • Order & RFQ Service        • Route Graph & Custody Engine           │
│  • Declarative Rules Engine   • Double-Entry Money Engine & Ledger     │
│  • Isolated Dispute Manager   • BullMQ Event Bus (Redis 7)             │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Async Jobs, Signatures & RPC
┌───────────────────────────────────▼────────────────────────────────────┐
│            TIER 4: CHAIN LAYER & EXTERNAL INFRASTRUCTURE               │
│  • Base Sepolia (84532)       • EscrowVault & AnchorRegistry (Solidity)│
│  • ZARP Rand Stablecoin       • AWS KMS / Cloud HSM Release Authority  │
│  • Standard Bank Trust API    • MinIO / S3 Evidence Vault              │
│  • PostgreSQL 16 (28 Entities)• Google Gemini 2.5 Flash (Advisory OCR) │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Component Technology Details

| Tier / Subsystem | Technology | Version / Specification | Rationale & Responsibility |
|---|---|---|---|
| **Tier 1: Web App** | Next.js + React | `15.x` / `19.x` + TypeScript `5.8` | App Router for marketing pages, authenticated buyer/supplier portals, and interactive supply-chain views. |
| **Tier 1: Mobile Guest Web** | Vanilla HTML5 / ES6 WebCrypto | Native Mobile Browser | Zero-app, zero-wallet single-use guest handoffs (`GST-01`, `GST-02`) on iOS & Android. |
| **Tier 1: Enterprise Hub** | Standalone HTML Prototype | `html/` directory (18 screens) | Authoritative reference UI for route graphs, dual signatures, and auditor consoles. |
| **Tier 2: API Gateway** | NestJS + `@nestjs/platform-fastify` | `10.x` / Fastify `4.x` | High-throughput async REST API serving `/api/v1/*` with strict Zod validation. |
| **Tier 2: Messaging Gateway** | Twilio SMS & WhatsApp API | Official Node SDK | Ephemeral guest handoff link dispatch to South African mobile numbers (+27). |
| **Tier 3: Database** | PostgreSQL | `16-alpine` | Relational source of truth supporting the 28 core domain entities and ACID transactions. |
| **Tier 3: In-Memory / Bus** | Redis & BullMQ | Redis `7-alpine` / BullMQ `5.x` | Pub/sub event bus, queue worker scheduling, and rate limiting. |
| **Tier 3: Rules Engine** | JSON Logic / Declarative Engine | Deterministic Evaluator | Evaluates versioned payment triggers against verified custody events. |
| **Tier 3: Ledger Engine** | Double-Entry Accounting | Internal Cents/Integer Engine | Mathematically guarantees money conservation: $\sum \text{tranches} = \text{total escrowed}$. |
| **Tier 4: Blockchain Network** | Base Sepolia | Chain ID `84532` (`0x14a34`) | High-speed, low-gas EVM Layer 2 for smart contract custody and event anchor registry. |
| **Tier 4: Smart Contracts** | Solidity + Foundry | Solidity `0.8.24+` / OpenZeppelin `5.x` | `EscrowVault.sol` (funds custody) and `AnchorRegistry.sol` (SHA-256 byte anchors). |
| **Tier 4: Settlement Token** | ZARP (Rand Stablecoin) | ERC-20 (18 decimals / 1:1 ZAR) | Enables programmable on-chain escrow denominated directly in South African Rand. |
| **Tier 4: Release Authority** | AWS KMS / Cloud HSM | `secp256k1` / EIP-712 | Signs authorized release transactions only after domain service invariant checks pass. |
| **Tier 4: Banking Partner** | Standard Bank South Africa | Corporate Host-to-Host / API | Ring-fenced client trust accounts holding fiat ZAR deposits with daily bank reconciliation. |
| **Tier 4: Private Storage** | MinIO (Dev) / Cloudflare R2 / S3 | S3-Compatible API | Secure vault for signed PODs, weighbridge slips, and assayer certificates. |
| **Tier 4: Advisory OCR** | Google Gemini API | `gemini-2.5-flash` | Extracts structured metadata (invoice number, vat, net weight) from uploaded delivery slips. |

---

## 3. Base Sepolia Network & Contract Configuration (`84532`)

All blockchain interactions target **Base Sepolia** testnet:

| Parameter | Value |
|---|---|
| **Network Name** | Base Sepolia |
| **Chain ID (Decimal)** | `84532` |
| **Chain ID (Hex)** | `0x14a34` |
| **Native Gas Currency** | Sepolia ETH (`ETH`, 18 decimals) |
| **Default Public RPC** | `https://sepolia.base.org` |
| **Block Explorer** | `https://sepolia.basescan.org` |
| **Escrow Vault Contract** | `EscrowVault.sol` (Multi-tranche, rule-governed ZARP lock) |
| **Anchor Registry Contract**| `AnchorRegistry.sol` (Merkle/SHA-256 event anchoring) |
| **Settlement Currency** | South African Rand (`ZAR` fiat) / `ZARP` stablecoin |

---

## 4. Migration & Integration Strategy

1. **Standalone HTML Prototype (`html/`) as Live UX Reference:**
   - The 18 screens and JavaScript modules in `html/` serve as the functional reference for graph rendering, guest signature workflows, and ledger reconciliation.
2. **Next.js Frontend Integration (`src/`):**
   - Marketing, documentation, and client portals route cleanly between Next.js pages and the `/html/` prototype via `src/app/html/[[...slug]]/route.ts`.
3. **Backend & Contract Provisioning (`apps/api`, `contracts/`):**
   - Standalone infrastructure provisioned via `infrastructure/docker-compose.yml` (`postgres`, `redis`, `minio`).
   - Foundry smart-contract workspace in `contracts/` with invariant tests for conservation of money.
