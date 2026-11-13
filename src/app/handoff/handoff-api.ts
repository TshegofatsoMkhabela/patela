import { createPublicClient, http, parseAbiItem, type Hex } from "viem";
import { baseSepolia } from "viem/chains";
import { ESCROW_ADDRESS } from "@/lib/contracts";
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

const handoffVerified = parseAbiItem(
  "event HandoffVerified(uint256 indexed orderId, uint8 stage, address indexed giver, address indexed receiver, bytes32 evidenceHash)",
);

/** Polls the escrow's HandoffVerified events for this order and stage (receiver side). */
export async function waitForReleaseOnChain({ chainOrderId, stage }: { chainOrderId: bigint; stage: number }) {
  const client = createPublicClient({ chain: baseSepolia, transport: http(process.env.NEXT_PUBLIC_RPC_URL || undefined) });
  const fromBlock = (await client.getBlockNumber()) - 50n;
  for (;;) {
    const logs = await client.getLogs({ address: ESCROW_ADDRESS, event: handoffVerified, args: { orderId: chainOrderId }, fromBlock });
    const hit = logs.find((log) => Number(log.args.stage) === stage);
    if (hit?.transactionHash) return { txHash: hit.transactionHash as Hex };
    await new Promise((r) => setTimeout(r, 1500));
  }
}
