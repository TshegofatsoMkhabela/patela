import { getAddress, isAddress, recoverTypedDataAddress, type Address, type Hex } from "viem";
import type { WalletSigner } from "@/lib/embedded-wallet";
import {
  buildHandoffTypedData,
  computeEvidenceHash,
  contractErrorMessage,
  decodeQrPayload,
  encodeQrPayload,
  handoffExpiry,
  newNonce,
  normalizeEvidence,
  type Evidence,
  type Stage,
} from "@/lib/handoff";

// Giver and receiver sides of the two-round handshake (INTERFACES §5), with every side effect
// injected so the pages stay thin and the flow is unit-tested.

export type Api = { request(method: "GET" | "POST", path: string, body?: unknown): Promise<unknown> };
export type Fix = { lat: number; lng: number; accuracyM: number };

export type FlowDeps = {
  api: Api;
  apiOrigin: string;
  signer: WalletSigner;
  escrow?: Address;
  now(): number; // ms
  sleep(ms: number): Promise<void>;
  random?: (n: number) => Uint8Array;
  locate(): Promise<Fix>;
  /** Giver: resolves when the user presses "Sign to release". */
  confirm(): Promise<void>;
  /** Receiver: resolves with the release transaction once the stage is paid on-chain. */
  waitForRelease(args: { chainOrderId: bigint; stage: Stage }): Promise<{ txHash: Hex }>;
  onState(state: FlowState): void;
};

export type FlowState =
  | { kind: "locating" }
  | { kind: "showing-qr"; qr: string; expiresAt: number }
  | { kind: "ready-to-sign"; evidenceHash: Hex }
  | { kind: "signing" }
  | { kind: "submitting" }
  | { kind: "confirming"; txHash: Hex }
  | { kind: "waiting-for-release" }
  | { kind: "paid"; txHash: Hex; seconds: number }
  | { kind: "error"; message: string };

const ROLE_BY_STAGE = { 1: { giver: "supplier", receiver: "driver" }, 2: { giver: "driver", receiver: "buyer" } } as const;
const POLL_MS = 1000;

/** An error whose message is already written for the user (not a wallet or contract error). */
class FlowError extends Error {}
const message = (err: unknown) => (err instanceof FlowError ? err.message : contractErrorMessage(err));

type PartyRole = "buyer" | "supplier" | "driver";

/** A party's wallet from `GET /orders/:id` (camelCase or row shape), or null if not linked yet. */
export function readWallet(order: unknown, role: PartyRole): Address | null {
  const o = (order ?? {}) as Record<string, unknown>;
  const parties = (o.parties ?? {}) as Record<string, Record<string, unknown> | undefined>;
  const value =
    parties[role]?.walletAddress ?? parties[role]?.wallet_address ?? o[`${role}WalletAddress`] ?? o[`${role}_wallet_address`];
  return typeof value === "string" && isAddress(value) ? getAddress(value) : null;
}

export function readChainOrderId(order: unknown): bigint {
  const o = (order ?? {}) as Record<string, unknown>;
  const rawId = o.chainOrderId ?? o.chain_order_id;
  if (rawId === undefined || rawId === null || rawId === "") throw new Error("The order is not on-chain yet");
  return BigInt(rawId as string);
}

/** Chain order ID and the stage's giver/receiver wallets. */
export function readOrderParties(order: unknown, stage: Stage) {
  const roles = ROLE_BY_STAGE[stage];
  const wallet = (role: PartyRole) => {
    const address = readWallet(order, role);
    if (!address) throw new Error(`The order has no ${role} wallet yet`);
    return address;
  };
  return { chainOrderId: readChainOrderId(order), giver: wallet(roles.giver), receiver: wallet(roles.receiver) };
}

const base = (orderId: string, stage: Stage) => `/orders/${encodeURIComponent(orderId)}/handoffs/${stage}`;
const seconds = (ms: number) => Math.max(0, Math.round(ms / 100) / 10);

async function captureEvidence(d: FlowDeps, role: Evidence["role"]): Promise<Evidence> {
  let fix: Fix;
  try {
    fix = await d.locate();
  } catch (err) {
    throw new FlowError(`Location is needed for the handoff: ${err instanceof Error ? err.message : "unavailable"}`);
  }
  return normalizeEvidence({ ...fix, capturedAt: Math.floor(d.now() / 1000), role }, role);
}

function sameAddress(a: string, b: string) {
  return a.toLowerCase() === b.toLowerCase();
}

