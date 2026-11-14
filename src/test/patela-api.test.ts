import { describe, expect, it } from "vitest";
import {
  ApiError,
  createPatelaApi,
  safeNextPath,
  toAuthUser,
  type Profile,
} from "@/lib/patela-api";

type Call = { url: string; init: RequestInit };

function stubFetch(responses: Array<{ status?: number; body: unknown }>) {
  const calls: Call[] = [];
  const fetch = async (url: string | URL | Request, init: RequestInit = {}) => {
    calls.push({ url: String(url), init });
    const next = responses.shift();
    if (!next) throw new Error(`Unexpected request to ${String(url)}`);
    return new Response(JSON.stringify(next.body), {
      status: next.status ?? 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  return { fetch: fetch as typeof globalThis.fetch, calls };
}

const profile: Profile = {
  id: "8f4c9a3e-1111-4222-8333-444455556666",
  email: "alex@resources.co.za",
  full_name: "Alex Vance",
  role: "member",
  wallet_address: null,
  created_at: "2026-11-13T05:00:00.000Z",
};

describe("patela api client", () => {
  it("given an email, when a code is requested, then it posts JSON to /auth/otp/request with cookies", async () => {
    const { fetch, calls } = stubFetch([{ body: { queued: true } }]);
    const api = createPatelaApi({ baseUrl: "http://api.test/", fetch });

    await api.requestOtp("alex@resources.co.za");

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("http://api.test/auth/otp/request");
    expect(calls[0].init.method).toBe("POST");
    expect(calls[0].init.credentials).toBe("include");
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ email: "alex@resources.co.za" });
    expect(new Headers(calls[0].init.headers).get("Content-Type")).toBe("application/json");
  });

  it("returns a hosted demo code so the sign-in screen can display it", async () => {
    const { fetch } = stubFetch([{ body: { queued: true, demo: true, code: "123456" } }]);
    const api = createPatelaApi({ baseUrl: "http://api.test", fetch });

    await expect(api.requestOtp("buyer@demo.patela.local")).resolves.toEqual({
      queued: true,
      demo: true,
      code: "123456",
    });
  });

  it("given a correct code, when it is verified, then it returns the signed-in profile from /me, not the token body", async () => {
    const { fetch, calls } = stubFetch([
      { body: { accessToken: "secret-access", refreshToken: "secret-refresh" } },
      { body: profile },
    ]);
    const api = createPatelaApi({ baseUrl: "http://api.test", fetch });

    const result = await api.verifyOtp("alex@resources.co.za", "123456");

    expect(calls.map((c) => c.url)).toEqual([
      "http://api.test/auth/otp/verify",
      "http://api.test/me",
    ]);
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      email: "alex@resources.co.za",
      code: "123456",
    });
    expect(calls[1].init.credentials).toBe("include");
    expect(result).toEqual(profile);
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  it("given a Google credential, when it is exchanged, then it returns the profile the backend sends back", async () => {
    const { fetch, calls } = stubFetch([{ body: { authenticated: true, profile } }]);
    const api = createPatelaApi({ baseUrl: "http://api.test", fetch });

    const result = await api.googleSignIn("google-id-token");

    expect(calls[0].url).toBe("http://api.test/auth/google/id-token");
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ credential: "google-id-token" });
    expect(result).toEqual(profile);
  });

  it("given the backend rejects a request, when the client calls it, then it throws ApiError with the backend's message and status", async () => {
    const { fetch } = stubFetch([{ status: 401, body: { error: "Invalid or expired code" } }]);
    const api = createPatelaApi({ baseUrl: "http://api.test", fetch });

    const failure = await api.verifyOtp("alex@resources.co.za", "000000").catch((e) => e);

    expect(failure).toBeInstanceOf(ApiError);
    expect(failure.status).toBe(401);
    expect(failure.message).toBe("Invalid or expired code");
  });

  it("given the backend is unreachable, when the client calls it, then it throws an ApiError a person can read", async () => {
    const fetch = (async () => {
      throw new TypeError("Failed to fetch");
    }) as typeof globalThis.fetch;
    const api = createPatelaApi({ baseUrl: "http://api.test", fetch });

    const failure = await api.me().catch((e) => e);

    expect(failure).toBeInstanceOf(ApiError);
    expect(failure.status).toBe(0);
    expect(failure.message).toMatch(/could not reach/i);
  });

  it("given a signed-in user, when they save their name, then it PATCHes /me", async () => {
    const { fetch, calls } = stubFetch([{ body: { ...profile, full_name: "Alex V" } }]);
    const api = createPatelaApi({ baseUrl: "http://api.test", fetch });

    const result = await api.updateName("Alex V");

    expect(calls[0].url).toBe("http://api.test/me");
    expect(calls[0].init.method).toBe("PATCH");
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ fullName: "Alex V" });
    expect(result.full_name).toBe("Alex V");
  });

  it("given a wallet, when a challenge and link are requested, then they hit /wallet/challenge and /wallet/link", async () => {
    const challenge = { challengeId: "c-1", expiresAt: "x", typedData: {} };
    const { fetch, calls } = stubFetch([{ body: challenge }, { body: profile }]);
    const api = createPatelaApi({ baseUrl: "http://api.test", fetch });

    await api.walletChallenge("0xabc");
    await api.walletLink("c-1", "0xsig");

    expect(calls.map((c) => c.url)).toEqual([
      "http://api.test/wallet/challenge",
      "http://api.test/wallet/link",
    ]);
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ wallet: "0xabc" });
    expect(JSON.parse(String(calls[1].init.body))).toEqual({
      challengeId: "c-1",
      signature: "0xsig",
    });
  });
});

