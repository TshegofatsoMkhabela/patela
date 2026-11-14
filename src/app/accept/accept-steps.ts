import { readWallet } from "../handoff/handoff-flow";

// Where a signed-in supplier with a linked wallet picks up, from the order's status
// (backend/src/orders.ts: awaiting_chain → awaiting_funding → funded → accepted → driver_assigned → …).
// The supplier accepts the invite before the buyer calls createOrder (INTERFACES §1 step 4), so
// acceptOrder has to wait until the escrow is funded.

export type SupplierStep =
  "await-funding" | "accept" | "invite-driver" | "assign" | "done" | "closed";

export function supplierStep(order: { status?: string; parties?: unknown }): SupplierStep {
  switch (order.status) {
    case "awaiting_chain":
    case "awaiting_funding":
      return "await-funding";
    case "funded":
      return "accept";
    case "accepted":
      return readWallet(order, "driver") ? "assign" : "invite-driver";
    case "driver_assigned":
    case "in_progress":
    case "delivered":
      return "done";
    default:
      return "closed";
  }
}
