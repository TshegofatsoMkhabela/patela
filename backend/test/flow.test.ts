import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { privateKeyToAccount } from "viem/accounts";
import { zeroAddress, type Address, type Hex } from "viem";
import { buildApp } from "../src/app.js";
import type { ChainEvent, ChainVerifier } from "../src/chain.js";
import type { ExternalIntegrations, Point } from "../src/integrations.js";
import { BASE_CHAIN_ID, PatelaService, ZARP_BASE } from "../src/service.js";
import { TestAuth, TestDatabase } from "./helpers.js";

const escrow = "0x1111111111111111111111111111111111111111" as Address;
const wallets = [1, 2, 3, 4, 5].map(i =>
  privateKeyToAccount(`0x${i.toString(16).padStart(64, "0")}` as Hex));
const ids: string[] = wallets.map(() => randomUUID());

class TestChain implements ChainVerifier {
  readonly receipts = new Map<string, ChainEvent[]>();
  async events(txHash: Hex) { return this.receipts.get(txHash) ?? []; }
  add(event: Omit<ChainEvent, "chainId" | "txHash" | "logIndex" | "blockNumber" | "blockHash">) {
    const txHash = `0x${(this.receipts.size + 1).toString(16).padStart(64, "0")}` as Hex;
    this.receipts.set(txHash, [{
      ...event, chainId: BASE_CHAIN_ID, txHash, logIndex: 0, blockNumber: 100n,
      blockHash: `0x${"a".repeat(64)}`,
    }]);
    return txHash;
  }
}

class TestIntegrations implements ExternalIntegrations {
  async route(_origin: Point, _destination: Point) {
    return { distanceMeters: 250000, duration: "10800s", encodedPolyline: "test" };
  }
  async transcribe(_audio: Buffer, _languageCode: string, _sampleRateHertz: number) { return "Box received"; }
  async speak() { return Buffer.from("test mp3"); }
}

