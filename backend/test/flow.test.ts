import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import { buildApp } from "../src/app.js";
import type { ExternalIntegrations, Point } from "../src/integrations.js";
import { PatelaService } from "../src/service.js";
import { TestAuth, TestDatabase } from "./helpers.js";
import { TestChain } from "./demo-helpers.js";

const escrow = "0x1111111111111111111111111111111111111111" as Address;
const wallets = [1, 2, 3, 4, 5].map(i =>
  privateKeyToAccount(`0x${i.toString(16).padStart(64, "0")}` as Hex));
const ids: string[] = wallets.map(() => randomUUID());

class TestIntegrations implements ExternalIntegrations {
  async route(_origin: Point, _destination: Point) {
    return { distanceMeters: 250000, duration: "10800s", encodedPolyline: "test" };
  }
  async transcribe(_audio: Buffer, _languageCode: string, _sampleRateHertz: number) { return "Box received"; }
  async speak() { return Buffer.from("test mp3"); }
}

test("auth, sessions, wallet linking and CORS guard the API", async () => {
  const db = new TestDatabase();
  const auth = new TestAuth();
  const chain = new TestChain();
  const service = new PatelaService(db);
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
    const testnetService = new PatelaService(db, 84532);
    assert.equal(testnetService.walletLinkTypedData(ids[0], wallets[0].address,
      `0x${"0".repeat(64)}`, 1).domain.chainId, 84532);
  } finally {
    await app.close();
    await db.close();
  }
});
