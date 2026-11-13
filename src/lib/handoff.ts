import { bytesToHex, decodeErrorResult, keccak256, toBytes, type Address, type Hex } from "viem";
import { escrowAbi, handoffDomain, handoffTypes } from "@/lib/contracts";

// Pure handoff helpers: QR payload, location evidence, typed data, contract error names.
// Frozen formats: specs/INTERFACES.md §3 (evidence) and §5 (QR payload, handshake).

export const QR_PREFIX = "patela:h1:";
export const HANDOFF_TTL_SECONDS = 120;
/** Tolerated clock difference between the giver's and receiver's machines. */
const CLOCK_SKEW_SECONDS = 30;

export type Role = "giver" | "receiver";
export type Stage = 1 | 2;
export type Evidence = { lat: number; lng: number; accuracyM: number; capturedAt: number; role: Role };
export type QrPayload = {
  orderId: string;
  stage: Stage;
  sessionId: string;
  nonce: Hex;
  expiresAt: number;
  giverEvidence: Evidence;
  apiOrigin: string;
};

export type PayloadErrorCode = "wrong-prefix" | "expired" | "tampered";

export class HandoffPayloadError extends Error {
  constructor(
    readonly code: PayloadErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "HandoffPayloadError";
  }
}

const tampered = (why: string) => new HandoffPayloadError("tampered", `QR rejected: ${why}`);

const finite = (value: unknown, field: string) => {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) throw tampered(`${field} is not a number`);
  return n;
};

/**
 * Rebuilds evidence with the frozen key order and numeric values, so the hash is the same
 * whether the object came from geolocation, a QR or a JSON column that reordered keys.
 */
export function normalizeEvidence(value: unknown, role: Role): Evidence {
  if (!value || typeof value !== "object") throw tampered("missing location evidence");
  const e = value as Record<string, unknown>;
  if (e.role !== role) throw tampered(`evidence role should be ${role}`);
  return {
    lat: finite(e.lat, "lat"),
    lng: finite(e.lng, "lng"),
    accuracyM: finite(e.accuracyM, "accuracyM"),
    capturedAt: finite(e.capturedAt, "capturedAt"),
    role,
  };
}

export function computeEvidenceHash(giver: Evidence, receiver: Evidence): Hex {
  const both = [normalizeEvidence(giver, "giver"), normalizeEvidence(receiver, "receiver")];
  return keccak256(toBytes(JSON.stringify(both)));
}

export function newNonce(random: (n: number) => Uint8Array = defaultRandom): Hex {
  return bytesToHex(random(32));
}

function defaultRandom(n: number) {
  return globalThis.crypto.getRandomValues(new Uint8Array(n));
}

export const handoffExpiry = (nowSeconds: number) => nowSeconds + HANDOFF_TTL_SECONDS;

export function encodeQrPayload(p: QrPayload): string {
  const ordered: QrPayload = {
    orderId: p.orderId,
    stage: p.stage,
    sessionId: p.sessionId,
    nonce: p.nonce,
    expiresAt: p.expiresAt,
    giverEvidence: normalizeEvidence(p.giverEvidence, "giver"),
    apiOrigin: p.apiOrigin,
  };
  return QR_PREFIX + base64UrlEncode(JSON.stringify(ordered));
}

