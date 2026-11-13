# Patela backend

This is the backend for Patela's proof-at-handoff demo. It contains no frontend and no escrow contract. It creates application profiles from verified Google identities or email OTP, stores first-party sessions in PostgreSQL, onboards businesses for admin approval, invites staff to a business, links wallets by signature, stores order data in PostgreSQL, issues short-lived handoff challenges, verifies both handoff signatures, and projects **confirmed escrow events** into dashboard data. It also exposes authenticated Google Routes and speech endpoints.

The backend does not hold a private key or send a ZARP transaction. A wallet or relayer must submit the contract calls. `/verify` endpoints read transaction receipts and only then change payment/verification status.

## Run locally

Requirements: Node 22+, PostgreSQL, and a Google Cloud OAuth Web application client. The backend's tests use embedded PostgreSQL and need no Docker.

1. Run `npm ci` in this directory.
2. Copy `.env.example` to `.env`. Fill `DATABASE_URL`, `GOOGLE_OAUTH_CLIENT_ID`, `PUBLIC_ORIGIN`, and `API_ORIGIN`. `API_ORIGIN` is the browser-reachable backend origin; locally use `http://localhost:4000` with a frontend on `http://localhost:3000`. `GOOGLE_OAUTH_CLIENT_SECRET` is optional and enables the authorization-code route. Keep secrets outside Git.
3. In Google Cloud, create an OAuth client of type **Web application** and add the frontend's origin to Authorized JavaScript origins for Google Identity Services. For authorization-code sign-in, also add `${API_ORIGIN}/auth/google/callback` as an authorized redirect URI and configure its client secret. Configure the consent screen for the accounts that should sign in. No Supabase project is used.
4. Run `npm run migrate` against the application database, then `npm run dev`. The migrator applies each `migrations/*.sql` file once, in name order, and records it in `schema_migrations`. `002_organizations.sql` resets old per-person trading roles (buyer, supplier, etc.) to `member`; trading rights now come from approved businesses.
5. Create the first admin by signing in once, then changing that specific profile's `role` to `admin` directly in PostgreSQL. There is deliberately no public admin-registration endpoint.
6. Set `CHAIN_ID=84532`, a deployed test token's `TOKEN_ADDRESS`, `TOKEN_DECIMALS`, `ESCROW_ADDRESS`, and a Base Sepolia `BASE_RPC_URL` for rehearsals. For real ZARP use `CHAIN_ID=8453`, `TOKEN_ADDRESS=0xb755506531786C8aC63B756BaB1ac387bACB0C04`, `TOKEN_DECIMALS=18`, and the separately verified Base escrow address.

The backend binds to localhost by default. Deploy behind HTTPS with request limits and a trusted Postgres connection. Browser/PostgREST roles have no RLS policies for these tables; all application data access goes through this API.
For Amazon RDS, set `DATABASE_SSL=true` and load the RDS CA certificate into Node's trust store. The Lambda stack sets `NODE_EXTRA_CA_CERTS=/var/runtime/ca-cert.pem`; local RDS connections need an appropriate CA bundle. The PostgreSQL client verifies the server certificate and hostname.
Rate limits currently use process memory. A multi-instance deployment needs a shared limiter or an API gateway. Clients signing returned EIP-712 JSON should convert the decimal `uint256` strings to integer values accepted by their wallet library.

For Google Identity Services sign-in, the frontend obtains Google's ID token with the Web client ID and sends `{ "credential": "<ID token>" }` as JSON to `POST ${API_ORIGIN}/auth/google/id-token` from an allowed origin. The backend verifies Google's signature, audience, expiration, subject, and verified email through `google-auth-library`; it creates or finds a PostgreSQL profile and sets HTTP-only session cookies. `GET /me` confirms login. The temporary API-only smoke page at `/auth/google/test` is served only when `ENABLE_AUTH_SMOKE_PAGE=true`; turn it off after testing. Access tokens last one hour, refresh tokens rotate and last 30 days. `POST /auth/logout` revokes the current session. Deploy frontend and API under the same site with HTTPS so `SameSite=Lax` and `Secure` cookies work as intended.

