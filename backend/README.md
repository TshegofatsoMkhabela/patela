# Patela backend

This is the backend for Patela's proof-at-handoff demo. It contains no frontend and no escrow contract. It creates application profiles from verified Google identities or email OTP, stores first-party sessions in PostgreSQL, onboards businesses for admin approval, invites staff to a business, links wallets by signature, stores order data in PostgreSQL, issues short-lived handoff challenges, verifies both handoff signatures, and projects **confirmed escrow events** into dashboard data. It also exposes authenticated Google Routes and speech endpoints.

The backend does not hold a private key or send a ZARm transaction. A wallet or relayer submits contract calls. `/verify` endpoints read confirmed receipts before changing payment state.

## Run locally

Requirements: Node 22+, PostgreSQL, and a Google Cloud OAuth Web application client. The backend's tests use embedded PostgreSQL and need no Docker.

1. Run `npm ci` in this directory.
2. Copy `.env.example` to `.env`. Fill `DATABASE_URL`, `GOOGLE_OAUTH_CLIENT_ID`, `PUBLIC_ORIGIN`, and `API_ORIGIN`. `API_ORIGIN` is the browser-reachable backend origin; locally use `http://localhost:4000` with a frontend on `http://localhost:3000`. `GOOGLE_OAUTH_CLIENT_SECRET` is optional and enables the authorization-code route. Keep secrets outside Git.
3. In Google Cloud, create an OAuth client of type **Web application** and add the frontend's origin to Authorized JavaScript origins for Google Identity Services. For authorization-code sign-in, also add `${API_ORIGIN}/auth/google/callback` as an authorized redirect URI and configure its client secret. Configure the consent screen for the accounts that should sign in. No Supabase project is used.
4. Run `npm run migrate` against the application database, then `npm run dev`. The migrator applies each `migrations/*.sql` file once, in name order, and records it in `schema_migrations`. `002_organizations.sql` resets old per-person trading roles (buyer, supplier, etc.) to `member`; trading rights now come from approved businesses.
5. Create the first admin by signing in once, then changing that specific profile's `role` to `admin` directly in PostgreSQL. There is deliberately no public admin-registration endpoint.
6. For rehearsals use Celo Sepolia (`CHAIN_ID=11142220`) with `RPC_URL` and the deployed escrow. For mainnet use `CHAIN_ID=42220`. The runtime selects canonical Mento ZARm unless `TOKEN_ADDRESS` explicitly overrides it. Set `RPC_URL` and `ESCROW_ADDRESS` together: startup refuses one without the other, and with both blank the API serves sign-in and onboarding only.

## Connect to Celo Sepolia

1. Deploy the escrow from `contracts/` with your own funded deployer key, kept in the Hardhat keystore rather than a file:
   ```bash
   npx hardhat keystore set DEPLOYER_PRIVATE_KEY
   npx hardhat keystore set CELO_SEPOLIA_RPC_URL   # https://forno.celo-sepolia.celo-testnet.org
   MAX_ORDER_ZARM=10000 npx hardhat run scripts/deploy.ts --network celoSepolia
   ```
   The script refuses a token that isn't 18-decimal ZARm and writes the addresses to `contracts/deployments/celoSepolia.json`.
2. Set `RPC_URL`, `CHAIN_ID=11142220` and `ESCROW_ADDRESS` (the printed `PatellaEscrowAndLogistics` address), then run `npm run chain:check`. It reads the chain only and prints PASS/FAIL for:
   - **chain:** the RPC is on `CHAIN_ID`.
   - **token:** the token is ZARm with 18 decimals.
   - **escrow:** a contract exists at `ESCROW_ADDRESS` and its `paymentToken()` is that token.

   It exits 1 on any failure.
3. To rehearse for free against the real ZARm contract, fork Celo Sepolia locally:
   ```bash
   npx hardhat --config hardhat.fork.config.ts node --fork https://forno.celo-sepolia.celo-testnet.org --chain-id 11142220 --chain-type op
   MAX_ORDER_ZARM=10000 npx hardhat --config hardhat.fork.config.ts run scripts/deploy.ts --network localhost
   ```
   Then point `RPC_URL` at `http://127.0.0.1:8545`.

The backend binds to localhost by default. Deploy behind HTTPS with request limits and a trusted Postgres connection. Browser/PostgREST roles have no RLS policies for these tables; all application data access goes through this API.
For Amazon RDS, set `DATABASE_SSL=true` and load the RDS CA certificate into Node's trust store. The Lambda stack sets `NODE_EXTRA_CA_CERTS=/var/runtime/ca-cert.pem`; local RDS connections need an appropriate CA bundle. The PostgreSQL client verifies the server certificate and hostname.
Rate limits currently use process memory. A multi-instance deployment needs a shared limiter or an API gateway. Clients signing returned EIP-712 JSON should convert the decimal `uint256` strings to integer values accepted by their wallet library.

For Google Identity Services sign-in, the frontend obtains Google's ID token with the Web client ID and sends `{ "credential": "<ID token>" }` as JSON to `POST ${API_ORIGIN}/auth/google/id-token` from an allowed origin. The backend verifies Google's signature, audience, expiration, subject, and verified email through `google-auth-library`; it creates or finds a PostgreSQL profile and sets HTTP-only session cookies. `GET /me` confirms login. The temporary API-only smoke page at `/auth/google/test` is served only when `ENABLE_AUTH_SMOKE_PAGE=true`; turn it off after testing. Access tokens last one hour, refresh tokens rotate and last 30 days. `POST /auth/logout` revokes the current session. Deploy frontend and API under the same site with HTTPS so `SameSite=Lax` and `Secure` cookies work as intended.