export function decodeQrPayload(text: string, nowSeconds: number): QrPayload {
  if (!text.startsWith(QR_PREFIX)) throw new HandoffPayloadError("wrong-prefix", "This is not a Patela handoff QR");
  let raw: unknown;
  try {
    raw = JSON.parse(base64UrlDecode(text.slice(QR_PREFIX.length)));
  } catch {
    throw tampered("unreadable payload");
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw tampered("unreadable payload");
  const r = raw as Record<string, unknown>;

  if (typeof r.orderId !== "string" || !r.orderId) throw tampered("missing order");
  if (r.stage !== 1 && r.stage !== 2) throw tampered("unknown stage");
  if (typeof r.sessionId !== "string" || !r.sessionId) throw tampered("missing session");
  if (typeof r.nonce !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(r.nonce)) throw tampered("bad nonce");
  if (typeof r.expiresAt !== "number" || !Number.isInteger(r.expiresAt)) throw tampered("bad expiry");
  if (typeof r.apiOrigin !== "string" || !/^https?:\/\/[^/]+$/.test(r.apiOrigin)) throw tampered("bad server");
  const giverEvidence = normalizeEvidence(r.giverEvidence, "giver");

  if (r.expiresAt > nowSeconds + HANDOFF_TTL_SECONDS + CLOCK_SKEW_SECONDS) throw tampered("expiry too far ahead");
  if (nowSeconds > r.expiresAt) throw new HandoffPayloadError("expired", "QR expired");

  return {
    orderId: r.orderId,
    stage: r.stage,
    sessionId: r.sessionId,
    nonce: r.nonce as Hex,
    expiresAt: r.expiresAt,
    giverEvidence,
    apiOrigin: r.apiOrigin,
  };
}

function base64UrlEncode(s: string) {
  let binary = "";
  for (const byte of new TextEncoder().encode(s)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(s: string) {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) throw new Error("not base64url");
  const binary = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

export type HandoffFields = {
  chainOrderId: bigint;
  stage: Stage;
  giver: Address;
  receiver: Address;
  nonce: Hex;
  expiresAt: number;
  evidenceHash: Hex;
  verifyingContract?: Address;
};

export function buildHandoffTypedData(f: HandoffFields) {
  return {
    domain: handoffDomain(f.verifyingContract),
    types: handoffTypes,
    primaryType: "Handoff" as const,
    message: {
      orderId: f.chainOrderId,
      stage: f.stage,
      giver: f.giver,
      receiver: f.receiver,
      nonce: f.nonce,
      expiresAt: BigInt(f.expiresAt),
      evidenceHash: f.evidenceHash,
    },
  };
}

export type HandoffTypedData = ReturnType<typeof buildHandoffTypedData>;

const CONTRACT_ERROR_MESSAGES: Record<string, string> = {
  NonceUsed: "QR already used",
  HandoffExpired: "QR expired",
  InvalidSignature: "Signatures don't match this handoff (wrong wallet or edited QR)",
  StageOutOfOrder: "Pickup must be completed before delivery",
  DriverNotAssigned: "No driver is assigned to this order yet",
  DriverAlreadyAssigned: "A driver is already assigned to this order",
  OrderInDispute: "This order is in dispute; handoffs are paused",
  OrderNotFunded: "The order is not funded yet",
  InvalidState: "The order is not in a state that allows this",
  NotSupplier: "Only the order's supplier wallet can do this",
  NotBuyer: "Only the order's buyer wallet can do this",
  NotAccepted: "The supplier has not accepted the order yet",
  AgreementMismatch: "The agreement doesn't match the one the buyer funded",
  SplitMismatch: "Payment split doesn't add up to the total",
  RefundTooEarly: "The refund deadline hasn't passed yet",
};

const errorName = (name: string) => CONTRACT_ERROR_MESSAGES[name] ?? name;

/** Human message for a failed wallet or contract call, naming the contract error where known. */
export function contractErrorMessage(err: unknown): string {
  if (!(err instanceof Error)) return "Something went wrong";
  const code = (err as { code?: unknown }).code;
  if (code === 4001 || /user rejected|user denied/i.test(err.message)) return "Signature request was rejected";

  const walked = (err as { walk?: (fn?: (e: unknown) => boolean) => unknown }).walk?.(
    (e) => !!(e as { data?: { errorName?: string } })?.data?.errorName,
  ) as { data?: { errorName?: string } } | undefined;
  if (walked?.data?.errorName) return errorName(walked.data.errorName);

  for (const hex of err.message.match(/0x[0-9a-fA-F]{8,}/g) ?? []) {
    try {
      return errorName(decodeErrorResult({ abi: escrowAbi, data: hex as Hex }).errorName);
    } catch {
      // not escrow revert data; keep looking
    }
  }
  for (const name of Object.keys(CONTRACT_ERROR_MESSAGES)) {
    if (new RegExp(`\\b${name}\\b`).test(err.message)) return CONTRACT_ERROR_MESSAGES[name];
  }
  return err.message || "Something went wrong";
}
