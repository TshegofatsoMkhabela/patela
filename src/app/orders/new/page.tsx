import type { Metadata } from "next";
import { NewOrderView } from "./new-order-view";

export const metadata: Metadata = {
  title: "New escrow order — Patella (testnet demo)",
  description: "Create and fund a MockZARP escrow order on Base Sepolia.",
};

export default function NewOrderPage() {
  return <NewOrderView />;
}