export async function runGiver(d: FlowDeps, { orderId, stage }: { orderId: string; stage: Stage }) {
  try {
    const parties = readOrderParties(await d.api.request("GET", `/orders/${encodeURIComponent(orderId)}`), stage);
    if (!sameAddress(d.signer.address, parties.giver)) {
      throw new Error(`This wallet is not the ${ROLE_BY_STAGE[stage].giver} for this order`);
    }

    d.onState({ kind: "locating" });
    const giverEvidence = await captureEvidence(d, "giver");
    const nonce = newNonce(d.random);
    const expiresAt = handoffExpiry(Math.floor(d.now() / 1000));
    const { sessionId } = (await d.api.request("POST", `${base(orderId, stage)}/session`, {
      nonce,
      expiresAt,
      giverEvidence,
    })) as { sessionId: string };

    const qr = encodeQrPayload({ orderId, stage, sessionId, nonce, expiresAt, giverEvidence, apiOrigin: d.apiOrigin });
    d.onState({ kind: "showing-qr", qr, expiresAt });

    let reply: { receiverEvidence?: unknown; evidenceHash?: Hex; receiverSig?: Hex } = {};
    while (!reply.receiverSig) {
      if (d.now() / 1000 > expiresAt) throw new Error("QR expired before it was scanned. Start a new handoff.");
      await d.sleep(POLL_MS);
      reply = (await d.api.request("GET", `${base(orderId, stage)}/session/${encodeURIComponent(sessionId)}`)) as typeof reply;
    }

    // Recompute from our own evidence rather than trusting the server's copy.
    const receiverEvidence = normalizeEvidence(reply.receiverEvidence, "receiver");
    const evidenceHash = computeEvidenceHash(giverEvidence, receiverEvidence);
    if (reply.evidenceHash?.toLowerCase() !== evidenceHash.toLowerCase()) {
      throw new Error("The receiver's location evidence doesn't match. Start a new handoff.");
    }
    const td = buildHandoffTypedData({ ...parties, stage, nonce, expiresAt, evidenceHash, verifyingContract: d.escrow });
    const receiverSigner = await recoverTypedDataAddress({ ...td, signature: reply.receiverSig }).catch(() => null);
    if (!receiverSigner || !sameAddress(receiverSigner, parties.receiver)) {
      throw new Error("The receiver's signature doesn't match this handoff (wrong wallet or edited QR)");
    }

    d.onState({ kind: "ready-to-sign", evidenceHash });
    await d.confirm();
    d.onState({ kind: "signing" });
    const giverSig = await d.signer.signTypedData(td);

    d.onState({ kind: "submitting" });
    const txHash = await d.signer.writeEscrow({
      functionName: "releaseHandoff",
      args: [parties.chainOrderId, stage, nonce, BigInt(expiresAt), evidenceHash, giverSig, reply.receiverSig],
    });
    d.onState({ kind: "confirming", txHash });
    await d.signer.waitForReceipt(txHash);
    const paidAt = d.now();
    await d.api.request("POST", `${base(orderId, stage)}/verify`, { txHash });
    d.onState({ kind: "paid", txHash, seconds: seconds(paidAt - receiverEvidence.capturedAt * 1000) });
  } catch (err) {
    d.onState({ kind: "error", message: message(err) });
  }
}

export async function runReceiver(
  d: FlowDeps,
  { orderId, stage, scanned }: { orderId: string; stage: Stage; scanned: string },
) {
  try {
    const scannedAt = d.now();
    const p = decodeQrPayload(scanned, Math.floor(scannedAt / 1000));
    if (p.apiOrigin.replace(/\/$/, "") !== d.apiOrigin.replace(/\/$/, "")) {
      throw new Error("This QR was made by another server. Scan the code on the Patela screen.");
    }
    if (p.orderId !== orderId || p.stage !== stage) throw new Error("This QR is for another order or stage");

    const parties = readOrderParties(await d.api.request("GET", `/orders/${encodeURIComponent(orderId)}`), stage);
    if (!sameAddress(d.signer.address, parties.receiver)) {
      throw new Error(`This wallet is not the ${ROLE_BY_STAGE[stage].receiver} for this order`);
    }

    d.onState({ kind: "locating" });
    const receiverEvidence = await captureEvidence(d, "receiver");
    const evidenceHash = computeEvidenceHash(p.giverEvidence, receiverEvidence);
    if (d.now() / 1000 > p.expiresAt) throw new Error("QR expired");

    d.onState({ kind: "signing" });
    const td = buildHandoffTypedData({ ...parties, stage, nonce: p.nonce, expiresAt: p.expiresAt, evidenceHash, verifyingContract: d.escrow });
    const receiverSig = await d.signer.signTypedData(td);
    await d.api.request("POST", `${base(orderId, stage)}/session/${encodeURIComponent(p.sessionId)}/receiver`, {
      receiverEvidence,
      evidenceHash,
      receiverSig,
    });

    d.onState({ kind: "waiting-for-release" });
    const { txHash } = await d.waitForRelease({ chainOrderId: parties.chainOrderId, stage });
    d.onState({ kind: "paid", txHash, seconds: seconds(d.now() - scannedAt) });
  } catch (err) {
    d.onState({ kind: "error", message: message(err) });
  }
}
