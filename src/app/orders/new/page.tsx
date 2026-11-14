import type { Metadata } from "next";
import { NewOrderView } from "./new-order-view";

export const metadata: Metadata = {
  title: "New order — Patela",
  description: "Agree the terms, invite the supplier, and lock the payment in escrow on Celo.",
};

export default function NewOrderPage() {
  return <NewOrderView />;
}
