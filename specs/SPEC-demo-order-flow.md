# Feature Spec: Demo order flow (buyer → supplier → driver)

## Problem Statement
Suppliers and drivers wait 60–90 days to be paid because nobody can prove who had the goods, so everyone waits for manual checks at the end. Patela moves the check to the handoff: ZARP is locked in an escrow contract on Base, and each handoff, signed by both parties, releases that stage's payment within seconds. The parts exist on separate branches (Next.js app, Fastify backend, Solidity escrow, AWS hosting) but don't work together, and the contract has payout bugs. This spec defines the one end-to-end flow the demo must run.

## Success Criteria
Each becomes a Given/When/Then scenario in /tdd-workflow.

### Contract (`contracts/`, Hardhat tests)
- [ ] Given a buyer creating an order for amount T with supplier S, a split of driver 10% / supplier 40% at pickup and supplier 50% at delivery, when the amounts don't add up to T, then creation reverts.
- [ ] Given a funded order, when the buyer funds it, then exactly T MockZARP moves from the buyer to the escrow.
- [ ] Given a funded order with no driver assigned, when the supplier assigns driver D, then D is fixed for the pickup and delivery stages; when anyone other than S assigns, or S assigns a second time, then it reverts.
- [ ] Given the pickup stage, when S (giver) and D (receiver) both sign the EIP-712 handoff and anyone submits it, then D receives 10% and S receives 40% in the same transaction.
- [ ] Given the pickup stage, when the signatures come from any wallet other than S and D, then it reverts and nothing is paid.
- [ ] Given the pickup stage is not done, when a delivery handoff is submitted, then it reverts (stages run in order).
- [ ] Given the delivery stage, when D (giver) and the buyer (receiver) both sign, then S receives the remaining 50% and the order is completed.
- [ ] Given a used handoff nonce, when it is submitted again, then it reverts and pays nothing.
- [ ] Given an expired handoff (past `expiresAt`), when submitted, then it reverts.
- [ ] Given a signature made for another chain ID or another contract address, when submitted, then it reverts.
- [ ] Given a signer that is a smart-contract wallet (ERC-1271), when it signs validly, then the handoff is accepted.
- [ ] Given a funded order past its refund deadline, when the buyer calls refund, then everything not yet paid returns to the buyer; when anyone else calls it, or it's called before the deadline, then it reverts.
- [ ] Given an open dispute, when a handoff is submitted, then it reverts until the resolver decides.

### Backend (`backend/`, node:test)
- [ ] Given a buyer's order, when the buyer invites a supplier by email, then an email with a one-time accept link is sent through Gmail SMTP to that address (any address).
- [ ] Given an accept link, when it's used twice or after it expires, then the second use is rejected.
- [ ] Given a supplier who accepted, when the supplier picks a driver by email, then the driver receives an invite email the same way.
- [ ] Given a funding, handoff or refund transaction hash, when the API verifies it, then it matches the contract's real events (`EscrowFunded`, `HandoffVerified`, `MilestoneReleased`, refund event) with `uint256` order IDs after the configured confirmations.

### Web app (`src/`, vitest + manual rehearsal)
- [ ] Given the buyer with MetaMask on Base Sepolia, when they create and fund an order, then the four-wallet balance panel shows the buyer's ZARP drop and the escrow's rise.
- [ ] Given the supplier opening the accept link, when they sign in with the email code, then a MetaMask Embedded Wallet (Web3Auth) is created for them without them holding ETH.
- [ ] Given the giver's window showing a handoff QR and the receiver's window scanning it with the webcam, when both sign, then the release is sent with sponsored gas and the app shows PAID with the measured seconds.
- [ ] Given a screenshot of an old QR, when it's scanned, then the app shows it was rejected.

### End to end
- [ ] The full flow (fund → accept → assign driver → pickup → delivery) runs three times in a row on Base Sepolia with MockZARP on the integration preview URL.

## Scope
### In Scope
- Base Sepolia with MockZARP only.
- Two handoffs: supplier → driver (pickup), driver → buyer (delivery).
- Buyer: existing account, MetaMask extension in desktop Chrome.
- Supplier and driver: invited by email, wallet provisioned by MetaMask Embedded Wallets (Web3Auth) on sign-in, gas sponsored by Patela through a paymaster.
- Email: Gmail SMTP with an app password stored in AWS Secrets Manager by the user.
- QR scanning with the laptop webcam, using a bundled JavaScript QR reader.
- Backend on Lambda + RDS (deployed only after the user approves the monthly cost).

