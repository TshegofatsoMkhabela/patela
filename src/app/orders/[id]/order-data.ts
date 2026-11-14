// GET /orders/:id is "order + parties + timeline + balances" (INTERFACES §4) without frozen field
// names, so these readers accept the likely shapes and degrade to "unknown" instead of throwing.
import type { OrderDetail, PartyInfo } from "@/lib/api";
import type { PartyAddresses } from "@/components/BalancePanel";

const str = (v: unknown) => (typeof v === "string" && v ? v : null);
const walletOf = (p?: PartyInfo) => str(p?.wallet) ?? str(p?.walletAddress);

export function partyAddresses(order: OrderDetail, escrow: string): PartyAddresses {
  const p = order.parties ?? {};
  return {
    buyer: walletOf(p.buyer) ?? str(order.buyer_wallet),
    supplier: walletOf(p.supplier) ?? str(order.supplier_wallet),
    driver: walletOf(p.driver) ?? str(order.driver_wallet),
    escrow,
  };
}

export type TimelineItem = { label: string; at?: string; txHash?: string };

export function timelineItems(order: OrderDetail): TimelineItem[] {
  return (order.timeline ?? []).map((t) => ({
    label: t.label ?? t.event ?? t.status ?? "Update",
    at: t.at,
    txHash: t.txHash,
  }));
}

/** The backend ends a fully paid order at "delivered" (orders.ts); older shapes used completed/paid. */
export const isPaid = (order: OrderDetail) =>
  /^(completed|paid|delivered)$/i.test(order.status ?? "");
