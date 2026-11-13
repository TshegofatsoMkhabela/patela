import { describe, expect, it, vi } from "vitest";
import { encodeErrorResult, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { escrowAbi } from "@/lib/contracts";
import { computeEvidenceHash, decodeQrPayload, encodeQrPayload, type Evidence } from "@/lib/handoff";
import type { WalletSigner } from "@/lib/embedded-wallet";
import { readOrderParties, readWallet, runGiver, runReceiver, type FlowDeps, type FlowState } from "./handoff-flow";

const ESCROW = "0x00000000000000000000000000000000000000e5" as Address;
const API = "https://api.example.test";
const supplierKey = privateKeyToAccount(`0x${"11".repeat(32)}`);
const driverKey = privateKeyToAccount(`0x${"22".repeat(32)}`);
const buyerKey = privateKeyToAccount(`0x${"33".repeat(32)}`);
const T0 = 1_700_000_000_000; // ms

const order = {
  id: "ord-1",
  chainOrderId: "7",
  parties: {
    buyer: { walletAddress: buyerKey.address },
    supplier: { walletAddress: supplierKey.address },
    driver: { walletAddress: driverKey.address },
  },
};

function signer(key: typeof supplierKey, overrides: Partial<WalletSigner> = {}): WalletSigner {
  return {
    kind: "embedded",
    address: key.address,
    signTypedData: vi.fn((td) => key.signTypedData(td)),
    writeEscrow: vi.fn(async () => `0x${"aa".repeat(32)}` as Hex),
    waitForReceipt: vi.fn(async () => undefined),
    ...overrides,
  };
}

/** Fake backend: stores the session the giver creates, lets the receiver answer it. */
function fakeApi() {
  const sessions = new Map<string, Record<string, unknown>>();
  const calls: { method: string; path: string; body?: unknown }[] = [];
  const request = vi.fn(async (method: string, path: string, body?: unknown) => {
    calls.push({ method, path, body });
    if (method === "GET" && path === "/orders/ord-1") return order;
    let m = path.match(/^\/orders\/ord-1\/handoffs\/(\d)\/session$/);
    if (m && method === "POST") {
      sessions.set("sess-1", {});
      return { sessionId: "sess-1" };
    }
    m = path.match(/^\/orders\/ord-1\/handoffs\/\d\/session\/(sess-1)(\/receiver)?$/);
    if (m && method === "GET") return sessions.get(m[1]) ?? {};
    if (m && method === "POST" && m[2]) {
      sessions.set(m[1], body as Record<string, unknown>);
      return { ok: true };
    }
    if (/\/handoffs\/\d\/verify$/.test(path)) return order;
    throw new Error(`unexpected ${method} ${path}`);
  });
  return { request, calls, sessions };
}

function deps(over: Partial<FlowDeps> & { signer: WalletSigner }): FlowDeps & { states: FlowState[] } {
  let now = T0;
  const states: FlowState[] = [];
  return {
    api: fakeApi(),
    apiOrigin: API,
    escrow: ESCROW,
    now: () => (now += 1000),
    sleep: async () => undefined,
    random: (n) => new Uint8Array(n).fill(7),
    locate: async () => ({ lat: -26.2, lng: 28.04, accuracyM: 10 }),
    confirm: async () => undefined,
    waitForRelease: async () => ({ txHash: `0x${"bb".repeat(32)}` as Hex }),
    onState: (s) => states.push(s),
    states,
    ...over,
  };
}

describe("readOrderParties", () => {
  it("picks giver and receiver per stage", () => {
    expect(readOrderParties(order, 1)).toEqual({ chainOrderId: 7n, giver: supplierKey.address, receiver: driverKey.address });
    expect(readOrderParties(order, 2)).toEqual({ chainOrderId: 7n, giver: driverKey.address, receiver: buyerKey.address });
  });

  it("accepts snake_case backend rows and fails clearly without a driver", () => {
    const flat = { chain_order_id: "7", buyer_wallet_address: buyerKey.address, supplier_wallet_address: supplierKey.address };
    expect(() => readOrderParties(flat, 1)).toThrow(/driver/i);
    expect(readOrderParties({ ...flat, driver_wallet_address: driverKey.address }, 2).receiver).toBe(buyerKey.address);
  });
});

/** Runs giver and receiver against the same fake backend, the QR passed through as text. */
async function handshake(opts: { receiverSigner?: WalletSigner; giverSigner?: WalletSigner; tamper?: (qr: string) => string } = {}) {
  const giver = deps({ signer: opts.giverSigner ?? signer(supplierKey) });
  let qr = "";
  const receiverDone: Promise<FlowState>[] = [];
  giver.onState = (s) => {
    giver.states.push(s);
    if (s.kind === "showing-qr") {
      qr = opts.tamper ? opts.tamper(s.qr) : s.qr;
      const receiver = deps({ signer: opts.receiverSigner ?? signer(driverKey), api: giver.api });
      receiverDone.push(runReceiver(receiver, { orderId: "ord-1", stage: 1, scanned: qr }).then(() => receiver.states.at(-1)!));
    }
  };
  // The giver polls; let the receiver run between polls.
  giver.sleep = () => new Promise((r) => setTimeout(r, 0));
  await runGiver(giver, { orderId: "ord-1", stage: 1 });
  return { giver, qr, receiverFinal: await receiverDone[0] };
}

describe("giver + receiver handshake (INTERFACES §5)", () => {
  // Given supplier and driver at pickup, when the driver scans and both sign, then the giver submits
  // releaseHandoff and both screens show PAID
  it("completes a pickup and reports PAID on both sides", async () => {
    const { giver, qr, receiverFinal } = await handshake();
    const p = decodeQrPayload(qr, T0 / 1000);
    expect(p).toMatchObject({ orderId: "ord-1", stage: 1, sessionId: "sess-1", apiOrigin: API, expiresAt: T0 / 1000 + 2 + 120 });
    expect(p.nonce).toBe(`0x${"07".repeat(32)}`);

    const kinds = giver.states.map((s) => s.kind);
    expect(kinds).toEqual(["locating", "showing-qr", "ready-to-sign", "signing", "submitting", "confirming", "paid"]);
    const paid = giver.states.at(-1)!;
    expect(paid).toMatchObject({ kind: "paid", txHash: `0x${"aa".repeat(32)}` });
    expect(receiverFinal).toMatchObject({ kind: "paid", txHash: `0x${"bb".repeat(32)}` });
    expect((receiverFinal as { seconds: number }).seconds).toBeGreaterThan(0);

    const api = giver.api as ReturnType<typeof fakeApi>;
    const release = (giver.signer.writeEscrow as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(release.functionName).toBe("releaseHandoff");
    const receiverPost = api.calls.find((c) => c.path.endsWith("/receiver"))!.body as {
      receiverEvidence: Evidence;
      evidenceHash: Hex;
      receiverSig: Hex;
    };
    expect(release.args).toEqual([7n, 1, p.nonce, BigInt(p.expiresAt), receiverPost.evidenceHash, expect.any(String), receiverPost.receiverSig]);
    expect(receiverPost.evidenceHash).toBe(computeEvidenceHash(p.giverEvidence, receiverPost.receiverEvidence));
    expect(api.calls.at(-1)).toMatchObject({ method: "POST", path: "/orders/ord-1/handoffs/1/verify", body: { txHash: `0x${"aa".repeat(32)}` } });
  });

  // Given the wrong wallet on the receiving side, when it scans, then it stops before signing
  it("receiver refuses when its wallet is not the stage's receiver", async () => {
    const { giver, receiverFinal } = await handshakeWithTimeout({ receiverSigner: signer(buyerKey) });
    expect(receiverFinal).toMatchObject({ kind: "error", message: expect.stringMatching(/not the driver|receiver/i) });
    expect(giver.states.at(-1)).toMatchObject({ kind: "error", message: expect.stringMatching(/expired/i) });
  });

  // Given the receiver signed different values than the giver's (edited QR), when the giver checks, then it refuses
  it("giver refuses a receiver signature over different handoff data", async () => {
    const editNonce = (qr: string) => {
      const p = decodeQrPayload(qr, T0 / 1000);
      return encodeQrPayload({ ...p, nonce: `0x${"09".repeat(32)}` });
    };
    const { giver } = await handshake({ tamper: editNonce });
    expect(giver.states.at(-1)).toMatchObject({ kind: "error", message: expect.stringMatching(/signature/i) });
    expect(giver.signer.writeEscrow).not.toHaveBeenCalled();
  });

  // Given a reused QR, when the release reverts NonceUsed, then the giver shows "QR already used"
  it("names contract errors on release", async () => {
    const reverted = new Error(`reverted: ${encodeErrorResult({ abi: escrowAbi, errorName: "NonceUsed" })}`);
    const { giver } = await handshake({ giverSigner: signer(supplierKey, { writeEscrow: vi.fn().mockRejectedValue(reverted) }) });
    expect(giver.states.at(-1)).toEqual({ kind: "error", message: "QR already used" });
  });
});

async function handshakeWithTimeout(opts: Parameters<typeof handshake>[0]) {
  // The giver keeps polling until expiry when the receiver never answers; the clock advances 1s per call.
  return handshake(opts);
}

describe("receiver scan errors", () => {
  it.each([
    ["an old screenshot", (qr: string) => qr, T0 + 200_000, /expired/i],
    ["a non-Patela code", () => "https://example.test", T0, /not a Patela/i],
    ["a QR for another order", (qr: string) => qr.replace(/.$/, qr.endsWith("A") ? "B" : "A"), T0, /rejected|another/i],
  ])("rejects %s", async (_name, make, at, message) => {
    const p = { orderId: "ord-1", stage: 1 as const, sessionId: "sess-1", nonce: `0x${"07".repeat(32)}` as Hex,
      expiresAt: T0 / 1000 + 120, apiOrigin: API,
      giverEvidence: { lat: 1, lng: 2, accuracyM: 3, capturedAt: T0 / 1000, role: "giver" as const } };
    const d = deps({ signer: signer(driverKey), now: () => at });
    await runReceiver(d, { orderId: "ord-1", stage: 1, scanned: make(encodeQrPayload(p)) });
    expect(d.states.at(-1)).toMatchObject({ kind: "error", message: expect.stringMatching(message) });
    expect(d.signer.signTypedData).not.toHaveBeenCalled();
  });

  it("rejects a QR that points at another API server", async () => {
    const p = { orderId: "ord-1", stage: 1 as const, sessionId: "sess-1", nonce: `0x${"07".repeat(32)}` as Hex,
      expiresAt: T0 / 1000 + 120, apiOrigin: "https://evil.test",
      giverEvidence: { lat: 1, lng: 2, accuracyM: 3, capturedAt: T0 / 1000, role: "giver" as const } };
    const d = deps({ signer: signer(driverKey), now: () => T0 });
    await runReceiver(d, { orderId: "ord-1", stage: 1, scanned: encodeQrPayload(p) });
    expect(d.states.at(-1)).toMatchObject({ kind: "error", message: expect.stringMatching(/another server/i) });
  });

  it("reports a location permission failure", async () => {
    const d = deps({ signer: signer(supplierKey), locate: async () => { throw new Error("User denied Geolocation"); } });
    await runGiver(d, { orderId: "ord-1", stage: 1 });
    expect(d.states.at(-1)).toMatchObject({ kind: "error", message: expect.stringMatching(/location/i) });
  });
});

describe("readWallet", () => {
  it("Given the backend's GET /orders/:id shape (parties.<role>.wallet), Then it reads the wallet", () => {
    const order = { parties: { driver: { userId: "u", email: "d@x", wallet: "0x90f79bf6eb2c4f870365e785982e1f101e93b906" } } };
    expect(readWallet(order, "driver")).toBe("0x90F79bf6EB2c4f870365E785982E1f101E93b906");
    expect(readWallet({ parties: { driver: null } }, "driver")).toBeNull();
  });
});
