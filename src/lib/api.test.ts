import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, api, apiOrigin } from "./api";

type Call = { url: string; init: RequestInit };

let calls: Call[];
let nextResponse: { status: number; body: unknown };

beforeEach(() => {
  calls = [];
  nextResponse = { status: 200, body: {} };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify(nextResponse.body), {
        status: nextResponse.status,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

const last = () => calls[calls.length - 1];
const bodyOf = (c: Call) => JSON.parse(String(c.init.body));

describe("api client", () => {
  it("Given any call, When it is sent, Then it targets the API origin with the session cookie", async () => {
    await api.me();
    expect(last().url).toBe(`${apiOrigin()}/me`);
    expect(last().init.credentials).toBe("include");
    expect(last().init.method).toBe("GET");
  });

  it("Given an email, When requesting a code, Then it POSTs JSON { email }", async () => {
    await api.requestOtp("buyer@example.com");
    expect(last().url).toBe(`${apiOrigin()}/auth/otp/request`);
    expect(last().init.method).toBe("POST");
    expect(new Headers(last().init.headers).get("Content-Type")).toBe("application/json");
    expect(bodyOf(last())).toEqual({ email: "buyer@example.com" });
  });

  it("Given an email and code, When verifying, Then it POSTs { email, code }", async () => {
    await api.verifyOtp("buyer@example.com", "123456");
    expect(last().url).toBe(`${apiOrigin()}/auth/otp/verify`);
    expect(bodyOf(last())).toEqual({ email: "buyer@example.com", code: "123456" });
  });

  it("Given a wallet, When linking, Then challenge sends { wallet } and link sends { challengeId, signature }", async () => {
    await api.walletChallenge("0x1111111111111111111111111111111111111111");
    expect(last().url).toBe(`${apiOrigin()}/wallet/challenge`);
    expect(bodyOf(last())).toEqual({ wallet: "0x1111111111111111111111111111111111111111" });
    await api.walletLink("c-1", "0xabcd");
    expect(last().url).toBe(`${apiOrigin()}/wallet/link`);
    expect(bodyOf(last())).toEqual({ challengeId: "c-1", signature: "0xabcd" });
  });

  it("Given an order form, When creating, Then it POSTs the §4 body to /orders", async () => {
    nextResponse.body = { id: "o-1", agreementHash: "0x" + "ab".repeat(32), refundDeadline: 1_900_000_000 };
    const input = {
      supplierEmail: "s@example.com",
      totalZarp: "100",
      driverAtPickupZarp: "10",
      supplierAtPickupZarp: "40",
      supplierAtDeliveryZarp: "50",
      refundAfterHours: 72,
      agreementText: "100 bags of maize",
    };
    const created = await api.createOrder(input);
    expect(last().url).toBe(`${apiOrigin()}/orders`);
    expect(bodyOf(last())).toEqual(input);
    expect(created.id).toBe("o-1");
  });

  it("Given a bigint chain order id, When recording it, Then it is sent as a decimal string", async () => {
    await api.recordChainOrder("o-1", { chainOrderId: 12345678901234567890n, createTxHash: "0xaa" });
    expect(last().url).toBe(`${apiOrigin()}/orders/o-1/chain`);
    expect(bodyOf(last())).toEqual({ chainOrderId: "12345678901234567890", createTxHash: "0xaa" });
  });

  it("Given a fund tx hash, When verifying funding, Then it POSTs { txHash }", async () => {
    await api.verifyFunding("o-1", "0xbb");
    expect(last().url).toBe(`${apiOrigin()}/orders/o-1/funding/verify`);
    expect(bodyOf(last())).toEqual({ txHash: "0xbb" });
  });

  it("Given an order id with unsafe characters, When fetching it, Then the id is URL-encoded", async () => {
    await api.getOrder("a/b");
    expect(last().url).toBe(`${apiOrigin()}/orders/a%2Fb`);
    expect(last().init.method).toBe("GET");
  });

  it("Given an { error } body with 4xx, When called, Then it throws ApiError with status and message", async () => {
    nextResponse = { status: 401, body: { error: "Invalid or expired session" } };
    const err = await api.me().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(401);
    expect((err as ApiError).message).toBe("Invalid or expired session");
  });

  it("Given a 5xx without a JSON body, When called, Then it throws ApiError with a generic message", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("oops", { status: 502 })));
    const err = await api.me().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(502);
    expect((err as ApiError).message).toMatch(/502/);
  });

  it("Given the network is down, When called, Then it throws ApiError with status 0", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    const err = await api.me().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(0);
  });
});
