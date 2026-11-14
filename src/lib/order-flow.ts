// What each person on an order should do next, worked out from the backend's order view
// (backend/src/orders.ts render()). Pure, so the order page and its tests share one source of truth.
import type { Stage } from "@/lib/handoff";
import { ApiError } from "@/lib/patela-api";

export type OrderStatus =
  | "awaiting_supplier"
  | "awaiting_chain"
  | "awaiting_funding"
  | "funded"
  | "accepted"
  | "driver_assigned"
  | "in_progress"
  | "delivered"
  | "refunded";

export type Party = "buyer" | "supplier" | "driver";
export const STATUS_LABEL: Record<OrderStatus, string> = {
  awaiting_supplier: "Waiting for supplier",
  awaiting_chain: "Ready to put on Celo",
  awaiting_funding: "Waiting for funding",
  funded: "Funded",
  accepted: "Accepted by supplier",
  driver_assigned: "Driver assigned",
  in_progress: "In transit",
  delivered: "Delivered",
  refunded: "Refunded",
};

export type OrderParty = { userId: string | null; email?: string | null; wallet: string | null };

export type OrderView = {
  id: string;
  status: OrderStatus;
  chainOrderId: string | null;
  tokenAddress: string;
  escrowAddress: string;
  totalWei: string;
  driverAtPickupWei: string;
  supplierAtPickupWei: string;
  supplierAtDeliveryWei: string;
  agreementText: string | null;
  agreementHash: string;
  refundDeadline: string;
  parties: Record<Party, OrderParty | null>;
  timeline: Array<{ event: string; stage?: number | null; amountWei?: string; txHash?: string }>;
  balances: Record<"buyer" | "supplier" | "driver" | "escrow", string | null> | null;
  disputes: Array<{ status: string }>;
};

export type NextStep =
  | { kind: "create" | "fund" | "accept" | "invite-driver" | "assign-driver"; role: Party }
  | { kind: "show-qr" | "scan-qr"; role: Party; stage: Stage }
  | { kind: "wait"; role: Party | null; waitingFor: string }
  | { kind: "paused" | "done"; role: Party | null };

/** Who hands the goods over (shows the QR) and who receives them (scans it), per stage. */
export const STAGE_PARTIES = {
  1: { giver: "supplier", receiver: "driver" },
  2: { giver: "driver", receiver: "buyer" },
} as const satisfies Record<Stage, { giver: Party; receiver: Party }>;

/** The handoff stage that is next for an order in this status, if any. */
const STAGE_FOR: Partial<Record<OrderStatus, Stage>> = { driver_assigned: 1, in_progress: 2 };

/** Which party the signed-in user is on this order, if any. */
function roleOf(order: OrderView, userId: string): Party | null {
  for (const party of ["buyer", "supplier", "driver"] as const) {
    if (order.parties[party]?.userId === userId) return party;
  }
  return null;
}

export function nextStep(order: OrderView, userId: string): NextStep {
  const role = roleOf(order, userId);
  const wait = (waitingFor: string): NextStep => ({ kind: "wait", role, waitingFor });
  if (order.status === "delivered" || order.status === "refunded") return { kind: "done", role };
  if (order.disputes.some((d) => d.status === "open")) return { kind: "paused", role };
  if (!role) return wait("the people on this order");

  switch (order.status) {
    case "awaiting_supplier":
      return wait("the supplier to accept the email invitation");
    case "awaiting_chain":
      return role === "buyer"
        ? { kind: "create", role }
        : wait("the buyer to put the order on Celo");
    case "awaiting_funding":
      return role === "buyer" ? { kind: "fund", role } : wait("the buyer to fund the escrow");
    case "funded":
      return role === "supplier"
        ? { kind: "accept", role }
        : wait("the supplier to accept on Celo");
    case "accepted":
      if (role !== "supplier") return wait("the supplier to assign a driver");
      return { kind: order.parties.driver ? "assign-driver" : "invite-driver", role };
    case "driver_assigned":
    case "in_progress": {
      const stage = STAGE_FOR[order.status]!;
      const { giver, receiver } = STAGE_PARTIES[stage];
      if (role === giver) return { kind: "show-qr", role, stage };
      if (role === receiver) return { kind: "scan-qr", role, stage };
      return wait(
        `the ${stage === 1 ? "pickup" : "delivery"} handoff between ${giver} and ${receiver}`,
      );
    }
  }
}

const isUnconfirmed = (error: unknown) =>
  error instanceof ApiError && /not sufficiently confirmed/i.test(error.message);

/**
 * The backend only accepts a transaction once it has enough confirmations, so right after the
 * wallet reports it mined, verification can briefly say "not sufficiently confirmed". Retry that
 * one answer; any other error is real and stops at once.
 */
export async function verifyUntilConfirmed<T>(
  verify: () => Promise<T>,
  { attempts = 10, delayMs = 3000 }: { attempts?: number; delayMs?: number } = {},
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await verify();
    } catch (error) {
      if (!isUnconfirmed(error) || attempt >= attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

const RAND = /^\d+(\.\d{1,2})?$/;
const cents = (zar: string) => {
  const [whole, part = ""] = zar.split(".");
  return BigInt(whole) * 100n + BigInt(part.padEnd(2, "0"));
};
const rand = (c: bigint) => `${c / 100n}.${(c % 100n).toString().padStart(2, "0")}`;

/** The default 10 / 40 / 50 split of a rand total, in whole cents that add up exactly. */
export function suggestedSplit(totalZar: string) {
  if (!RAND.test(totalZar)) return null;
  const total = cents(totalZar);
  if (total <= 0n) return null;
  const driver = (total * 10n + 50n) / 100n;
  const supplier = (total * 40n + 50n) / 100n;
  return {
    driverAtPickupZar: rand(driver),
    supplierAtPickupZar: rand(supplier),
    supplierAtDeliveryZar: rand(total - driver - supplier),
  };
}