test("backend rejects fake money and replayed QR, and advances only on chain events", async () => {
  const db = new TestDatabase();
  const auth = new TestAuth();
  const chain = new TestChain();
  const service = new PatelaService(db, chain, escrow);
  const app = buildApp({ db, auth, chain, escrowAddress: escrow,
    publicOrigin: "http://localhost:3000", integrations: new TestIntegrations(),
    googleClientId: "example-client-id", enableAuthSmokePage: true });
  try {
    await db.migrate();
    for (let i = 0; i < ids.length; i++) {
      auth.users.set(`user-${i}`, { id: ids[i], email: `user${i}@example.test` });
      const me = await app.inject({ method: "GET", url: "/me", headers: { authorization: `Bearer user-${i}` } });
      assert.equal(me.statusCode, 200);
      const challenge = await app.inject({
        method: "POST", url: "/wallet/challenge",
        headers: { authorization: `Bearer user-${i}` },
        payload: { wallet: wallets[i].address },
      });
      assert.equal(challenge.statusCode, 200);
      const response = challenge.json();
      const signature = await wallets[i].signTypedData(service.walletLinkTypedData(
        ids[i], wallets[i].address, response.typedData.message.nonce,
        Number(response.typedData.message.expiresAt),
      ));
      const linked = await app.inject({
        method: "POST", url: "/wallet/link",
        headers: { authorization: `Bearer user-${i}` },
        payload: { challengeId: response.challengeId, signature },
      });
      assert.equal(linked.statusCode, 200);
      const replay = await app.inject({
        method: "POST", url: "/wallet/link",
        headers: { authorization: `Bearer user-${i}` },
        payload: { challengeId: response.challengeId, signature },
      });
      assert.equal(replay.statusCode, 409);
    }
    const unauthorized = await app.inject({ method: "GET", url: "/dashboard" });
    assert.equal(unauthorized.statusCode, 401);
    const allowedOrigin = await app.inject({ method: "GET", url: "/health",
      headers: { origin: "http://localhost:3000" } });
    assert.equal(allowedOrigin.headers["access-control-allow-origin"], "http://localhost:3000");
    const otherOrigin = await app.inject({ method: "GET", url: "/health",
      headers: { origin: "https://untrusted.example" } });
    assert.equal(otherOrigin.headers["access-control-allow-origin"], undefined);
    const otpRequest = await app.inject({
      method: "POST", url: "/auth/otp/request", payload: { email: "user0@example.test" },
    });
    assert.equal(otpRequest.statusCode, 200);
    const otpVerify = await app.inject({
      method: "POST", url: "/auth/otp/verify",
      payload: { email: "user0@example.test", code: "123456" },
    });
    assert.equal(otpVerify.json().accessToken, "user-0");
    const google = await app.inject({ method: "GET", url: "/auth/google/url" });
    assert.equal(google.statusCode, 200);
    assert.equal(google.json().url, "https://accounts.google.com/test");
    const smokePage = await app.inject({ method: "GET", url: "/auth/google/test" });
    assert.equal(smokePage.statusCode, 200);
    assert.match(smokePage.body, /example-client-id/);
    assert.match(String(smokePage.headers["content-security-policy"]), /accounts\.google\.com/);
    const credential = "valid-credential".repeat(10);
    const wrongCredentialOrigin = await app.inject({
      method: "POST", url: "/auth/google/id-token", headers: { origin: "https://untrusted.example" },
      payload: { credential },
    });
    assert.equal(wrongCredentialOrigin.statusCode, 403);
    const badCredential = await app.inject({
      method: "POST", url: "/auth/google/id-token", headers: { origin: "http://localhost:4000" },
      payload: { credential: "wrong".repeat(30) },
    });
    assert.equal(badCredential.statusCode, 401);
    const credentialLogin = await app.inject({
      method: "POST", url: "/auth/google/id-token", headers: { origin: "http://localhost:4000" },
      payload: { credential },
    });
    assert.equal(credentialLogin.statusCode, 200, credentialLogin.body);
    assert.equal(credentialLogin.json().authenticated, true);
    const credentialCookies = (credentialLogin.headers["set-cookie"] as string[])
      .map(value => value.split(";")[0]).join("; ");
    const credentialProfile = await app.inject({
      method: "GET", url: "/me", headers: { cookie: credentialCookies },
    });
    assert.equal(credentialProfile.statusCode, 200);
    assert.equal(credentialProfile.json().id, ids[0]);
    const start = await app.inject({ method: "GET", url: "/auth/google/start" });
    assert.equal(start.statusCode, 303);
    assert.equal(start.headers.location, "https://accounts.google.com/test");
    const pkceCookie = String(start.headers["set-cookie"]).split(";")[0];
    assert.equal(JSON.parse(decodeURIComponent(pkceCookie.split("=")[1])).s, "test-state");
    const noVerifier = await app.inject({
      method: "GET", url: "/auth/google/callback?code=valid-code",
    });
    assert.equal(noVerifier.statusCode, 400);
    const badCode = await app.inject({
      method: "GET", url: "/auth/google/callback?code=bad-code&state=test-state",
      headers: { cookie: pkceCookie },
    });
    assert.equal(badCode.statusCode, 401);
    const wrongState = await app.inject({
      method: "GET", url: "/auth/google/callback?code=valid-code&state=wrong-state",
      headers: { cookie: pkceCookie },
    });
    assert.equal(wrongState.statusCode, 400);
    const callback = await app.inject({
      method: "GET", url: "/auth/google/callback?code=valid-code&state=test-state",
      headers: { cookie: pkceCookie },
    });
    assert.equal(callback.statusCode, 303, callback.body);
    assert.equal(callback.headers.location, "http://localhost:3000/?auth=google");
    const oauthCookies = (callback.headers["set-cookie"] as string[])
      .map(value => value.split(";")[0]).join("; ");
    const oauthSession = await app.inject({
      method: "GET", url: "/me", headers: { cookie: oauthCookies },
    });
    assert.equal(oauthSession.statusCode, 200);
    assert.equal(oauthSession.json().id, ids[0]);
    const apiOnly = buildApp({ db, auth, chain, escrowAddress: escrow,
      publicOrigin: "http://localhost:4000", apiOrigin: "http://localhost:4000" });
    try {
      const completed = await apiOnly.inject({
        method: "GET", url: "/auth/google/callback?code=valid-code&state=test-state",
        headers: { cookie: pkceCookie },
      });
      assert.equal(completed.statusCode, 303);
      assert.equal(completed.headers.location, "http://localhost:4000/auth/success");
      const completedCookies = (completed.headers["set-cookie"] as string[])
        .map(value => value.split(";")[0]).join("; ");
      const success = await apiOnly.inject({
        method: "GET", url: "/auth/success", headers: { cookie: completedCookies },
      });
      assert.equal(success.json().authenticated, true);
    } finally { await apiOnly.close(); }
    const idTokenOnly = buildApp({ db, auth, escrowAddress: escrow,
      publicOrigin: "http://localhost:4000", apiOrigin: "http://localhost:4000",
      enableGoogleCodeFlow: false });
    try {
      assert.equal((await idTokenOnly.inject({ method: "GET", url: "/auth/google/start" })).statusCode, 503);
      assert.equal((await idTokenOnly.inject({ method: "GET", url: "/auth/google/test" })).statusCode, 404);
    } finally { await idTokenOnly.close(); }
    const refreshed = await app.inject({
      method: "GET", url: "/me",
      headers: { cookie: "patela_access=expired; patela_refresh=test-refresh" },
    });
    assert.equal(refreshed.statusCode, 200);
    assert.ok(refreshed.headers["set-cookie"]);
    const blockedCookieOrigin = await app.inject({
      method: "GET", url: "/me",
      headers: { cookie: oauthCookies, origin: "https://untrusted.example" },
    });
    assert.equal(blockedCookieOrigin.statusCode, 403);
    const stages = [
      { fromUserId: ids[1], toUserId: ids[2] },
      { fromUserId: ids[2], toUserId: ids[3], payeeUserId: ids[3] },
      { fromUserId: ids[3], toUserId: ids[2], payeeUserId: ids[1] },
      { fromUserId: ids[2], toUserId: ids[0], payeeUserId: ids[1] },
    ];
    const placeOrder = () => app.inject({
      method: "POST", url: "/orders", headers: { authorization: "Bearer user-0" },
      payload: { amountZarp: "100.00", handoffs: stages, refundAfterHours: 24 },
    });
    assert.equal((await placeOrder()).statusCode, 403, "a buyer without an approved business cannot order");

    // Each participant's business is onboarded and approved by a temporary platform admin.
    await db.query("update profiles set role='admin' where id=$1", [ids[4]]);
    const approveBusiness = async (user: number, capability: string) => {
      const org = await app.inject({
        method: "POST", url: "/organizations", headers: { authorization: `Bearer user-${user}` },
        payload: { legalName: `Test ${capability} (Pty) Ltd`, registrationNumber: `2020/00000${user}/07`,
          capabilities: [capability] },
      });
      assert.equal(org.statusCode, 200, org.body);
      await app.inject({ method: "POST", url: `/organizations/${org.json().id}/submit`,
        headers: { authorization: `Bearer user-${user}` } });
      const approved = await app.inject({ method: "POST", url: `/admin/organizations/${org.json().id}/review`,
        headers: { authorization: "Bearer user-4" }, payload: { decision: "approve" } });
      assert.equal(approved.json().status, "approved");
    };
    await approveBusiness(0, "buyer");
    await approveBusiness(1, "supplier");
    await approveBusiness(2, "warehouse");
    assert.equal((await placeOrder()).statusCode, 403, "the carrier's business is not approved yet");
    await approveBusiness(3, "carrier");
    await db.query("update profiles set role='member' where id=$1", [ids[4]]);

    const created = await app.inject({
      method: "POST", url: "/orders", headers: { authorization: "Bearer user-0" },
      payload: { amountZarp: "100.00", handoffs: stages, refundAfterHours: 24 },
    });
    assert.equal(created.statusCode, 200, created.body);
    const order = created.json();
    assert.equal(order.amount_wei, "100000000000000000000");
    assert.deepEqual(order.stages.map((s: { payout_wei: string }) => s.payout_wei), [
      "0", "10000000000000000000", "40000000000000000000", "50000000000000000000",
    ]);
    const outsider = await app.inject({
      method: "GET", url: `/orders/${order.id}`, headers: { authorization: "Bearer user-4" },
    });
    assert.equal(outsider.statusCode, 404);
    const route = await app.inject({
      method: "POST", url: `/orders/${order.id}/route`, headers: { authorization: "Bearer user-0" },
      payload: { origin: { lat: -26.2041, lng: 28.0473 }, destination: { lat: -23.9045, lng: 29.4689 } },
    });
    assert.equal(route.statusCode, 200);
    assert.equal(route.json().distanceMeters, 250000);
    const hiddenRoute = await app.inject({
      method: "POST", url: `/orders/${order.id}/route`, headers: { authorization: "Bearer user-4" },
      payload: { origin: { lat: -26.2041, lng: 28.0473 }, destination: { lat: -23.9045, lng: 29.4689 } },
    });
    assert.equal(hiddenRoute.statusCode, 404);
    const voice = await app.inject({
      method: "POST", url: "/voice/speak", headers: { authorization: "Bearer user-0" },
      payload: { text: "Order funded" },
    });
    assert.equal(voice.statusCode, 200);
    assert.equal(voice.json().mimeType, "audio/mpeg");
    const transcript = await app.inject({
      method: "POST", url: "/voice/transcribe", headers: { authorization: "Bearer user-0" },
      payload: { audioBase64: Buffer.alloc(120, 1).toString("base64") },
    });
    assert.equal(transcript.statusCode, 200);
    assert.equal(transcript.json().transcript, "Box received");
    const tooEarly = await app.inject({
      method: "POST", url: `/orders/${order.id}/handoffs/1/challenge`,
      headers: { authorization: "Bearer user-1" },
    });
    assert.equal(tooEarly.statusCode, 409);
    const badFunding = chain.add({
      name: "OrderFunded", orderId: order.chain_order_id, actor: wallets[0].address,
      token: ZARP_BASE, amountWei: 99n * 10n ** 18n,
    });
    const rejectedFunding = await app.inject({
      method: "POST", url: `/orders/${order.id}/funding/verify`,
      headers: { authorization: "Bearer user-0" }, payload: { txHash: badFunding },
    });
    assert.equal(rejectedFunding.statusCode, 409);
    const stillPending = await service.orderFor(ids[0], order.id);
    assert.equal(stillPending.status, "awaiting_funding");
    const funding = chain.add({
      name: "OrderFunded", orderId: order.chain_order_id, actor: wallets[0].address,
      token: ZARP_BASE, amountWei: 100n * 10n ** 18n,
    });
    const funded = await app.inject({
      method: "POST", url: `/orders/${order.id}/funding/verify`,
      headers: { authorization: "Bearer user-0" }, payload: { txHash: funding },
    });
    assert.equal(funded.statusCode, 200, funded.body);
    assert.equal(funded.json().status, "funded");
    const dispute = await app.inject({
      method: "POST", url: `/orders/${order.id}/disputes`,
      headers: { authorization: "Bearer user-1" },
      payload: { reason: "The warehouse handoff has not been documented." },
    });
    assert.equal(dispute.statusCode, 200, dispute.body);
    const pausedChallenge = await app.inject({
      method: "POST", url: `/orders/${order.id}/handoffs/1/challenge`,
      headers: { authorization: "Bearer user-1" },
    });
    assert.equal(pausedChallenge.statusCode, 409);
    await db.query("update profiles set role='admin' where id=$1", [ids[4]]);
    const queue = await app.inject({
      method: "GET", url: "/admin/disputes", headers: { authorization: "Bearer user-4" },
    });
    assert.equal(queue.json().disputes.length, 1);
    const reviewed = await app.inject({
      method: "POST", url: `/admin/disputes/${dispute.json().id}/review`,
      headers: { authorization: "Bearer user-4" },
      payload: { decision: "reject", note: "Warehouse evidence checked with both parties." },
    });
    assert.equal(reviewed.statusCode, 200, reviewed.body);

    for (let stage = 1; stage <= 4; stage++) {
      const actorIndex = stage === 1 ? 1 : stage === 2 ? 2 : stage === 3 ? 3 : 2;
      const challenge = await app.inject({
        method: "POST", url: `/orders/${order.id}/handoffs/${stage}/challenge`,
        headers: { authorization: `Bearer user-${actorIndex}` },
      });
      assert.equal(challenge.statusCode, 200, challenge.body);
      let issued = challenge.json();
      if (stage === 1) {
        const replacement = await app.inject({
          method: "POST", url: `/orders/${order.id}/handoffs/1/challenge`,
          headers: { authorization: "Bearer user-1" },
        });
        assert.equal(replacement.statusCode, 200);
        const stale = await app.inject({
          method: "POST", url: `/orders/${order.id}/handoffs/1/submit`,
          headers: { authorization: "Bearer user-1" },
          payload: { nonce: issued.typedData.message.nonce,
            fromSignature: "0x00", toSignature: "0x00" },
        });
        assert.equal(stale.statusCode, 409);
        issued = replacement.json();
      }
      const current = await service.orderFor(ids[0], order.id);
      const handoff = current.stages[stage - 1];
      const fromIndex = ids.indexOf(String(handoff.from_user_id));
      const toIndex = ids.indexOf(String(handoff.to_user_id));
      const typedData = service.handoffTypedData(current, {
        ...handoff, nonce: issued.typedData.message.nonce,
        challenge_expires_at: issued.expiresAt,
      }, wallets[fromIndex].address, wallets[toIndex].address);
      const fromSignature = await wallets[fromIndex].signTypedData(typedData);
      const toSignature = await wallets[toIndex].signTypedData(typedData);
      if (stage === 1) {
        const midChallengeDispute = await app.inject({
          method: "POST", url: `/orders/${order.id}/disputes`,
          headers: { authorization: "Bearer user-2" },
          payload: { reason: "Custody evidence is incomplete at this handoff." },
        });
        assert.equal(midChallengeDispute.statusCode, 200);
        const pausedSubmit = await app.inject({
          method: "POST", url: `/orders/${order.id}/handoffs/1/submit`,
          headers: { authorization: "Bearer user-1" },
          payload: { nonce: issued.typedData.message.nonce, fromSignature, toSignature },
        });
        assert.equal(pausedSubmit.statusCode, 409);
        const disputeReview = await app.inject({
          method: "POST", url: `/admin/disputes/${midChallengeDispute.json().id}/review`,
          headers: { authorization: "Bearer user-4" },
          payload: { decision: "reject", note: "Both signers supplied matching custody records." },
        });
        assert.equal(disputeReview.statusCode, 200);
        const wrongSignature = await wallets[4].signTypedData(typedData);
        const rejected = await app.inject({
          method: "POST", url: `/orders/${order.id}/handoffs/1/submit`,
          headers: { authorization: "Bearer user-1" },
          payload: { nonce: issued.typedData.message.nonce,
            fromSignature: wrongSignature, toSignature },
        });
        assert.equal(rejected.statusCode, 403);
      }
      const beforeSubmit = await service.orderFor(ids[0], order.id);
      assert.notEqual(beforeSubmit.stages[stage - 1].status, "confirmed");
      const submit = await app.inject({
        method: "POST", url: `/orders/${order.id}/handoffs/${stage}/submit`,
        headers: { authorization: `Bearer user-${actorIndex}` },
        payload: { nonce: issued.typedData.message.nonce, fromSignature, toSignature },
      });
      assert.equal(submit.statusCode, 200, submit.body);
      const duplicate = await app.inject({
        method: "POST", url: `/orders/${order.id}/handoffs/${stage}/submit`,
        headers: { authorization: `Bearer user-${actorIndex}` },
        payload: { nonce: issued.typedData.message.nonce, fromSignature, toSignature },
      });
      assert.equal(duplicate.statusCode, 409);
      const awaiting = await service.orderFor(ids[0], order.id);
      assert.equal(awaiting.stages[stage - 1].status, "awaiting_chain");
      const payeeIndex = handoff.payee_user_id ? ids.indexOf(String(handoff.payee_user_id)) : -1;
      const txHash = chain.add({
        name: "HandoffCompleted", orderId: order.chain_order_id, stage,
        actor: payeeIndex < 0 ? zeroAddress : wallets[payeeIndex].address,
        amountWei: BigInt(String(handoff.payout_wei)),
      });
      const verified = await app.inject({
        method: "POST", url: `/orders/${order.id}/handoffs/${stage}/verify`,
        headers: { authorization: `Bearer user-${actorIndex}` }, payload: { txHash },
      });
      assert.equal(verified.statusCode, 200, verified.body);
      assert.equal(verified.json().stages[stage - 1].status, "confirmed");
    }
    const delivered = await service.orderFor(ids[0], order.id);
    assert.equal(delivered.status, "delivered");
    assert.equal(delivered.events.length, 5);

    const second = await service.createOrder(ids[0], "20.00", stages, 1);
    const secondFunding = chain.add({
      name: "OrderFunded", orderId: second.chain_order_id as Hex, actor: wallets[0].address,
      token: ZARP_BASE, amountWei: 20n * 10n ** 18n,
    });
    await service.verifyFunding(ids[0], second.id, secondFunding);
    const refund = chain.add({
      name: "OrderRefunded", orderId: second.chain_order_id as Hex, actor: wallets[0].address,
      amountWei: 20n * 10n ** 18n,
    });
    const refunded = await service.verifyRefund(ids[0], second.id, refund);
    assert.equal(refunded.status, "refunded");
    const testToken = "0x2222222222222222222222222222222222222222" as Address;
    const testnetService = new PatelaService(db, chain, escrow, 84532, testToken, 18);
    const testnetOrder = await testnetService.createOrder(ids[0], "1.00", stages, 1);
    assert.equal(testnetOrder.chain_id, 84532);
    assert.equal(testnetOrder.token_address, testToken.toLowerCase());
    assert.equal(testnetService.walletLinkTypedData(ids[0], wallets[0].address,
      `0x${"0".repeat(64)}`, 1).domain.chainId, 84532);
  } finally {
    await app.close();
    await db.close();
  }
});
