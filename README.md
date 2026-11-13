# Patela — Crypto Escrow for Work, Verified by AI

Patela is a trustless crypto-escrow marketplace where clients post jobs, lock payments in smart contracts, and freelancers get paid instantly once AI verifies the deliverables.

## Tech Stack

- **Framework**: Next.js (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS & custom design system
- **State Management**: Client demo store with persistence
- **Icons**: Lucide React
- **Notifications**: Sonner

## Getting Started

First, install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to view the application.

## Run the demo

One command runs the whole order flow locally (buyer → supplier → driver, escrow on a local chain)
with no external accounts. Everything it shows is labelled **Demo**.

```bash
npm run demo:install   # once: installs root, backend and contracts dependencies
npm run demo           # starts everything, prints the URLs, returns to the prompt
npm run demo:smoke     # optional: runs the full flow headless and checks the payouts
npm run demo:stop      # stops everything it started
```

`npm run demo` starts, in order:

1. **Postgres**: a fresh `postgres:16-alpine` container (port 54329) when Docker is running,
   otherwise an in-process PGlite database in `.demo/pgdata`.
2. **Hardhat node** on `http://127.0.0.1:8545` (chain 31337), then deploys MockZARP, the
   registry, the tender trail and the escrow, writing `contracts/deployments/localhost.json`
   and minting 100,000 MockZARP to the demo buyer.
3. **Backend** on `http://localhost:4000` with `DEMO_MODE=true` (migrations applied first).
4. **Web app** on `http://localhost:3001`, with the API URL and contract addresses taken from the
   deployment file.

Logs are in `.demo/logs`. If a port is taken, stop what is on it or set `DEMO_WEB_PORT` /
`DEMO_API_PORT`.

### Demo personas

| Persona  | Sign-in email                 | Wallet (Hardhat dev account) |
|----------|-------------------------------|------------------------------|
| Buyer    | `buyer@demo.patela.local`    | #1 `0x7099…79C8`             |
| Supplier | `supplier@demo.patela.local` | #2 `0x3C44…93BC`             |
| Driver   | `driver@demo.patela.local`   | #3 `0x90F7…b906`             |

- Sign-in codes and accept links are not emailed: the sign-in form fills the code in, and
  `/demo-inbox` lists every code and link. This only happens with `DEMO_MODE`, no mail configured
  and an API on localhost.
- Businesses are approved automatically, so each persona can trade straight after signing in.
- The demo wallets sign only on chain 31337. Their keys are Hardhat's public dev keys: never send
  real funds to them.
- Each persona needs its own session, so use a separate browser profile or private window per
  persona. The handoff page has a "copy QR text" / "paste QR" fallback when both windows are on one
  laptop, and uses a fixed demo location if the browser won't share one.

### Walkthrough

1. Buyer: `/signin?next=/orders/new` → **Use demo buyer wallet** → **Link wallet** (first time) →
   **Create and fund order**. The page shows the supplier's accept link and waits.
2. Supplier (second window): open the accept link → sign in → **Use my demo wallet**. The buyer's
   page then creates and funds the escrow; the supplier clicks **Accept the order**, invites
   `driver@demo.patela.local` and waits.
3. Driver (third window, or reuse the buyer's after signing out): open the driver link from
   `/demo-inbox` → sign in → **Use my demo wallet**. The supplier then clicks **Assign driver**.
4. Pickup: supplier and driver open `/handoff/<orderId>/pickup`, pick their persona; the driver
   scans (or pastes) the supplier's QR, the supplier signs to release: driver +10%, supplier +40%.
5. Delivery: `/handoff/<orderId>/delivery` with the driver giving and the buyer receiving:
   supplier +50%. The order page shows the balances and timeline.

### Plug in real services

Copy `.env.demo.example` to `.env.demo` and fill in only what you want. Each key switches one thing
on: Google Maps (3D buyer map, routes), Google Speech (`/voice/*`), Google sign-in, Gmail through
AWS Secrets Manager (turns the demo inbox off), or Base Sepolia contracts instead of the local chain.
Restart with `npm run demo:stop && npm run demo`.

## Build

To create a production build:

```bash
npm run build
```
