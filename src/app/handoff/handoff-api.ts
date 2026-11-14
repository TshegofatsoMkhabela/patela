import type { Hex } from "viem";
import { ApiError, apiOrigin } from "@/lib/api";
import { ESCROW_ADDRESS, escrowAbi } from "@/lib/contracts";
import { createReadClient } from "@/lib/chain";
import type { Api, Fix } from "./handoff-flow";

// Browser adapters for the handoff and accept pages. src/lib/api.ts covers only the buyer's routes and
// keeps its request() private, so the handoff routes use this small fetch helper with the same origin
// and the same ApiError (status 0 when the server can't be reached).

export const API_ORIGIN = apiOrigin();

export const browserApi: Api = {
  async request(method, path, body) {
    let res: Response;
    try {
      res = await fetch(`${API_ORIGIN}${path}`, {
        method,
        credentials: "include",
        headers: body === undefined ? undefined : { "content-type": "application/json" },
        // uint256 values go over the API as decimal strings.
        body:
          body === undefined
            ? undefined
            : JSON.stringify(body, (_k, v) => (typeof v === "bigint" ? v.toString() : v)),
      });
    } catch {
      throw new ApiError("Could not reach the Patela API. Check your connection.", 0);
    }
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw new ApiError(data.error || `Request failed (${res.status})`, res.status);
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

/** Local demo fallback when both handoff parties are using the same laptop. */
export const DEMO_FIX: Fix = { lat: -26.2041, lng: 28.0473, accuracyM: 999 };
export const locateOrDemo = (localDemo: boolean) => (): Promise<Fix> =>
  localDemo ? browserLocate().catch(() => DEMO_FIX) : browserLocate();

const RELEASE_POLL_MS = 2000;

/** Polls the escrow's HandoffVerified events for this order and stage (receiver side), until found or
 * `current()` turns false (the page retried or unmounted). */
export async function waitForReleaseOnChain({
  chainOrderId,
  stage,
  current = () => true,
}: {
  chainOrderId: bigint;
  stage: number;
  current?: () => boolean;
}) {
  const client = createReadClient();
  // Start a little back in case the giver released while this side was still signing.
  let fromBlock = (await client.getBlockNumber()) - 50n;
  while (current()) {
    const toBlock = await client.getBlockNumber();
    if (toBlock >= fromBlock) {
      const events = await client.getContractEvents({
        address: ESCROW_ADDRESS,
        abi: escrowAbi,
        eventName: "HandoffVerified",
        args: { orderId: chainOrderId },
        fromBlock,
        toBlock,
      });
      const hit = events.find((e) => Number(e.args.stage) === stage);
      if (hit?.transactionHash) return { txHash: hit.transactionHash as Hex };
      fromBlock = toBlock + 1n;
    }
    await new Promise((r) => setTimeout(r, RELEASE_POLL_MS));
  }
  throw new Error("cancelled");
}