When `GOOGLE_OAUTH_CLIENT_SECRET` is configured, the existing authorization-code flow also works through `${API_ORIGIN}/auth/google/start`. It uses a five-minute state and PKCE cookie, exchanges the code, verifies the ID token, and redirects to the frontend or `/auth/success` for an API-only test. Without a secret, these code-flow routes return 503. `GET /auth/google/url` offers the same start as JSON, but its caller must use credentialed fetch so the challenge cookie reaches the browser.

## API flow

Protected routes accept an HTTP-only session cookie or `Authorization: Bearer <Patela access token>`. An invalid token cannot create a profile.

| Step | Route | Result |
| --- | --- | --- |
| Sign in | `POST /auth/otp/request` with email, then `POST /auth/otp/verify` with email and six-digit code | PostgreSQL stores a hashed, single-use code and queues a delivery in `email_outbox`; verification creates a `member` profile with **no trading rights**. Email delivery still needs a sender. |
| Google sign-in | `POST /auth/google/id-token` with a Google Identity Services credential | Backend verifies the signed token and creates a `member` profile and session cookies. The authorization-code route at `GET /auth/google/start` is available when a client secret is configured. |
| Onboarding status | `GET /onboarding` | Profile, the caller's businesses with their status and member role, and `nextStep`: `create_organization`, `submit_for_review`, `awaiting_review`, `fix_and_resubmit`, or `ready`. |
| Register business | `POST /organizations` with `legalName`, `registrationNumber` (CIPC format `2019/123456/07`), optional `vatNumber`, and `capabilities` (any of buyer, supplier, warehouse, carrier) | Creates a `draft` business with the caller as owner. One business can hold several capabilities. `PATCH /organizations/:id` edits it while draft or rejected. |
| Submit for review | `POST /organizations/:id/submit` | Owner/admin moves it to `submitted` and an `organization_submitted` email is queued. Details lock until reviewed. |
| Review business | Platform admin: `GET /admin/organizations?status=submitted`, then `POST /admin/organizations/:id/review` with `decision` `approve` or `reject` (reject needs a `reason`) | Sets `approved` or `rejected` and queues an email to every owner. A rejected business can edit and resubmit. |
| Invite staff | Owner/admin: `POST /organizations/:id/invitations` with `email` and `memberRole` (`admin` or `member`) | Stores only a hash of a random token, valid for 7 days, and queues a `member_invited` email with the accept link. |
| Accept invite | Signed-in invitee: `POST /invitations/accept` with `token` | Adds a membership. Works for people who already have an account; it never changes their profile or an existing membership. The signed-in email must match the invited email. |
| Demo outbox | Platform admin: `GET /admin/outbox` | **Demo only.** Emails are written to `email_outbox` and never delivered. Invite links (with their token) are readable here so a demo can proceed without SMTP. |
| Link wallet | `POST /wallet/challenge`, sign returned EIP-712 data, then `POST /wallet/link` | Proves wallet control; one-time challenge expires after five minutes. |
| Dashboard | `GET /dashboard`, `GET /orders`, `GET /orders/:id` | Account-scoped profile, orders, stages, and confirmed chain event timeline. |
| Create order | `POST /orders` | The buyer, and the supplier, warehouse and carrier at the matching handoffs, must each belong to an **approved** business with that capability. Fixes a rand-denominated amount for 60 seconds, snapshots participant wallets, and sets the four demo payouts: 0%, 10% carrier, 40% supplier, 50% supplier. |
| Fund | Buyer submits the exact token amount to escrow, then `POST /orders/:id/funding/verify` with `txHash` | Status becomes funded only after a sufficiently confirmed `OrderFunded` event from the configured escrow. |
| Handoff | `POST /orders/:id/handoffs/:stage/challenge`, both wallets sign the same typed data, then `POST .../submit` | A new challenge invalidates the previous QR. Submission is one-time and remains `awaiting_chain`. |
| Payout | Submit the signed proof to escrow, then `POST /orders/:id/handoffs/:stage/verify` with `txHash` | Stage confirms only when the escrow event has the right order, stage, payee, and amount. Stage 1 pays zero. |
| Refund | After the contract's deadline, submit its refund transaction, then `POST /orders/:id/refund/verify` | Marks refunded only when the confirmed event returns the unpaid balance to the buyer. |
| Dispute | `POST /orders/:id/disputes` with a reason; admin uses `GET /admin/disputes` and `POST /admin/disputes/:id/review` | Holds new backend handoff challenges for human review. A review decision does not itself move funds; the contract needs matching dispute controls. |
| Maps | `POST /orders/:id/route` with origin/destination latitude and longitude | Authorized participant gets a Google Routes polyline and distance. It is a proposed road route, **not live truck telemetry or delivery proof**. |
| Voice | `POST /voice/transcribe` with base64 WebM/Opus audio or `POST /voice/speak` with text | Authenticated speech assistance using Google Cloud Speech-to-Text or Text-to-Speech. Audio/transcripts are not stored as verification evidence. |

