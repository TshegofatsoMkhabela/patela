import { createPublicClient, http, parseAbiItem, type Hex } from "viem";
import { baseSepolia, hardhat } from "viem/chains";
import { CHAIN_ID, ESCROW_ADDRESS } from "@/lib/contracts";
import type { Api, Fix } from "./handoff-flow";

// Browser adapters for the handoff and accept pages. A small local fetch helper until the shared
// src/lib/api.ts (owned by the web core branch) is merged.

export const API_ORIGIN = (process.env.NEXT_PUBLIC_API_ORIGIN ?? "").replace(/\/$/, "");

export const browserApi: Api = {
  async request(method, path, body) {
    const res = await fetch(`${API_ORIGIN}${path}`, {
      method,
      credentials: "include",
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw new Error(data.error || `${method} ${path} failed (${res.status})`);
    return data;
  },
};

export function browserLocate(): Promise<Fix> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("this browser has no location access"));
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
          accuracyM: Math.round(pos.coords.accuracy),
        }),
      (err) => reject(new Error(err.message || "location permission denied")),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  });
}

/**
 * LOCAL DEMO: when the browser can't or won't share a location (both demo windows on one laptop),
 * fall back to a fixed, clearly fake demo position instead of failing the handoff.
 */
export const DEMO_FIX: Fix = { lat: -26.2041, lng: 28.0473, accuracyM: 999 };
export const locateOrDemo = (localDemo: boolean) => (): Promise<Fix> =>
  localDemo ? browserLocate().catch(() => DEMO_FIX) : browserLocate();

const handoffVerified = parseAbiItem(
  "event HandoffVerified(uint256 indexed orderId, uint8 stage, address indexed giver, address indexed receiver, bytes32 evidenceHash)",
);

/** Polls the escrow's HandoffVerified events for this order and stage (receiver side). */
export async function waitForReleaseOnChain({ chainOrderId, stage }: { chainOrderId: bigint; stage: number }) {
  const chain = CHAIN_ID === hardhat.id ? hardhat : baseSepolia;
  const client = createPublicClient({ chain, transport: http(process.env.NEXT_PUBLIC_RPC_URL || undefined) });
  const head = await client.getBlockNumber();
  const fromBlock = head > 50n ? head - 50n : 0n; // a fresh local chain has fewer than 50 blocks
  for (;;) {
    const logs = await client.getLogs({ address: ESCROW_ADDRESS, event: handoffVerified, args: { orderId: chainOrderId }, fromBlock });
    const hit = logs.find((log) => Number(log.args.stage) === stage);
    if (hit?.transactionHash) return { txHash: hit.transactionHash as Hex };
    await new Promise((r) => setTimeout(r, 1500));
  }
}
