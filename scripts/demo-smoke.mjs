#!/usr/bin/env node
// Headless end-to-end run of the demo flow against the stack "npm run demo" started:
// sign-in by demo-inbox code -> wallet link -> order -> create + fund on-chain -> supplier accepts
// -> driver invited and assigned -> pickup and delivery QR handshakes -> 10/40/50 payouts.
// It uses the same API routes and contract calls as the browser pages, with the demo personas.
// Usage: npm run demo:smoke   (local chain only; exits non-zero on the first failed step)
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPublicClient, createWalletClient, http, keccak256, parseAbi, parseEventLogs, parseUnits, toBytes, toHex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hardhat } from "viem/chains";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stack = JSON.parse(readFileSync(path.join(ROOT, ".demo", "stack.json"), "utf8"));
if (stack.chain.chainId !== 31337) throw new Error("demo:smoke signs with Hardhat dev keys: local chain only");
const API = stack.apiOrigin;
const ESCROW = stack.chain.escrow;
const TOKEN = stack.chain.token;
const run = Date.now().toString(36);

// Hardhat dev accounts #1-#3 (the web app's demo personas, src/lib/demo-signer.ts).
const KEYS = {
  buyer: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  supplier: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
  driver: "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
};
const escrowAbi = parseAbi([
  "function createOrder(address supplier, uint256 total, uint256 driverAtPickup, uint256 supplierAtPickup, uint256 supplierAtDelivery, uint64 refundDeadline, bytes32 agreementHash) returns (uint256 orderId)",
  "function fundEscrow(uint256 orderId)",
  "function acceptOrder(uint256 orderId, bytes32 agreementHash)",
  "function assignDriver(uint256 orderId, address driver)",
  "function releaseHandoff(uint256 orderId, uint8 stage, bytes32 nonce, uint256 expiresAt, bytes32 evidenceHash, bytes giverSig, bytes receiverSig)",
  "event OrderCreated(uint256 indexed orderId, address indexed buyer, address indexed supplier, uint256 total, bytes32 agreementHash)",
]);
const tokenAbi = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
]);
const handoffTypes = {
  Handoff: [
    { name: "orderId", type: "uint256" }, { name: "stage", type: "uint8" }, { name: "giver", type: "address" },
    { name: "receiver", type: "address" }, { name: "nonce", type: "bytes32" }, { name: "expiresAt", type: "uint256" },
    { name: "evidenceHash", type: "bytes32" },
  ],
};

const transport = http(stack.chain.rpcUrl);
const reader = createPublicClient({ chain: hardhat, transport });

function step(msg) { process.stdout.write(`[smoke] ${msg}\n`); }

