import type { Metadata } from "next";
import { NewOrderView } from "./new-order-view";

export const metadata: Metadata = {
  title: "New escrow order — Patella",
  description: "Create and fund a Mento ZARm escrow order on Celo.",
};

export default function NewOrderPage() {
  return <NewOrderView />;
}