### Out of Scope
- Real ZARP on Base mainnet (blocked until it's confirmed a contract can hold ZARP and its decimals are checked).
- Warehouse stage.
- Tender trail, business verification registry, voice, Google Maps routes.
- A custom domain and production email (SES or a domain sender).
- Mobile phones and MetaMask Mobile.
- Changing the AGENTS.md "demo" labelling rule without asking first.

## Data / API Contract
Contract (target shape, replaces the current `recordTwoPartyHandoff` / timeout logic):
- `createOrder(supplier, total, splits, refundDeadline) → orderId` (uint256); splits fix who's paid what at which stage.
- `fundEscrow(orderId)` — buyer, pulls `total` MockZARP.
- `assignDriver(orderId, driver)` — supplier only, once, before pickup.
- `releaseHandoff(orderId, stage, nonce, expiresAt, giverSig, receiverSig)` — anyone submits; EIP-712 domain includes `chainId` and `verifyingContract`; signatures checked with `SignatureChecker` (EOA + ERC-1271).
- `refund(orderId)` — buyer only, after `refundDeadline`, returns unpaid balance.
- `raiseDispute` / `resolveDispute` — as today, with handoffs blocked while open.

EIP-712 `Handoff` type: `orderId uint256, stage uint8, giver address, receiver address, nonce bytes32, expiresAt uint256`.

Backend env additions: `BASE_RPC_URL`, `ESCROW_ADDRESS`, `TOKEN_ADDRESS`, `TOKEN_DECIMALS`, `CHAIN_ID=84532`, `SMTP_SECRET_ARN`, allowed origins for `main`, `demo` and `integration-demo` sites.

Web env additions (per Amplify branch, set in the template): `NEXT_PUBLIC_CHAIN_ID`, `NEXT_PUBLIC_ESCROW_ADDRESS`, `NEXT_PUBLIC_ZARP_ADDRESS`, `NEXT_PUBLIC_API_ORIGIN`, `NEXT_PUBLIC_WEB3AUTH_CLIENT_ID`.

## Tech Stack
- Contract: Solidity 0.8.20, OpenZeppelin, Hardhat (tests + deploy); Remix optional for inspection.
- Backend: Node 22, Fastify, PostgreSQL (RDS), Lambda + API Gateway, node:test.
- Web: Next.js 15, React 19, viem, MetaMask Embedded Wallets (Web3Auth) SDK, vitest.
- Hosting: AWS Amplify (Next.js SSR), CloudFormation.

## Open Questions
- MetaMask Embedded Wallets: SDK version, whether wallets sign as EOAs or MetaMask smart accounts, which paymaster sponsors gas on Base Sepolia, and that the free Sapphire Devnet tier covers the demo. Verify in the docs before coding.
- Gmail sending from Lambda: app passwords need 2-step verification on the Gmail account; Gmail may rate-limit or flag automated mail.
- Who resolves disputes on stage (which wallet holds the resolver role)?
- Refund deadline length for the demo (long enough not to expire mid-demo, short enough to show a refund in a second order).
- Thabiso's review of the contract changes.

## Implementation Plan
1. Contract: `contracts/test/escrow.test.ts` with the contract scenarios above (failing first), then rewrite `contracts/contracts/PatellaEscrowAndLogistics.sol` to pass; update `contracts/scripts/deploy.ts` to write addresses for the app and backend.
2. User deploys contracts to Base Sepolia with their own deployer wallet.
3. Backend: `backend/src/chain.ts` (real events, uint256 IDs), `backend/src/service.ts` (invite/accept by email, driver assignment), new `backend/src/email.ts` (Gmail SMTP from Secrets Manager), tests first in `backend/test/`.
4. Backend stack: `infra/backend-lambda.yaml` — chain + SMTP settings, multiple origins, secrets read at runtime, removable database.
5. User stores the Gmail app password in Secrets Manager; deploy the backend after cost approval.
6. Web: `src/lib/escrow.ts` (viem + ABI), `src/lib/wallets.ts` (MetaMask extension for the buyer, MetaMask Embedded Wallets for supplier and driver), order, accept, handoff (QR + webcam) and balance-panel views; env vars in `infra/amplify-hosting.yaml`.
7. Rehearse on the integration preview three times in a row, then release the `demo` URL.
