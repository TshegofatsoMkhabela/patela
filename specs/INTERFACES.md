# Patela demo — frozen interfaces

The four parallel branches (contract, backend, web core, web handoff) build against this file.
Change it only by agreement; any change is a commit to `dev` that all branches merge.
Network: Base Sepolia (chain 84532), token MockZARP (18 decimals). Spec: `specs/SPEC-demo-order-flow.md`.

## 1. Demo flow (who does what)

1. Buyer signs in (backend session) and connects MetaMask (extension, Base Sepolia).
2. Buyer gets test ZARP ("Get test ZARP" → `MockZARP.mint`, testnet only).
3. Buyer creates the order in the app → backend stores the agreement text, returns `agreementHash`,
   and emails the supplier an accept link `<site>/accept?token=…` (Gmail SMTP).
4. Supplier opens the link, signs in with the email code → MetaMask Embedded Wallet is created and
   linked (`/wallet/link`) → `POST /invitations/:token/accept`. Now the supplier's address is known.
   (`createOrder` takes the supplier address, so the invite has to come before it.)
5. Buyer's MetaMask calls `createOrder(...)` then `approve` + `fundEscrow(orderId)`; then the
   supplier calls `acceptOrder(orderId, agreementHash)` (gas sponsored).
6. Supplier enters the driver's email → backend emails the driver → driver signs in the same way,
   gets a wallet → supplier calls `assignDriver(orderId, driverAddress)`.
7. Pickup: supplier's screen shows the handoff QR (includes location evidence + giver signature);
   driver's webcam scans it; driver's browser captures its own location, countersigns and submits
   `releaseHandoff` (gas sponsored) → driver +10%, supplier +40%.
8. Delivery: driver's screen shows the QR; buyer scans, countersigns, submits → supplier +50%.
9. Every screen shows the four-wallet balance panel and a PAID screen with measured seconds.

## 2. Contract — `PatellaEscrowAndLogistics` (owner: contract branch)

EIP-712 domain: `{ name: "Patela Escrow", version: "1", chainId: 84532, verifyingContract: <escrow> }`

```solidity
function createOrder(address supplier, uint256 total, uint256 driverAtPickup, uint256 supplierAtPickup,
                     uint256 supplierAtDelivery, uint64 refundDeadline, bytes32 agreementHash)
                     external returns (uint256 orderId);
function fundEscrow(uint256 orderId) external;                       // buyer; status Created -> Funded
function acceptOrder(uint256 orderId, bytes32 agreementHash) external; // supplier; must equal stored hash; Funded only
function assignDriver(uint256 orderId, address driver) external;     // supplier; only after acceptOrder; once
function releaseHandoff(uint256 orderId, uint8 stage, bytes32 nonce, uint256 expiresAt,
                        bytes32 evidenceHash, bytes giverSig, bytes receiverSig) external;
function refund(uint256 orderId) external;                           // buyer; after refundDeadline
function raiseDispute(uint256 orderId) external;
function resolveDispute(uint256 orderId, bool releaseToSupplier) external;
function driverOf(uint256 orderId) external view returns (address);
function orders(uint256) external view returns (...);                // public getter, includes accepted flag + agreementHash
```

Stages: `1 = PICKUP` (giver supplier → receiver driver; pays driverAtPickup + supplierAtPickup),
`2 = DELIVERY` (giver driver → receiver buyer; pays supplierAtDelivery).

Typed data both parties sign:
```
Handoff(uint256 orderId,uint8 stage,address giver,address receiver,bytes32 nonce,uint256 expiresAt,bytes32 evidenceHash)
```

Events (backend indexes these; names and fields are frozen):
```solidity
event OrderCreated(uint256 indexed orderId, address indexed buyer, address indexed supplier, uint256 total, bytes32 agreementHash);
event EscrowFunded(uint256 indexed orderId, uint256 amount);
event OrderAccepted(uint256 indexed orderId, address indexed supplier, bytes32 agreementHash);
event DriverAssigned(uint256 indexed orderId, address indexed driver);
event HandoffVerified(uint256 indexed orderId, uint8 stage, address indexed giver, address indexed receiver, bytes32 evidenceHash);
event PaymentReleased(uint256 indexed orderId, uint8 stage, address indexed recipient, uint256 amount);
event OrderRefunded(uint256 indexed orderId, address indexed buyer, uint256 amount);
event OrderDisputed(uint256 indexed orderId, address indexed raisedBy);
event DisputeResolved(uint256 indexed orderId, bool releasedToSupplier);
```

Errors (the app shows a message per error): `SplitMismatch, NotBuyer, NotSupplier, NotAccepted, AgreementMismatch,
DriverAlreadyAssigned, DriverNotAssigned, OrderNotFunded, OrderInDispute, InvalidState, InvalidSignature,
HandoffExpired, NonceUsed, StageOutOfOrder, RefundTooEarly`.

Deployment output (frozen shape): `contracts/deployments/baseSepolia.json`
`{ network, chainId, deployedAt, contracts: { MockZARP|PatellaRegistry|PatellaTenderTrail|PatellaEscrowAndLogistics: { address, abi } } }`.
Until it exists, other branches use a local Hardhat deployment with the same shape.