describe("toAuthUser", () => {
  it("given a backend profile, when it is stored for the UI, then it keeps the existing shape and marks it as a real session", () => {
    const user = toAuthUser(profile);

    expect(user).toMatchObject({
      id: profile.id,
      fullName: "Alex Vance",
      email: "alex@resources.co.za",
      role: "buyer",
      verified: true,
      source: "backend",
    });
  });

  it("given a profile without a name, when it is stored, then the name falls back to the email's local part", () => {
    expect(toAuthUser({ ...profile, full_name: null }).fullName).toBe("alex");
  });
});

describe("order api calls", () => {
  const sent = (call: Call) => ({
    url: call.url.replace("http://api.test", ""),
    method: call.init.method ?? "GET",
    body: call.init.body === undefined ? undefined : JSON.parse(String(call.init.body)),
  });

  it("given each order step, it calls the matching backend route with the right body", async () => {
    const { fetch, calls } = stubFetch(Array.from({ length: 13 }, () => ({ body: {} })));
    const api = createPatelaApi({ baseUrl: "http://api.test", fetch });
    const evidence = {
      lat: 1,
      lng: 2,
      accuracyM: 3,
      capturedAt: 1_800_000_000,
      role: "giver" as const,
    };

    await api.listOrders();
    await api.order("o1");
    await api.createOrder({ supplierEmail: "s@x.test", totalZar: "1000" });
    await api.invitation("tok");
    await api.acceptInvitation("tok", "0xabc");
    await api.linkChain("o1", "7", "0xcreate");
    await api.verifyTx("o1", "funding", "0xfund");
    await api.inviteDriver("o1", "d@x.test");
    await api.openHandoff("o1", 1, { nonce: "0xn", expiresAt: 5, giverEvidence: evidence });
    await api.handoffState("o1", 1, "s1");
    await api.submitReceiver("o1", 2, "s1", {
      receiverEvidence: { ...evidence, role: "receiver" },
      evidenceHash: "0xe",
      receiverSig: "0xr",
    });
    await api.verifyHandoff("o1", 2, "0xrel");
    await api.verifyTx("o1", "driver", "0xdrv");

    expect(calls.map(sent)).toEqual([
      { url: "/orders", method: "GET", body: undefined },
      { url: "/orders/o1", method: "GET", body: undefined },
      { url: "/orders", method: "POST", body: { supplierEmail: "s@x.test", totalZar: "1000" } },
      { url: "/invitations/tok", method: "GET", body: undefined },
      { url: "/invitations/tok/accept", method: "POST", body: { walletAddress: "0xabc" } },
      {
        url: "/orders/o1/chain",
        method: "POST",
        body: { chainOrderId: "7", createTxHash: "0xcreate" },
      },
      { url: "/orders/o1/funding/verify", method: "POST", body: { txHash: "0xfund" } },
      { url: "/orders/o1/driver-invite", method: "POST", body: { email: "d@x.test" } },
      {
        url: "/orders/o1/handoffs/1/session",
        method: "POST",
        body: { nonce: "0xn", expiresAt: 5, giverEvidence: evidence },
      },
      { url: "/orders/o1/handoffs/1/session/s1", method: "GET", body: undefined },
      {
        url: "/orders/o1/handoffs/2/session/s1/receiver",
        method: "POST",
        body: {
          receiverEvidence: { ...evidence, role: "receiver" },
          evidenceHash: "0xe",
          receiverSig: "0xr",
        },
      },
      { url: "/orders/o1/handoffs/2/verify", method: "POST", body: { txHash: "0xrel" } },
      { url: "/orders/o1/driver/verify", method: "POST", body: { txHash: "0xdrv" } },
    ]);
  });

  it("escapes ids and tokens placed in the URL", async () => {
    const { fetch, calls } = stubFetch([{ body: {} }]);
    const api = createPatelaApi({ baseUrl: "http://api.test", fetch });
    await api.invitation("a/b?c");
    expect(calls[0].url).toBe("http://api.test/invitations/a%2Fb%3Fc");
  });
});

describe("safeNextPath", () => {
  it("keeps a same-site path such as the invitation page", () => {
    expect(safeNextPath("/accept?token=abc")).toBe("/accept?token=abc");
  });

  it("falls back for anything that could leave the site", () => {
    const fallback = "/html/client-dashboard.html";
    for (const value of [null, "", "https://evil.test", "//evil.test", "/\\evil.test", "accept"]) {
      expect(safeNextPath(value)).toBe(fallback);
    }
  });
});