/** One persona: its own session cookies (like its own browser profile) and wallet. */
function persona(name) {
  const account = privateKeyToAccount(KEYS[name]);
  const wallet = createWalletClient({ account, chain: hardhat, transport });
  // The same emails as the browser personas: a wallet links to one account only.
  const email = `${name}@demo.patela.local`;
  const cookies = new Map();
  async function api(method, route, body, attempt = 0) {
    const res = await fetch(`${API}${route}`, {
      method,
      headers: {
        origin: stack.webOrigin,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        ...(cookies.size ? { cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; ") } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [pair] = c.split(";");
      const eq = pair.indexOf("=");
      cookies.set(pair.slice(0, eq), pair.slice(eq + 1));
    }
    const data = await res.json().catch(() => ({}));
    // Sign-in codes are rate-limited (5 a minute): back-to-back smoke runs wait it out.
    if (res.status === 429 && attempt < 8) {
      if (attempt === 0) step(`rate-limited on ${route}, waiting…`);
      await new Promise((r) => setTimeout(r, 10_000));
      return api(method, route, body, attempt + 1);
    }
    if (!res.ok) throw new Error(`${name}: ${method} ${route} -> ${res.status} ${data.error ?? ""}`);
    return data;
  }
  async function send(address, abi, functionName, args) {
    const { request } = await reader.simulateContract({ account, address, abi, functionName, args });
    const hash = await wallet.writeContract(request);
    const receipt = await reader.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error(`${name}: ${functionName} reverted`);
    return { hash, receipt };
  }
  return {
    name, account, email, api, send,
    async signIn() {
      const sent = await api("POST", "/auth/otp/request", { email });
      if (!sent.code) throw new Error("No demo code returned: is the backend in local DEMO_MODE?");
      const inbox = await api("GET", `/demo/inbox?email=${encodeURIComponent(email)}`);
      if (inbox.emails[0]?.payload?.code !== sent.code) throw new Error("Demo inbox does not show the code");
      await api("POST", "/auth/otp/verify", { email, code: sent.code });
      const me = await api("GET", "/me");
      if (me.email !== email) throw new Error(`${name}: /me returned ${me.email}`);
    },
    async linkWallet() {
      const { challengeId, typedData } = await api("POST", "/wallet/challenge", { wallet: account.address });
      const fields = typedData.types[typedData.primaryType];
      const message = { ...typedData.message };
      for (const { name: f, type } of fields) if (/^u?int/.test(type)) message[f] = BigInt(message[f]);
      const signature = await account.signTypedData({ ...typedData, message });
      await api("POST", "/wallet/link", { challengeId, signature });
    },
  };
}

const evidence = (role, lat) => ({ lat, lng: 28.0473, accuracyM: 12, capturedAt: Math.floor(Date.now() / 1000), role });
const evidenceHash = (g, r) => keccak256(toBytes(JSON.stringify([g, r])));

async function handoff(orderId, chainOrderId, stage, giver, receiver) {
  const nonce = toHex(crypto.getRandomValues(new Uint8Array(32)));
  const expiresAt = Math.floor(Date.now() / 1000) + 120;
  const giverEvidence = evidence("giver", -26.2041);
  const base = `/orders/${orderId}/handoffs/${stage}`;
  const { sessionId } = await giver.api("POST", `${base}/session`, { nonce, expiresAt, giverEvidence });
  // Receiver "scans": evidence, hash, countersign.
  const receiverEvidence = evidence("receiver", -26.2042);
  const hash = evidenceHash(giverEvidence, receiverEvidence);
  const td = {
    domain: { name: "Patela Escrow", version: "1", chainId: 31337, verifyingContract: ESCROW },
    types: handoffTypes, primaryType: "Handoff",
    message: { orderId: chainOrderId, stage, giver: giver.account.address, receiver: receiver.account.address,
      nonce, expiresAt: BigInt(expiresAt), evidenceHash: hash },
  };
  const receiverSig = await receiver.account.signTypedData(td);
  await receiver.api("POST", `${base}/session/${sessionId}/receiver`, { receiverEvidence, evidenceHash: hash, receiverSig });
  // Giver polls, signs and releases.
  const reply = await giver.api("GET", `${base}/session/${sessionId}`);
  if (reply.receiverSig?.toLowerCase() !== receiverSig.toLowerCase()) throw new Error("Session lost the receiver signature");
  const giverSig = await giver.account.signTypedData(td);
  const { hash: txHash } = await giver.send(ESCROW, escrowAbi, "releaseHandoff",
    [chainOrderId, stage, nonce, BigInt(expiresAt), hash, giverSig, receiverSig]);
  await giver.api("POST", `${base}/verify`, { txHash });
  // Replaying the same QR must fail on-chain (nonce spent).
  const replay = await reader.simulateContract({ account: giver.account, address: ESCROW, abi: escrowAbi,
    functionName: "releaseHandoff", args: [chainOrderId, stage, nonce, BigInt(expiresAt), hash, giverSig, receiverSig] })
    .then(() => "accepted", () => "rejected");
  if (replay !== "rejected") throw new Error("A replayed handoff QR was accepted");
}

async function main() {
  const buyer = persona("buyer");
  const supplier = persona("supplier");
  const driver = persona("driver");
  const balance = (who) => reader.readContract({ address: TOKEN, abi: tokenAbi, functionName: "balanceOf", args: [who.account.address] });
  const before = { supplier: await balance(supplier), driver: await balance(driver) };

  step(`health ${JSON.stringify(await (await fetch(`${API}/health`)).json())}`);
  for (const p of [buyer, supplier, driver]) { await p.signIn(); await p.linkWallet(); }
  step("buyer, supplier and driver signed in with demo-inbox codes and linked their demo wallets");

  const total = parseUnits("1000", 18);
  const order = await buyer.api("POST", "/orders", {
    supplierEmail: supplier.email, totalZarp: "1000", driverAtPickupZarp: "100", supplierAtPickupZarp: "400",
    supplierAtDeliveryZarp: "500", refundAfterHours: 48, agreementText: `Smoke ${run}: 20 crates, Joburg to Polokwane.`,
  });
  if (!order.acceptUrl) throw new Error("DEMO_MODE did not return the accept link");
  step(`order ${order.id} saved; accept link ${order.acceptUrl}`);

  // The invite comes first: createOrder needs the supplier's wallet (INTERFACES.md §1 step 4).
  const token = new URL(order.acceptUrl).searchParams.get("token");
  await supplier.api("GET", `/invitations/${encodeURIComponent(token)}`);
  await supplier.api("POST", `/invitations/${encodeURIComponent(token)}/accept`, { walletAddress: supplier.account.address });
  const waiting = await buyer.api("GET", `/orders/${order.id}`);
  step(`supplier accepted the invitation; order status "${waiting.status}"`);

  const deadline = BigInt(Math.floor(Date.parse(order.refundDeadline) / 1000) || Number(order.refundDeadline));
  const created = await buyer.send(ESCROW, escrowAbi, "createOrder", [supplier.account.address, total,
    parseUnits("100", 18), parseUnits("400", 18), parseUnits("500", 18), deadline, order.agreementHash]);
  const [ev] = parseEventLogs({ abi: escrowAbi, eventName: "OrderCreated", logs: created.receipt.logs });
  const chainOrderId = ev.args.orderId;
  await buyer.api("POST", `/orders/${order.id}/chain`, { chainOrderId: chainOrderId.toString(), createTxHash: created.hash });
  await buyer.send(TOKEN, tokenAbi, "approve", [ESCROW, total]);
  const funded = await buyer.send(ESCROW, escrowAbi, "fundEscrow", [chainOrderId]);
  await buyer.api("POST", `/orders/${order.id}/funding/verify`, { txHash: funded.hash });
  step(`on-chain order ${chainOrderId} created and funded with 1000 MockZARP`);

  const accepted = await supplier.send(ESCROW, escrowAbi, "acceptOrder", [chainOrderId, order.agreementHash]);
  await supplier.api("POST", `/orders/${order.id}/acceptance/verify`, { txHash: accepted.hash });
  step("supplier accepted the order on-chain");

  const invite = await supplier.api("POST", `/orders/${order.id}/driver-invite`, { email: driver.email });
  const driverInbox = await driver.api("GET", `/demo/inbox?email=${encodeURIComponent(driver.email)}`);
  const driverLink = invite.acceptUrl ?? driverInbox.emails.find((e) => e.payload?.acceptUrl)?.payload.acceptUrl;
  if (!driverLink) throw new Error("No driver accept link in the response or the demo inbox");
  const driverToken = new URL(driverLink).searchParams.get("token");
  await driver.api("POST", `/invitations/${encodeURIComponent(driverToken)}/accept`, { walletAddress: driver.account.address });
  const assigned = await supplier.send(ESCROW, escrowAbi, "assignDriver", [chainOrderId, driver.account.address]);
  await supplier.api("POST", `/orders/${order.id}/driver/verify`, { txHash: assigned.hash });
  step("driver invited, accepted and assigned on-chain");

  await handoff(order.id, chainOrderId, 1, supplier, driver);
  step("pickup handoff released (supplier -> driver); replayed QR rejected");
  await handoff(order.id, chainOrderId, 2, driver, buyer);
  step("delivery handoff released (driver -> buyer); replayed QR rejected");

  const paidSupplier = (await balance(supplier)) - before.supplier;
  const paidDriver = (await balance(driver)) - before.driver;
  if (paidDriver !== parseUnits("100", 18) || paidSupplier !== parseUnits("900", 18)) {
    throw new Error(`Unexpected payouts: driver ${paidDriver}, supplier ${paidSupplier}`);
  }
  const detail = await buyer.api("GET", `/orders/${order.id}`);
  step(`payouts correct: driver +100 (10%), supplier +400 +500 (40% + 50%); order status "${detail.status}"`);
  step("PASS");
}

main().catch((error) => {
  process.stderr.write(`[smoke] FAIL: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
