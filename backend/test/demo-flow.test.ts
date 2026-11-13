import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { keccak256, toBytes, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { buildApp } from "../src/app.js";
import { evidenceHash, type Evidence } from "../src/orders.js";
import { TestAuth, TestDatabase } from "./helpers.js";
import {
  DEMO_CHAIN_ID, ESCROW, TOKEN, TestChain, TestIntegrations, TestMail, approveBuyer, approveCapability, bearer,
  linkWallet, tokenFrom, zarp,
} from "./demo-helpers.js";

// Users: 0 buyer, 1 supplier, 2 driver, 3 outsider / platform admin.
const wallets = [11, 12, 13, 14].map(i => privateKeyToAccount(`0x${i.toString(16).padStart(64, "0")}` as Hex));
const [buyer, supplier, driver] = wallets;
const ids = wallets.map(() => randomUUID());
const emails = ["buyer@example.test", "supplier@example.test", "driver@example.test", "outsider@example.test"];
const AGREEMENT = "20 crates of tomatoes, Johannesburg market to Polokwane, delivered by Friday.";
const SIG = `0x${"11".repeat(65)}` as Hex;
const NONCE = (n: number) => `0x${n.toString(16).padStart(64, "0")}` as Hex;
const now = () => Math.floor(Date.now() / 1000);
const evidence = (role: Evidence["role"], lat: number): Evidence =>
  ({ lat, lng: 28.0473, accuracyM: 12, capturedAt: now(), role });


test("demo flow: order, email invites, on-chain steps, QR handoffs and refund", async () => {
  const db = new TestDatabase();
  const auth = new TestAuth();
  const chain = new TestChain();
  const mail = new TestMail();
  const app = buildApp({ db, auth, chain, escrowAddress: ESCROW, publicOrigin: "http://localhost:3000",
    chainId: DEMO_CHAIN_ID, tokenAddress: TOKEN, tokenDecimals: 18, integrations: new TestIntegrations(),
    mailTransport: mail, demoMode: true });
  const setAdmin = (role: string) => db.query("update profiles set role=$2 where id=$1", [ids[3], role]);
  const post = (user: number, url: string, payload: Record<string, unknown> = {}) =>
    app.inject({ method: "POST", url, headers: bearer(user), payload });
  const get = (user: number, url: string) => app.inject({ method: "GET", url, headers: bearer(user) });
  try {
    await db.migrate();
    for (let i = 0; i < wallets.length; i++) {
      auth.users.set(`user-${i}`, { id: ids[i], email: emails[i] });
      await linkWallet(app, i, ids[i], wallets[i]);
    }
    const orderBody = {
      supplierEmail: "Supplier@Example.test", totalZar: "1000", driverAtPickupZar: "100",
      supplierAtPickupZar: "400", supplierAtDeliveryZar: "500.00", refundAfterHours: 48,
      agreementText: AGREEMENT,
    };

    // 1. Only a buyer whose business is approved may order.
    assert.equal((await post(0, "/orders", orderBody)).statusCode, 403);
    await approveBuyer(app, setAdmin, 0, 3, "2021/000001/07");

    // 2. Splits must add up to the total; nothing is stored or emailed otherwise.
    const badSplit = await post(0, "/orders", { ...orderBody, supplierAtDeliveryZar: "499.99" });
    assert.equal(badSplit.statusCode, 400, badSplit.body);
    assert.equal((await post(0, "/orders", { ...orderBody, totalZar: "1000.001" })).statusCode, 400);
    assert.equal((await db.query("select id from orders")).rows.length, 0);
    assert.equal((await db.query("select id from email_outbox where template like 'order_%'")).rows.length, 0);

    // 3. Creating the order emails the supplier a one-time accept link (also returned in demo mode).
    const created = await post(0, "/orders", orderBody);
    assert.equal(created.statusCode, 200, created.body);
    const order = created.json();
    assert.equal(order.agreementHash, keccak256(toBytes(AGREEMENT)));
    assert.ok(new Date(order.refundDeadline).getTime() > Date.now() + 47 * 3_600_000);
    // (The buyer's earlier "business approved" email goes out in the same flush; only order emails are checked.)
    const invites = mail.sent.filter(m => m.subject.includes("invited"));
    assert.equal(invites.length, 1);
    assert.equal(invites[0].to, "supplier@example.test");
    assert.ok(invites[0].text.includes(order.acceptUrl), "the email carries the accept link");
    assert.match(order.acceptUrl, /^http:\/\/localhost:3000\/accept\?token=/);
    const outbox = await db.query("select status from email_outbox where template like 'order_%'");
    assert.deepEqual(outbox.rows.map(r => r.status), ["sent"]);
    const supplierToken = tokenFrom(order.acceptUrl);

    // 4. The buyer cannot put the order on chain before the supplier has accepted (no supplier wallet yet).
    const early = chain.add({ name: "OrderCreated", orderId: 7n, buyer: buyer.address,
      supplier: supplier.address, amountWei: zarp(1000), agreementHash: order.agreementHash });
    assert.equal((await post(0, `/orders/${order.id}/chain`, { chainOrderId: "7", createTxHash: early })).statusCode, 409);

    // 5. The accept link shows the agreement without signing in, and works once, for the invited email only.
    const invitation = await app.inject({ method: "GET", url: `/invitations/${supplierToken}` });
    assert.equal(invitation.statusCode, 200, invitation.body);
    assert.deepEqual(invitation.json(), { orderId: order.id, role: "supplier", email: "supplier@example.test",
      agreementText: AGREEMENT, agreementHash: order.agreementHash });
    const wrongPerson = await post(2, `/invitations/${supplierToken}/accept`, { walletAddress: driver.address });
    assert.equal(wrongPerson.statusCode, 403);
    const wrongWallet = await post(1, `/invitations/${supplierToken}/accept`, { walletAddress: driver.address });
    assert.equal(wrongWallet.statusCode, 409, "the wallet must be the one this user linked");
    const unauthorizedSupplier = await post(1, `/invitations/${supplierToken}/accept`,
      { walletAddress: supplier.address });
    assert.equal(unauthorizedSupplier.statusCode, 403, "an unapproved supplier cannot accept");
    await approveCapability(app, setAdmin, 1, 3, "2021/000002/07", "supplier");
    const accepted = await post(1, `/invitations/${supplierToken}/accept`, { walletAddress: supplier.address });
    assert.equal(accepted.statusCode, 200, accepted.body);
    assert.equal(accepted.json().status, "awaiting_chain");
    assert.equal(accepted.json().parties.supplier.wallet, supplier.address.toLowerCase());
    assert.equal((await post(1, `/invitations/${supplierToken}/accept`, { walletAddress: supplier.address }))
      .statusCode, 409, "an accept link is single-use");

    // 6. Linking the on-chain order checks the OrderCreated event field by field.
    const wrongTotal = chain.add({ name: "OrderCreated", orderId: 7n, buyer: buyer.address,
      supplier: supplier.address, amountWei: zarp(999), agreementHash: order.agreementHash });
    assert.equal((await post(0, `/orders/${order.id}/chain`, { chainOrderId: "7", createTxHash: wrongTotal }))
      .statusCode, 409);
    const notBuyer = await post(1, `/orders/${order.id}/chain`, { chainOrderId: "7", createTxHash: early });
    assert.equal(notBuyer.statusCode, 403);
    const linked = await post(0, `/orders/${order.id}/chain`, { chainOrderId: "7", createTxHash: early });
    assert.equal(linked.statusCode, 200, linked.body);
    assert.equal(linked.json().status, "awaiting_funding");
    assert.equal(linked.json().chainOrderId, "7");

    // 7. Funding is accepted only for the exact total.
    const short = chain.add({ name: "EscrowFunded", orderId: 7n, amountWei: zarp(999) });
    assert.equal((await post(0, `/orders/${order.id}/funding/verify`, { txHash: short })).statusCode, 409);
    const funding = chain.add({ name: "EscrowFunded", orderId: 7n, amountWei: zarp(1000) });
    const funded = await post(0, `/orders/${order.id}/funding/verify`, { txHash: funding });
    assert.equal(funded.statusCode, 200, funded.body);
    assert.equal(funded.json().status, "funded");
    assert.equal((await post(0, `/orders/${order.id}/funding/verify`, { txHash: funding })).statusCode, 200,
      "re-sending the same funding tx is harmless");

    // 8. The supplier accepts on chain; only then can they invite a driver.
    assert.equal((await post(1, `/orders/${order.id}/driver-invite`, { email: emails[2] })).statusCode, 409);
    const otherHash = chain.add({ name: "OrderAccepted", orderId: 7n, supplier: supplier.address,
      agreementHash: keccak256(toBytes("something else")) });
    assert.equal((await post(1, `/orders/${order.id}/acceptance/verify`, { txHash: otherHash })).statusCode, 409);
    const acceptTx = chain.add({ name: "OrderAccepted", orderId: 7n, supplier: supplier.address,
      agreementHash: order.agreementHash });
    const onChainAccepted = await post(1, `/orders/${order.id}/acceptance/verify`, { txHash: acceptTx });
    assert.equal(onChainAccepted.statusCode, 200, onChainAccepted.body);
    assert.equal(onChainAccepted.json().status, "accepted");

    // 9. Only the supplier invites the driver; the driver accepts the same way and is assigned on chain.
    assert.equal((await post(0, `/orders/${order.id}/driver-invite`, { email: emails[2] })).statusCode, 403);
    const driverInvite = await post(1, `/orders/${order.id}/driver-invite`, { email: emails[2] });
    assert.equal(driverInvite.statusCode, 200, driverInvite.body);
    assert.equal(driverInvite.json().invited, true);
    assert.equal(mail.sent.at(-1)?.to, emails[2]);
    const driverToken = tokenFrom(driverInvite.json().acceptUrl);
    assert.equal((await app.inject({ method: "GET", url: `/invitations/${driverToken}` })).json().role, "driver");
    const unauthorizedDriver = await post(2, `/invitations/${driverToken}/accept`, { walletAddress: driver.address });
    assert.equal(unauthorizedDriver.statusCode, 403, "an unapproved carrier cannot accept as driver");
    await approveCapability(app, setAdmin, 2, 3, "2021/000003/07", "carrier");
    const driverAccepted = await post(2, `/invitations/${driverToken}/accept`, { walletAddress: driver.address });
    assert.equal(driverAccepted.statusCode, 200, driverAccepted.body);
    const wrongDriver = chain.add({ name: "DriverAssigned", orderId: 7n, driver: wallets[3].address });
    assert.equal((await post(1, `/orders/${order.id}/driver/verify`, { txHash: wrongDriver })).statusCode, 409);
    const assignTx = chain.add({ name: "DriverAssigned", orderId: 7n, driver: driver.address });
    const assigned = await post(1, `/orders/${order.id}/driver/verify`, { txHash: assignTx });
    assert.equal(assigned.statusCode, 200, assigned.body);
    assert.equal(assigned.json().status, "driver_assigned");

    // 10. Outsiders see nothing; participants keep route and voice tools.
    assert.equal((await get(3, `/orders/${order.id}`)).statusCode, 404);
    const route = await post(2, `/orders/${order.id}/route`,
      { origin: { lat: -26.2041, lng: 28.0473 }, destination: { lat: -23.9045, lng: 29.4689 } });
    assert.equal(route.json().distanceMeters, 250000);
    assert.equal((await post(3, `/orders/${order.id}/route`,
      { origin: { lat: -26.2, lng: 28 }, destination: { lat: -23.9, lng: 29.4 } })).statusCode, 404);
    assert.equal((await post(0, "/voice/speak", { text: "Order funded" })).json().mimeType, "audio/mpeg");

    // 11. An open dispute pauses handoffs until an admin decides.
    const dispute = await post(2, `/orders/${order.id}/disputes`, { reason: "Crate count looks short at the gate." });
    assert.equal(dispute.statusCode, 200, dispute.body);
    const giverPickup = evidence("giver", -26.2041);
    const pickupSession = { nonce: NONCE(1), expiresAt: now() + 120, giverEvidence: giverPickup };
    assert.equal((await post(1, `/orders/${order.id}/handoffs/1/session`, pickupSession)).statusCode, 409);
    await setAdmin("admin");
    const reviewed = await post(3, `/admin/disputes/${dispute.json().id}/review`,
      { decision: "reject", note: "Supplier and driver recounted the crates together." });
    assert.equal(reviewed.statusCode, 200, reviewed.body);
    await setAdmin("member");

    // 12. Pickup: only the giver (supplier) opens the session; delivery cannot start first.
    assert.equal((await post(1, `/orders/${order.id}/handoffs/1/session`, {
      ...pickupSession, giverEvidence: { ...giverPickup, capturedAt: now() - 301 },
    })).statusCode, 400, "stale giver evidence is rejected");
    assert.equal((await post(2, `/orders/${order.id}/handoffs/1/session`, pickupSession)).statusCode, 403);
    assert.equal((await post(2, `/orders/${order.id}/handoffs/2/session`,
      { ...pickupSession, nonce: NONCE(9), giverEvidence: evidence("giver", -26) })).statusCode, 409);
    assert.equal((await post(1, `/orders/${order.id}/handoffs/1/session`,
      { ...pickupSession, expiresAt: now() + 3600 })).statusCode, 400, "QR codes live at most a few minutes");
    const opened = await post(1, `/orders/${order.id}/handoffs/1/session`, pickupSession);
    assert.equal(opened.statusCode, 200, opened.body);
    const pickupId = opened.json().sessionId;
    const sessionUrl = `/orders/${order.id}/handoffs/1/session/${pickupId}`;

    // 13. The receiver (driver) sends back its evidence; the hash must be the frozen formula.
    const receiverPickup = evidence("receiver", -26.2042);
    const pickupHash = evidenceHash(giverPickup, receiverPickup);
    assert.equal((await post(1, `${sessionUrl}/receiver`,
      { receiverEvidence: receiverPickup, evidenceHash: pickupHash, receiverSig: SIG })).statusCode, 403);
    const staleReceiver = { ...receiverPickup, capturedAt: now() - 301 };
    assert.equal((await post(2, `${sessionUrl}/receiver`, {
      receiverEvidence: staleReceiver, evidenceHash: evidenceHash(giverPickup, staleReceiver), receiverSig: SIG,
    })).statusCode, 400, "stale receiver evidence is rejected");
    assert.equal((await post(2, `${sessionUrl}/receiver`,
      { receiverEvidence: receiverPickup, evidenceHash: NONCE(5), receiverSig: SIG })).statusCode, 400);
    assert.deepEqual((await get(1, sessionUrl)).json(), {}, "nothing to sign until the receiver scans");
    const scanned = await post(2, `${sessionUrl}/receiver`,
      { receiverEvidence: receiverPickup, evidenceHash: pickupHash, receiverSig: SIG });
    assert.equal(scanned.statusCode, 200, scanned.body);
    assert.equal((await post(2, `${sessionUrl}/receiver`,
      { receiverEvidence: receiverPickup, evidenceHash: pickupHash, receiverSig: SIG })).statusCode, 409,
    "a QR code that was already scanned is rejected");
    assert.deepEqual((await get(1, sessionUrl)).json(),
      { receiverEvidence: receiverPickup, evidenceHash: pickupHash, receiverSig: SIG });

    // 14. The release tx must carry the verified handoff and both pickup payments.
    const underpaid = chain.add(
      { name: "HandoffVerified", orderId: 7n, stage: 1, giver: supplier.address, receiver: driver.address,
        evidenceHash: pickupHash },
      { name: "PaymentReleased", orderId: 7n, stage: 1, recipient: driver.address, amountWei: zarp(50) },
      { name: "PaymentReleased", orderId: 7n, stage: 1, recipient: supplier.address, amountWei: zarp(400) });
    assert.equal((await post(1, `/orders/${order.id}/handoffs/1/verify`, { txHash: underpaid })).statusCode, 409);
    const pickupTx = chain.add(
      { name: "HandoffVerified", orderId: 7n, stage: 1, giver: supplier.address, receiver: driver.address,
        evidenceHash: pickupHash },
      { name: "PaymentReleased", orderId: 7n, stage: 1, recipient: driver.address, amountWei: zarp(100) },
      { name: "PaymentReleased", orderId: 7n, stage: 1, recipient: supplier.address, amountWei: zarp(400) });
    const picked = await post(1, `/orders/${order.id}/handoffs/1/verify`, { txHash: pickupTx });
    assert.equal(picked.statusCode, 200, picked.body);
    assert.equal(picked.json().status, "in_progress");
    assert.equal(picked.json().stagesDone, 1);

    // 15. Delivery: an expired QR (a screenshot shown too late) is rejected; a fresh one releases the rest.
    const giverDelivery = evidence("giver", -23.9045);
    const stale = await post(2, `/orders/${order.id}/handoffs/2/session`,
      { nonce: NONCE(2), expiresAt: now() + 60, giverEvidence: giverDelivery });
    assert.equal(stale.statusCode, 200, stale.body);
    await db.query("update handoff_sessions set expires_at=now() - interval '1 second' where id=$1",
      [stale.json().sessionId]);
    const receiverDelivery = evidence("receiver", -23.9046);
    const deliveryHash = evidenceHash(giverDelivery, receiverDelivery);
    assert.equal((await post(0, `/orders/${order.id}/handoffs/2/session/${stale.json().sessionId}/receiver`,
      { receiverEvidence: receiverDelivery, evidenceHash: deliveryHash, receiverSig: SIG })).statusCode, 409);
    const fresh = await post(2, `/orders/${order.id}/handoffs/2/session`,
      { nonce: NONCE(3), expiresAt: now() + 120, giverEvidence: giverDelivery });
    assert.equal((await post(0, `/orders/${order.id}/handoffs/2/session/${fresh.json().sessionId}/receiver`,
      { receiverEvidence: receiverDelivery, evidenceHash: deliveryHash, receiverSig: SIG })).statusCode, 200);
    const deliveryTx = chain.add(
      { name: "HandoffVerified", orderId: 7n, stage: 2, giver: driver.address, receiver: buyer.address,
        evidenceHash: deliveryHash },
      { name: "PaymentReleased", orderId: 7n, stage: 2, recipient: supplier.address, amountWei: zarp(500) });
    const delivered = await post(2, `/orders/${order.id}/handoffs/2/verify`, { txHash: deliveryTx });
    assert.equal(delivered.statusCode, 200, delivered.body);
    assert.equal(delivered.json().status, "delivered");

    // 16. The order view has parties, the on-chain timeline and live balances for the four-wallet panel.
    chain.balances.set(ESCROW.toLowerCase(), 0n);
    chain.balances.set(supplier.address.toLowerCase(), zarp(900));
    const view = (await get(0, `/orders/${order.id}`)).json();
    assert.equal(view.parties.buyer.email, emails[0]);
    assert.equal(view.parties.driver.wallet, driver.address.toLowerCase());
    assert.deepEqual(view.timeline.map((e: { event: string }) => e.event), [
      "OrderCreated", "EscrowFunded", "OrderAccepted", "DriverAssigned",
      "HandoffVerified", "PaymentReleased", "PaymentReleased", "HandoffVerified", "PaymentReleased",
    ]);
    assert.equal(view.balances.supplier, zarp(900).toString());
    assert.equal(view.balances.escrow, "0");
    assert.equal(view.agreementText, AGREEMENT);

    // 17. Refund: a second funded order returns everything unpaid to the buyer.
    mail.failing = true;
    const second = await post(0, "/orders", { ...orderBody, totalZar: "10", driverAtPickupZar: "1",
      supplierAtPickupZar: "4", supplierAtDeliveryZar: "5", refundAfterHours: 1 });
    assert.equal(second.statusCode, 200, "a mail outage does not block ordering");
    const queued = await db.query("select status from email_outbox where payload->>'orderId'=$1", [second.json().id]);
    assert.deepEqual(queued.rows.map(r => r.status), ["pending"]);
    mail.failing = false;
    await post(1, `/invitations/${tokenFrom(second.json().acceptUrl)}/accept`, { walletAddress: supplier.address });
    const id2 = second.json().id;
    await post(0, `/orders/${id2}/chain`, { chainOrderId: "8", createTxHash: chain.add({ name: "OrderCreated",
      orderId: 8n, buyer: buyer.address, supplier: supplier.address, amountWei: zarp(10),
      agreementHash: second.json().agreementHash }) });
    await post(0, `/orders/${id2}/funding/verify`,
      { txHash: chain.add({ name: "EscrowFunded", orderId: 8n, amountWei: zarp(10) }) });
    const refundTx = chain.add({ name: "OrderRefunded", orderId: 8n, buyer: buyer.address, amountWei: zarp(10) });
    const refunded = await post(0, `/orders/${id2}/refund/verify`, { txHash: refundTx });
    assert.equal(refunded.statusCode, 200, refunded.body);
    assert.equal(refunded.json().status, "refunded");
  } finally {
    await app.close();
    await db.close();
  }
});