Example order body (all IDs must be existing, linked-wallet profiles):

```json
{
  "amountZarp": "100.00",
  "refundAfterHours": 24,
  "handoffs": [
    { "fromUserId": "supplier-uuid", "toUserId": "warehouse-uuid" },
    { "fromUserId": "warehouse-uuid", "toUserId": "carrier-uuid", "payeeUserId": "carrier-uuid" },
    { "fromUserId": "carrier-uuid", "toUserId": "last-mile-uuid", "payeeUserId": "supplier-uuid" },
    { "fromUserId": "last-mile-uuid", "toUserId": "buyer-uuid", "payeeUserId": "supplier-uuid" }
  ]
}
```

The third handoff recipient is configurable because the pitch does not name the last-mile custodian. Every handoff has two different signers and the custody chain must connect. For a four-wallet demo, the last-mile role can be assigned to an existing participant only if that represents the real custody flow.

## Contract interface required

The escrow contract is a separate implementation task. The backend currently expects these events from the **configured escrow address**, using the same ABI types and argument order:

```solidity
event OrderFunded(bytes32 indexed orderId, address indexed buyer, address indexed token, uint256 amount);
event HandoffCompleted(bytes32 indexed orderId, uint8 indexed stage, address indexed payee, uint256 amount);
event OrderRefunded(bytes32 indexed orderId, address indexed buyer, uint256 amount);
```

`orderId` is `keccak256(bytes(order_uuid_string))`. The signed handoff uses an EIP-712 domain of name `Patela Handoff`, version `1`, the selected chain ID, and the escrow address. Its fields are `orderId`, `stage`, `nonce`, `expiresAt`, `from`, `to`, and `payout`. The contract must independently enforce the buyer's exact funding amount and deadline, both signers, stage order, challenge expiry, nonce replay protection, the 0/10/40/50 allocation, refund and dispute rules, and safe token transfers. Backend checks are a second gate, not a substitute for contract enforcement.

The contract is not deployed here. Until it exists, order creation and chain-confirmed demo flow are deliberately unavailable without `ESCROW_ADDRESS`. A three-confirmation receipt check reduces accidental early display, but a production event worker must also reconcile chain reorganizations and missed events. The current API verifies a transaction when a client supplies its hash. An off-chain dispute blocks new backend challenges, but the contract must independently pause disputed payouts and enforce the reviewer decision.

## External setup and live-money boundary

- ZARP's [official blockchain list](https://docs.zarpstablecoin.com/zarp-stablecoin/blockchains) names its Base contract. [BaseScan lists 18 decimals](https://basescan.org/token/0xb755506531786c8ac63b756bab1ac387bacb0c04). Before sending real ZARP, test that the escrow contract can receive and transfer it on Base. ZARP's [terms](https://www.zarpstablecoin.com/terms/) restrict direct issuance/redemption to approved partners; this backend has no bank cash-out integration.
- Google Maps server calls need a separately restricted Routes API key. Google Speech clients use Application Default Credentials. Neither service can be exercised live without Google Cloud setup and billing.
- OTP and invitation messages are currently queued in PostgreSQL's `email_outbox` and are **not delivered**. A sender such as Amazon SES must be added and verified before relying on email onboarding.
- Do not use real funds with this backend until the separate escrow contract, upgrade and role controls, independent review, ZARP compatibility, failure recovery, and end-to-end Base transaction tests have passed.

## Verification

```powershell
npm run typecheck
npm test
```

The test uses PGlite to execute the actual PostgreSQL migration, Fastify request injection, test wallets to sign typed data, and a fake chain verifier. It checks account creation, OTP and invitation routes, order visibility, wrong funding amount, staged payments, stale and duplicate QR challenges, wrong signatures, dispute review, completion only after chain events, routes/voice authorization, and refund. It does **not** prove a live contract, OAuth provider, Google API, or SMTP integration.
