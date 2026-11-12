# User & Profile Management Specification

> **Classification:** Feature Technical Specification  
> **Status:** `Prototype Only` (`html/settings.html`)  
> **Target Milestone:** [MILESTONE_01_AUTH_AND_DATABASE.md](../milestones/MILESTONE_01_AUTH_AND_DATABASE.md)  
> **Last Updated:** 2026-11-09  

---

## 1. Current Repository State

- **`src/` (Next.js App):** No user profile pages or settings screens exist.
- **`html/` (Dashboard Prototype):** `html/settings.html` implements a 4-tab settings interface (`Profile & Identity`, `Wallet & Payouts`, `Notifications`, `Security & API`) with role-aware fields and toast feedback, persisted in browser `localStorage`.

---

## 2. Domain Model

Referenced Prisma tables in [../07_DATABASE_ARCHITECTURE.md](../07_DATABASE_ARCHITECTURE.md):
- `User`: Core identity (`id`, `email`, `passwordHash`, `role`, `activeRole`, `status`).
- `UserProfile`: Extended profile (`displayName`, `headline`, `bio`, `avatarUrl`, `location`, `timezone`, `hourlyRateMinor`, `skills[]`, `githubUrl`, `portfolioUrl`, `companyName`, `trustScore`, `completedProjectsCount`, `onTimeDeliveryRate`).
- `UserWallet`: Linked EVM wallets (`address`, `chainId`, `label`, `isPrimary`, `verifiedAt`).

---

## 3. Functional Requirements

### 3.1 Profile Viewing & Editing
- **Freelancer Profile Fields:** Display name, professional headline, bio, skill tags (max 15 tags), hourly rate (`USDC`), portfolio URL, GitHub handle, availability status (`AVAILABLE`, `LIMITED`, `UNAVAILABLE`), and verified on-chain payout wallet.
- **Client Profile Fields:** Display name, company/organization name, industry, website URL, verified escrow funding wallet, and historical escrow completion rate.
- **Trust & Reliability Metrics (Read-Only, System-Computed):**
  - `completedProjectsCount`: Incremented when a project reaches `COMPLETED`.
  - `aiFirstPassRate`: Percentage of milestone submissions scoring $\ge 80$ on their initial submission.
  - `disputeRate`: Percentage of funded milestones that entered `DISPUTED`.

### 3.2 Linked Wallet Management
- Users can link up to 5 EVM addresses via SIWE signature verification (`POST /api/v1/users/me/wallets`).
- Exactly one wallet is designated `isPrimary = true` for receiving freelancer payouts or funding client escrows by default.
- Removing a wallet (`DELETE /api/v1/users/me/wallets/:walletId`) is blocked if that wallet is currently bound to an active on-chain escrow (`FUNDED`, `IN_PROGRESS`, `SUBMITTED_FOR_REVIEW`, or `DISPUTED`).

---

## 4. API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/users/me` | Fetch authenticated user, profile, notification preferences, and linked wallets |
| `PATCH` | `/api/v1/users/me/profile` | Update profile fields (`displayName`, `headline`, `bio`, `skills`, `companyName`, etc.) |
| `PATCH` | `/api/v1/users/me/preferences` | Update notification preferences (`emailAlerts`, `inAppAlerts`, `aiReportAlerts`) |
| `GET` | `/api/v1/users/:userId/public-profile` | Fetch public profile and verified delivery stats for marketplace/proposal cards |
| `POST` | `/api/v1/users/me/wallets` | Link a new EVM wallet via EIP-4361 signature |
| `PATCH` | `/api/v1/users/me/wallets/:id/primary` | Set primary wallet |
| `DELETE` | `/api/v1/users/me/wallets/:id` | Unlink a non-active wallet |

---

## 5. Acceptance Criteria

- [ ] Profile updates persist to PostgreSQL (`user_profiles`) and sanitize all text fields against stored XSS.
- [ ] Public freelancer profiles display accurate, database-aggregated completion counts and average AI verification scores.
- [ ] Primary wallet cannot be deleted while referenced by an active `Project` or `EscrowDeposit`.

