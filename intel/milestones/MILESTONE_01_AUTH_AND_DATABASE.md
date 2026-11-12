# Milestone 01: Authentication and Database

## Objective
Establish reliable user accounts, server-managed session authentication, unified Client/Freelancer profile capabilities, role-based access control (`USER`, `ARBITRATOR`, `ADMIN`), and persistent PostgreSQL storage using Prisma ORM.

## Scope
- Bootstrap `apps/api` (NestJS + Fastify + TypeScript) and connect to PostgreSQL 16 via Prisma.
- Author initial Prisma schema (`User`, `Profile`, `AuthSession`, `Wallet`, `ActivityLog`, `IdempotencyKey`, `OutboxEvent`, plus foundational domain tables).
- Implement Argon2id registration, login, logout, email verification, and password reset.
- Implement user profile viewing/editing, avatar upload URLs, and unified Client/Freelancer persona support.

## Dependencies
- [`MILESTONE_00_FOUNDATION.md`](./MILESTONE_00_FOUNDATION.md) (`FND-005`–`FND-007`).

## Tasks
- [ ] `DB-001`: Database configuration & NestJS API bootstrap.
- [ ] `DB-002`: Initial Prisma schema with `BIGINT` base-unit financial columns.
- [ ] `DB-003`: `User` and `Profile` models and repositories.
- [ ] `DB-004`: Stateful `AuthSession` service with HTTP-only cookies and CSRF protection.
- [ ] `DB-005`: Registration (`POST /api/v1/auth/register`).
- [ ] `DB-006`: Login (`POST /api/v1/auth/login`).
- [ ] `DB-007`: Logout (`POST /api/v1/auth/logout`).
- [ ] `DB-008`: Email verification flow.
- [ ] `DB-009`: Password reset request and confirmation flow.
- [ ] `DB-010`: User profile endpoints (`GET/PATCH /api/v1/users/profile`) and Next.js settings integration.
- [ ] `DB-011`: Role and permission guards (`SessionAuthGuard`, `RolesGuard`).
- [ ] `DB-012`: Database migrations, SQL check constraints, deterministic seed script, and integration tests.

## Technical Implementation
- Use `@nestjs/platform-fastify`, `@fastify/cookie`, `argon2`, and `@prisma/client`.
- Store session tokens as SHA-256 hashes in `AuthSession.tokenHash` so raw session tokens are never stored in plain text in PostgreSQL.
- Allow every `User` account to operate as both a Client and a Freelancer via `Profile.activePersona`, while enforcing per-resource participant checks.

## Database Changes
- Creates `User`, `Profile`, `AuthSession`, `Wallet`, `ActivityLog`, `IdempotencyKey`, and `OutboxEvent` tables via Prisma migrations.

## API Changes
- Implements `/api/v1/auth/register`, `/api/v1/auth/login`, `/api/v1/auth/logout`, `/api/v1/auth/me`, `/api/v1/auth/verify-email`, `/api/v1/auth/password-reset/*`, and `/api/v1/users/profile`.

## Frontend Changes
- Add `/login` and `/register` pages in `src/app/` (resolving `ISS-006`) and connect profile settings to `/api/v1/users/profile`.

## Backend Changes
- Introduces `apps/api/src/auth/*`, `apps/api/src/users/*`, and `apps/api/src/common/*`.

## Blockchain Changes
- Prepares the `Wallet` table schema (`address`, `chainId = 84532`, `verifiedAt`); actual on-chain signing is implemented in Milestone 04.

## Security Considerations
- Argon2id password hashing; constant-time comparison; sliding-window rate limiting on login/register/password-reset; `HttpOnly; Secure; SameSite=Lax` cookies; CSRF token validation on all mutations.

## Testing Requirements
- Unit tests for Argon2id hashing, session token hashing, and RBAC guards.
- API integration tests covering registration, duplicate email (`409`), login, invalid password (`401`), session expiration, logout revocation, and profile updates.

## Acceptance Criteria
1. Users can register, log in, view `/api/v1/auth/me`, update their profile, switch active persona (`CLIENT`/`WORKER`), and log out.
2. Protected endpoints reject unauthenticated or CSRF-missing requests.
3. All `DB-001`–`DB-012` integration tests pass against PostgreSQL.

## Implementation History
- None yet (`PLANNED`).

## Known Issues
- Resolves `ISS-006` (Placeholder Login Link).

## Current Status
`PLANNED`

## Completion Evidence
- Pending implementation.