## 3. Location evidence

```ts
type Evidence = { lat: number; lng: number; accuracyM: number; capturedAt: number /* unix s */; role: "giver" | "receiver" };
evidenceHash = keccak256(toBytes(JSON.stringify([giverEvidence, receiverEvidence])))  // giver first, keys in the order above
```
Pickup/delivery evidence: the giver captures its location when showing the QR; the receiver captures its own
when scanning. The receiver's browser computes `evidenceHash` from both, and both parties sign over it.
Raw evidence is stored by the backend (`POST .../evidence`); only the hash goes on-chain.
Hence the giver signs AFTER the receiver scans: QR carries the giver's evidence, the receiver sends
its evidence back through the API, the giver's screen then signs. (Two-round handshake; see §5.)

## 4. Backend API (owner: backend branch; web branches call these)

All JSON; session cookie (`credentials: "include"`); errors `{ error: string }` with 4xx/5xx.

| Method & path | Body | Returns | Used by |
|---|---|---|---|
| existing `/auth/otp/request`, `/auth/otp/verify`, `/auth/google/id-token`, `/auth/logout`, `/me` | — | — | web core |
| `POST /wallet/challenge`, `POST /wallet/link` | existing | existing | both web |
| `POST /orders` | `{ supplierEmail, totalZarp, driverAtPickupZarp, supplierAtPickupZarp, supplierAtDeliveryZarp, refundAfterHours, agreementText }` | `{ id, agreementHash, refundDeadline }` (sends supplier invite email; with `DEMO_MODE` also `acceptUrl`) | web core |
| `POST /orders/:id/chain` | `{ chainOrderId, createTxHash }` | order | web core |
| `POST /orders/:id/funding/verify` | `{ txHash }` | order | web core |
| `GET /orders/:id` | — | order + parties + timeline + balances | both web |
| `GET /invitations/:token` | — | `{ orderId, role, email, agreementText, agreementHash }` | web handoff |
| `POST /invitations/:token/accept` | `{ walletAddress }` (after `/wallet/link`) | order | web handoff |
| `POST /orders/:id/acceptance/verify` | `{ txHash }` | order | web handoff |
| `POST /orders/:id/driver-invite` | `{ email }` | `{ invited: true }` | web handoff |
| `POST /orders/:id/driver/verify` | `{ txHash }` | order | web handoff |
| `POST /orders/:id/handoffs/:stage/session` | `{ nonce, expiresAt, giverEvidence }` | `{ sessionId }` | web handoff (giver) |
| `GET /orders/:id/handoffs/:stage/session/:sessionId` | — | `{ receiverEvidence?, evidenceHash?, receiverSig? }` (giver polls) | web handoff |
| `POST /orders/:id/handoffs/:stage/session/:sessionId/receiver` | `{ receiverEvidence, evidenceHash, receiverSig }` | `{ ok: true }` | web handoff (receiver) |
| `POST /orders/:id/handoffs/:stage/verify` | `{ txHash }` | order | web handoff |
| `POST /dev/mint` (testnet only, rate-limited) | `{ address }` | `{ txHash }` | web core (optional; web may mint directly) |

The old `/orders/:id/handoffs/:stage/challenge` and `/submit` routes (server-issued nonce, server-side
signature check) are removed: the contract checks signatures, the phone creates the nonce.

## 5. Handoff handshake and QR payload (owner: web handoff branch)

1. Giver's screen: creates `nonce` (32 random bytes), `expiresAt = now + 120`, captures `giverEvidence`,
   `POST .../session` → shows QR.
2. QR payload: `patela:h1:` + base64url(JSON `{ orderId, stage, sessionId, nonce, expiresAt, giverEvidence, apiOrigin }`).
3. Receiver's webcam scans → captures `receiverEvidence` → computes `evidenceHash` → signs typed data
   → `POST .../receiver`.
4. Giver's screen (polling the session) receives `evidenceHash` + `receiverSig`, shows "sign to release",
   giver signs → giver's browser submits `releaseHandoff` (sponsored) → `POST .../verify` with the tx hash.
A screenshot of the QR is useless after use (nonce spent on-chain) or after 2 minutes (expiry).

## 6. Environment variables

Web (per Amplify branch, set in `infra/amplify-hosting.yaml`): `NEXT_PUBLIC_CHAIN_ID=84532`,
`NEXT_PUBLIC_ESCROW_ADDRESS`, `NEXT_PUBLIC_ZARP_ADDRESS`, `NEXT_PUBLIC_API_ORIGIN`,
`NEXT_PUBLIC_WEB3AUTH_CLIENT_ID`, `NEXT_PUBLIC_RPC_URL`.
Backend: `BASE_RPC_URL`, `ESCROW_ADDRESS`, `TOKEN_ADDRESS`, `TOKEN_DECIMALS=18`, `CHAIN_ID=84532`,
`CHAIN_CONFIRMATIONS`, `SMTP_SECRET_ARN` (Gmail user + app password, stored by the user), `PUBLIC_ORIGINS` (comma-separated).