When `GOOGLE_OAUTH_CLIENT_SECRET` is configured, the existing authorization-code flow also works through `${API_ORIGIN}/auth/google/start`. It uses a five-minute state and PKCE cookie, exchanges the code, verifies the ID token, and redirects to the frontend or `/auth/success` for an API-only test. Without a secret, these code-flow routes return 503. `GET /auth/google/url` offers the same start as JSON, but its caller must use credentialed fetch so the challenge cookie reaches the browser.

## API flow (two-handoff demo)

Protected routes accept an HTTP-only session cookie or `Authorization: Bearer <Patela access token>`. An invalid token cannot create a profile. The routes, contract events and QR handshake are frozen in [specs/INTERFACES.md](../specs/INTERFACES.md); this backend implements its §4.

| Step | Who | Route | Moves the order to |
|---|---|---|---|
| Create; supplier emailed an accept link | buyer (approved buyer business, linked wallet) | `POST /orders` | `awaiting_supplier` |
| Read the agreement (no sign-in) | supplier / driver | `GET /invitations/:token` | — |
| Accept with the linked wallet | supplier | `POST /invitations/:token/accept` | `awaiting_chain` |
| Link `createOrder` (`OrderCreated`) | buyer | `POST /orders/:id/chain` | `awaiting_funding` |
| Verify `fundEscrow` (`EscrowFunded`) | buyer | `POST /orders/:id/funding/verify` | `funded` |
| Verify `acceptOrder` (`OrderAccepted`) | supplier | `POST /orders/:id/acceptance/verify` | `accepted` |
| Email a driver; driver accepts as above | supplier, then driver | `POST /orders/:id/driver-invite` | — |
| Verify `assignDriver` (`DriverAssigned`) | supplier | `POST /orders/:id/driver/verify` | `driver_assigned` |
| QR session: giver opens, receiver answers, giver polls | giver / receiver | `POST /orders/:id/handoffs/:stage/session`, `…/session/:sessionId/receiver`, `GET …/session/:sessionId` | — |
| Verify `releaseHandoff` (`HandoffVerified` + `PaymentReleased`) | giver or receiver | `POST /orders/:id/handoffs/:stage/verify` | `in_progress` (1), `delivered` (2) |
| Verify `refund` (`OrderRefunded`) | buyer | `POST /orders/:id/refund/verify` | `refunded` |

Stage 1 (pickup) is supplier → driver and pays the driver and the supplier their pickup amounts. Stage 2 (delivery) is driver → buyer and pays the supplier the rest. Every status change after `awaiting_chain` needs a confirmed transaction whose escrow events match the stored order (order ID, wallets, amounts, agreement or evidence hash). Re-sending a recorded transaction returns the order unchanged. `GET /orders/:id` returns the parties, the on-chain timeline, and token balances for the buyer, supplier, driver and escrow. An open dispute (`POST /orders/:id/disputes`) blocks new QR sessions until an admin reviews it.

The backend does not check handoff signatures. Embedded wallets may be ERC-1271 smart accounts, and the contract verifies both signatures on release. The backend stores the receiver's signature and both location records, and relays them to the giver.

**Known gap (contract):** `OrderCreated` does not carry the three split amounts, so `POST /orders/:id/chain` cannot confirm that the on-chain splits match the stored ones. A mismatch only surfaces when a `PaymentReleased` amount fails to match at handoff. Adding the splits to the event, or freezing the shape of the `orders()` getter, would close it.

**Email:** sign-in codes, order invites, business decisions and member invites are queued in `email_outbox`. They are sent through Gmail SMTP when `SMTP_SECRET_ARN` names a Secrets Manager secret holding `{"user":"<gmail address>","appPassword":"<16-character app password>"}`; the account needs 2-step verification. Sending happens inside the request, before the response, with a five-second timeout. A failure leaves the row pending, and a row that fails three times is marked failed. `POST /admin/outbox/flush` retries pending rows, and `GET /admin/outbox` shows status and errors. Without `SMTP_SECRET_ARN`, emails stay queued.

**DEMO_MODE=true** (demo only) also returns each one-time accept link in the `POST /orders` and driver-invite responses, so a presenter can open it if an email is slow. It hands the buyer the supplier's link, so leave it off anywhere real.

## External setup and live-money boundary

- Mento publishes canonical ZARm addresses for Celo and Celo Sepolia. Buyers acquire ZARm separately; this backend has no mint, custody, swap, or bank cash-out integration.
- Google Maps server calls need a separately restricted Routes API key. Google Speech clients use Application Default Credentials. Neither service can be exercised live without Google Cloud setup and billing.
- Order and business emails go out through Gmail SMTP only when `SMTP_SECRET_ARN` is set (see above). Sign-in codes are sent the same way, from `POST /auth/otp/request`. Gmail may rate-limit or spam-folder automated mail; production should use a domain sender such as Amazon SES.
- Do not use real funds until the escrow has an independent review, operational limits, failure recovery, and a complete Celo Sepolia rehearsal.

## Verification

```powershell
npm run typecheck
npm test
npm run chain:check   # needs RPC_URL; read-only
```

The tests use PGlite, Fastify injection, test wallets, and a fake chain verifier. They do not prove a live Celo deployment, production ZARm liquidity, Gmail, OAuth, Google APIs, or Lambda configuration.
