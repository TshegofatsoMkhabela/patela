# 11 — Security, Privacy & Regulatory Compliance

**Document Version:** 1.0  
**Last Updated:** 2026-11-09  

---

## 1. Application & API Security Controls

| Control Domain | Mandatory Implementation Standard |
|---|---|
| **Authentication & Passwords** | Passwords hashed with **Argon2id** (`memoryCost: 65536`, `timeCost: 3`, `parallelism: 4`). Minimum password length 10 characters. |
| **Session Management** | Server-side stateful sessions stored in PostgreSQL/Redis. Cookie flags: `HttpOnly; Secure; SameSite=Lax; Path=/`. Session ID rotated on login and privilege change. |
| **Role-Based & Resource Access Control** | Every endpoint enforces both system role (`USER`, `ARBITRATOR`, `ADMIN`) and resource ownership (`job.clientId == user.id`, `project.freelancerId == user.id`). Never trust client-supplied `role` or `userId` parameters. |
| **Wallet Signature Verification** | EIP-191 / EIP-4361 (SIWE) message signing with a server-generated, single-use cryptographic nonce expiring in 5 minutes and bound to Chain ID `84532`. |
| **File Upload & Storage Security** | Private S3-compatible bucket (block all public ACLs). Pre-signed upload URLs enforce strict `Content-Length` ($\le 25\text{ MB}$) and allowed MIME types. Downloaded files use `Content-Disposition: attachment` and `X-Content-Type-Options: nosniff` to prevent stored XSS. |
| **Input Validation & Injection Defense** | All request bodies, query params, and headers validated with Zod / `class-validator`. Database queries executed exclusively through parameterized Prisma ORM queries. All dynamic strings in HTML views escaped via `escapeHtml`. |
| **CSRF, CORS & Rate Limiting** | Double-submit / session-bound `X-CSRF-Token` required on mutations. Strict CORS allowlist (`NEXT_PUBLIC_SITE_URL`). Redis-backed sliding-window rate limits on `/auth/*`, `/submissions/*`, and `/ai-review/*`. |
| **Secrets Management** | All credentials (`DATABASE_URL`, `SESSION_SECRET`, `AI_API_KEY`, `S3_SECRET_KEY`) loaded from environment variables and validated at startup. Never commit `.env` files, private keys, or seed phrases. |

---

## 2. Smart-Contract & Financial Security Controls

1. **Non-Custodial Architecture:** Patela's backend never holds user private keys and never acts as an intermediate EOA custodian of escrow funds.
2. **Reentrancy & SafeERC20:** All token-moving functions in `PatelaEscrow.sol` use OpenZeppelin `ReentrancyGuard` (`nonReentrant`), `SafeERC20`, and Checks-Effects-Interactions (CEI).
3. **Replay & Cross-Chain Protection:** Project IDs (`bytes32`) incorporate chain ID and agreement salt; wallet signatures bind explicitly to `chainId = 84532`.
4. **Idempotency & Finality:** Financial API mutations require `Idempotency-Key`, and on-chain state transitions require confirmed block depth ($N \ge 2$) and canonical `blockHash` verification before updating ledger balances.
5. **Audit Trail & Incident Response:** `PatelaEscrow.sol` includes an emergency `Pausable` circuit breaker (`pause()` / `unpause()` restricted to `ADMIN_ROLE`) that can halt new deposits while never allowing admin seizure of existing locked funds.

---

## 3. South African Legal & Regulatory Compliance Research (Pre-Mainnet Gate)

> **CRITICAL NOTICE:** Deployment of the **Base Sepolia Testnet MVP** uses zero-value test tokens (`pUSD`) for technical validation only. Before Patela can ever deploy to Mainnet or process real-value stablecoins, formal legal review and licensing verification must be completed under South African law:

1. **FSCA & Crypto Asset Service Provider (CASP) Licensing (FAIS Act):**
   - Crypto assets are declared a "financial product" under the Financial Advisory and Intermediary Services (FAIS) Act by the Financial Sector Conduct Authority (FSCA).
   - Legal counsel must determine whether operating a smart-contract escrow marketplace and providing human dispute arbitration (`ARBITRATOR_ROLE`) constitutes an intermediary or custody/administration service requiring a **CASP FSP license**, even when funds are held in an on-chain smart contract.
2. **Financial Intelligence Centre Act (FICA) — AML / KYC / CFT:**
   - Schedule 1 of FICA includes Crypto Asset Service Providers as Accountable Institutions.
   - Before mainnet launch, Patela must determine FICA registration requirements, Risk Management and Compliance Programme (RMCP) obligations, customer due diligence (KYC/KYB), sanctions screening, and Travel Rule reporting thresholds.
3. **Protection of Personal Information Act (POPIA):**
   - As the Responsible Party processing personal data (user profiles, emails, IP logs, dispute evidence, and deliverable files sent to an LLM provider), Patela must enforce POPIA conditions: explicit consent/contractual necessity, cross-border data transfer safeguards (Section 72 of POPIA for cloud/LLM providers), data minimization, security safeguards (Section 19), and data subject access/deletion rights.
4. **South African Reserve Bank (SARB) Exchange Control Regulations:**
   - Assess cross-border crypto asset transfer implications under the Currency and Exchanges Act and SARB FinSurv guidelines.
5. **Electronic Communications and Transactions Act (ECTA) & Consumer Protection:**
   - Ensure digital project agreements (`ProjectAgreement`) satisfy ECTA requirements for valid electronic contracts and dispute resolution clauses.

