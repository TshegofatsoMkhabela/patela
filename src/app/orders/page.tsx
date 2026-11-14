import type { Metadata } from "next";
import { OrdersView } from "./orders-view";

export const metadata: Metadata = {
  title: "Orders — Patela",
  description: "Your escrow orders: who has the goods, what has been paid, and what happens next.",
};

export default function OrdersPage() {
  return <OrdersView />;
}
