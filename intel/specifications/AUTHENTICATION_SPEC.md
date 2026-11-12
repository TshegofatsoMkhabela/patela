# Authentication & Authorization Specification

> **Classification:** Feature Technical Specification  
> **Status:** `Missing` (Prototype role switcher only in `html/`)  
> **Target Milestone:** [MILESTONE_01_AUTH_AND_DATABASE.md](../milestones/MILESTONE_01_AUTH_AND_DATABASE.md)  
> **Last Updated:** 2026-11-09  

---

## 1. Current Repository State

- **`src/` (Next.js App):** Zero authentication routes, session cookies, or user identity checks exist. Anyone visiting `/post-job` or `/jobs/[jobId]` can perform both client and freelancer actions in local browser state.
- **`html/` (Dashboard Prototype):** Includes a topbar role switcher (`Client View` vs. `Worker View`) stored in `localStorage` (`patela_proto_state_v3.role`), switching between persona `Elena Vance (Client)` and `Marcus Vance (Freelancer)`.

---

## 2. Target Authentication Architecture

Patela supports **dual authentication methods** that converge on a unified `User` and `Session` model:
1. **Email + Password Authentication** (`Argon2id` password hashing).
2. **Sign-In With Ethereum (SIWE / EIP-4361)** cryptographic wallet signature authentication on Base Sepolia (`Chain ID: 84532`).

A user who registers with Email + Password can later link one or more Web3 wallets (`UserWallet`), and a user who registers via SIWE can later add a verified email address.

### 2.1 Token & Session Model
- **Access Token:** Short-lived (`15 minutes`) JWT signed with `HS256` (`JWT_ACCESS_SECRET`), containing `{ sub: userId, role: activeRole, roles: allowedRoles, sessionId }`.
- **Refresh Token:** `7 days` opaque token stored in an `HttpOnly`, `Secure`, `SameSite=Lax` cookie, with its SHA-256 hash stored in `sessions.refresh_token_hash` for rotation and instant revocation.

---

## 3. Core Flows

### 3.1 Email Registration & Login
1. `POST /api/v1/auth/register` validates `{ email, password, displayName, primaryRole: 'CLIENT' | 'FREELANCER' }`.
2. Hashes password using `Argon2id` (`memoryCost: 65536`, `timeCost: 3`, `parallelism: 4`).
3. Creates `User`, `UserProfile`, and initial `Session`.
4. Returns `accessToken` + sets `refresh_token` cookie.

### 3.2 Sign-In With Ethereum (SIWE / EIP-4361)
1. Client requests `POST /api/v1/auth/siwe/nonce` with `{ walletAddress, chainId: 84532 }`.
2. Backend generates a cryptographically random single-use nonce (`16 bytes` hex) stored in Redis (`siwe:nonce:<nonce>`, TTL `300s`).
3. Frontend constructs an EIP-4361 message binding domain, address, statement, URI, version `1`, chainId `84532`, and nonce, and prompts `personal_sign`.
4. Client sends `POST /api/v1/auth/siwe/verify` with `{ message, signature }`.
5. Backend verifies signature via `viem.verifySiweMessage`, consumes the Redis nonce atomically, and either logs in the matched `UserWallet` owner or links/creates the account.

### 3.3 Role Switching (`CLIENT` ↔ `FREELANCER`)
- Users may hold both `CLIENT` and `FREELANCER` capabilities (`canPostJobs`, `canApplyToJobs`).
- `PATCH /api/v1/users/me/active-role` updates `activeRole` (`CLIENT` or `FREELANCER`) so the dashboard UI renders the appropriate navigation and KPIs, while resource-level authorization always verifies explicit ownership (`job.clientId === user.id` or `project.freelancerId === user.id`).

---

## 4. Authorization & RBAC Rules

| Guard | Rule |
|---|---|
| `JwtAuthGuard` | Validates bearer token or session cookie on all protected endpoints |
| `RolesGuard` | Restricts `/api/v1/admin/*` and dispute resolution actions exclusively to `UserRole.ADMIN` |
| `ProjectParticipantGuard` | Ensures only `project.clientId`, `project.freelancerId`, or `ADMIN` can view project milestones, submissions, or messages |

---

## 5. Acceptance Criteria

- [ ] Unauthenticated requests to `/dashboard/*` redirect to `/login`.
- [ ] Passwords under 10 characters or missing complexity fail DTO validation with `400 Bad Request`.
- [ ] Replaying a used SIWE nonce returns `401 Unauthorized`.
- [ ] Refresh token rotation invalidates the entire session family if token reuse is detected.

