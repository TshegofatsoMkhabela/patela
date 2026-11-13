import { describe, expect, it } from "vitest";
import { keccak256, recoverTypedDataAddress, toBytes, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { encodeErrorResult } from "viem";
import { escrowAbi, handoffTypes } from "@/lib/contracts";
import {
  HANDOFF_TTL_SECONDS,
  HandoffPayloadError,
  QR_PREFIX,
  buildHandoffTypedData,
  computeEvidenceHash,
  contractErrorMessage,
  decodeQrPayload,
  encodeQrPayload,
  handoffExpiry,
  newNonce,
  normalizeEvidence,
  type Evidence,
  type QrPayload,
} from "@/lib/handoff";

const giverEvidence: Evidence = { lat: -26.2041, lng: 28.0473, accuracyM: 12, capturedAt: 1_700_000_000, role: "giver" };
const receiverEvidence: Evidence = { lat: -26.2042, lng: 28.0474, accuracyM: 20, capturedAt: 1_700_000_030, role: "receiver" };
const NOW = 1_700_000_000;
const ESCROW = "0x00000000000000000000000000000000000000e5" as Address;

const payload = (overrides: Partial<QrPayload> = {}): QrPayload => ({
  orderId: "ord-1",
  stage: 1,
  sessionId: "sess-1",
  nonce: `0x${"ab".repeat(32)}` as Hex,
  expiresAt: NOW + 120,
  giverEvidence,
  apiOrigin: "https://api.example.test",
  ...overrides,
});

const b64url = (s: string) => Buffer.from(s, "utf8").toString("base64url");

describe("evidenceHash (INTERFACES §3)", () => {
  // Given both evidence objects, when hashed, then it is keccak256 of the JSON array, giver first
  it("hashes JSON.stringify([giver, receiver]) with keys in the frozen order", () => {
    const expectedJson =
      '[{"lat":-26.2041,"lng":28.0473,"accuracyM":12,"capturedAt":1700000000,"role":"giver"},' +
      '{"lat":-26.2042,"lng":28.0474,"accuracyM":20,"capturedAt":1700000030,"role":"receiver"}]';
    expect(computeEvidenceHash(giverEvidence, receiverEvidence)).toBe(keccak256(toBytes(expectedJson)));
  });

  // Given evidence that came back from the API with keys reordered or numbers as strings,
  // when hashed, then the result matches the original
  it("is stable when evidence comes back from the API reordered or stringified", () => {
    const reordered = { role: "receiver", capturedAt: "1700000030", accuracyM: 20, lng: 28.0474, lat: -26.2042, extra: 1 };
    expect(computeEvidenceHash(giverEvidence, normalizeEvidence(reordered, "receiver"))).toBe(
      computeEvidenceHash(giverEvidence, receiverEvidence),
    );
  });

  it("rejects evidence with the wrong role or a non-finite coordinate", () => {
    expect(() => normalizeEvidence(giverEvidence, "receiver")).toThrow(HandoffPayloadError);
    expect(() => normalizeEvidence({ ...giverEvidence, lat: "abc" }, "giver")).toThrow(HandoffPayloadError);
    expect(() => normalizeEvidence(null, "giver")).toThrow(HandoffPayloadError);
  });
});

describe("nonce and expiry (INTERFACES §5.1)", () => {
  it("creates a 32-byte hex nonce from the random source", () => {
    const nonce = newNonce((n) => new Uint8Array(n).fill(1));
    expect(nonce).toBe(`0x${"01".repeat(32)}`);
    expect(newNonce()).toMatch(/^0x[0-9a-f]{64}$/);
    expect(newNonce()).not.toBe(newNonce());
  });

  it("expires 120 seconds from now", () => {
    expect(HANDOFF_TTL_SECONDS).toBe(120);
    expect(handoffExpiry(NOW)).toBe(NOW + 120);
  });
});

describe("QR payload (INTERFACES §5.2)", () => {
  // Given a payload, when encoded, then it is patela:h1: + base64url(JSON) and decodes back
  it("round-trips through patela:h1: + base64url JSON", () => {
    const text = encodeQrPayload(payload());
    expect(text.startsWith(QR_PREFIX)).toBe(true);
    expect(QR_PREFIX).toBe("patela:h1:");
    const json = JSON.parse(Buffer.from(text.slice(QR_PREFIX.length), "base64url").toString("utf8"));
    expect(Object.keys(json)).toEqual(["orderId", "stage", "sessionId", "nonce", "expiresAt", "giverEvidence", "apiOrigin"]);
    expect(decodeQrPayload(text, NOW)).toEqual(payload());
  });

  it("uses url-safe base64 without padding", () => {
    expect(encodeQrPayload(payload()).slice(QR_PREFIX.length)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  // Given a QR from something other than Patela, when scanned, then it is rejected as wrong prefix
  it("rejects a wrong prefix", () => {
    expect(() => decodeQrPayload("https://evil.test/x", NOW)).toThrow(expect.objectContaining({ code: "wrong-prefix" }));
    expect(() => decodeQrPayload("patela:h2:" + b64url("{}"), NOW)).toThrow(
      expect.objectContaining({ code: "wrong-prefix" }),
    );
  });

  // Given a screenshot older than 2 minutes, when scanned, then it is rejected as expired
  it("rejects an expired payload", () => {
    const text = encodeQrPayload(payload());
    expect(() => decodeQrPayload(text, NOW + 121)).toThrow(expect.objectContaining({ code: "expired" }));
    expect(decodeQrPayload(text, NOW + 120).nonce).toBe(payload().nonce);
  });

  // Given an edited or corrupted QR, when scanned, then it is rejected as tampered
  it.each([
    ["not base64 JSON", QR_PREFIX + "%%%"],
    ["JSON array", QR_PREFIX + b64url("[]")],
    ["short nonce", encodeRaw({ ...payload(), nonce: "0x1234" })],
    ["stage 3", encodeRaw({ ...payload(), stage: 3 })],
    ["giver evidence marked receiver", encodeRaw({ ...payload(), giverEvidence: receiverEvidence })],
    ["missing sessionId", encodeRaw({ ...payload(), sessionId: "" })],
    ["non-http apiOrigin", encodeRaw({ ...payload(), apiOrigin: "javascript:alert(1)" })],
    ["expiry too far ahead", encodeRaw({ ...payload(), expiresAt: NOW + 3600 })],
  ])("rejects a tampered payload (%s)", (_name, text) => {
    expect(() => decodeQrPayload(text, NOW)).toThrow(expect.objectContaining({ code: "tampered" }));
  });
});

function encodeRaw(obj: unknown) {
  return QR_PREFIX + b64url(JSON.stringify(obj));
}

describe("typed data (INTERFACES §2)", () => {
  const giverKey = privateKeyToAccount(`0x${"11".repeat(32)}`);
  const receiverKey = privateKeyToAccount(`0x${"22".repeat(32)}`);

  it("builds the Handoff typed data with the shared domain and types", async () => {
    const evidenceHash = computeEvidenceHash(giverEvidence, receiverEvidence);
    const td = buildHandoffTypedData({
      chainOrderId: 7n,
      stage: 1,
      giver: giverKey.address,
      receiver: receiverKey.address,
      nonce: payload().nonce,
      expiresAt: NOW + 120,
      evidenceHash,
      verifyingContract: ESCROW,
    });
    expect(td.primaryType).toBe("Handoff");
    expect(td.types).toBe(handoffTypes);
    expect(td.domain).toEqual({ name: "Patela Escrow", version: "1", chainId: 84532, verifyingContract: ESCROW });
    expect(td.message).toEqual({
      orderId: 7n,
      stage: 1,
      giver: giverKey.address,
      receiver: receiverKey.address,
      nonce: payload().nonce,
      expiresAt: BigInt(NOW + 120),
      evidenceHash,
    });
    const sig = await receiverKey.signTypedData(td);
    expect(await recoverTypedDataAddress({ ...td, signature: sig })).toBe(receiverKey.address);
  });
});

describe("contract error mapping", () => {
  const data = (errorName: "NonceUsed" | "HandoffExpired" | "InvalidSignature") =>
    encodeErrorResult({ abi: escrowAbi, errorName });

  it("names known errors from a viem error carrying data.errorName", () => {
    const err = Object.assign(new Error("reverted"), {
      walk: () => ({ data: { errorName: "NonceUsed" } }),
    });
    expect(contractErrorMessage(err)).toBe("QR already used");
  });

  // Bundler errors only carry revert data as hex inside the message text
  it("decodes revert data embedded in a bundler error message", () => {
    expect(contractErrorMessage(new Error(`UserOperation reverted during simulation with reason: ${data("HandoffExpired")}`))).toBe(
      "QR expired",
    );
    expect(contractErrorMessage(new Error(`execution reverted (data="${data("InvalidSignature")}")`))).toMatch(
      /signature/i,
    );
  });

  it("maps a bare error name in the message", () => {
    expect(contractErrorMessage(new Error('The contract function "releaseHandoff" reverted. Error: StageOutOfOrder()'))).toMatch(
      /pickup/i,
    );
  });

  it("passes through user rejection and unknown errors readably", () => {
    expect(contractErrorMessage(Object.assign(new Error("User rejected the request."), { code: 4001 }))).toBe(
      "Signature request was rejected",
    );
    expect(contractErrorMessage(new Error("network down"))).toBe("network down");
    expect(contractErrorMessage("weird")).toBe("Something went wrong");
  });

  it("names every frozen contract error", () => {
    const names = escrowAbi.filter((item) => item.type === "error").map((item) => item.name);
    for (const name of names) {
      const msg = contractErrorMessage(new Error(encodeErrorResult({ abi: escrowAbi, errorName: name as never })));
      expect(msg, name).not.toMatch(/^0x/);
      expect(msg, name).not.toBe("Something went wrong");
    }
  });
});
