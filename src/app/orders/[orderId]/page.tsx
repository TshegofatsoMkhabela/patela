import type { Metadata } from "next";
import { OrderView } from "./order-view";

export const metadata: Metadata = {
  title: "Order — Patela",
  description: "Track the order, its escrow balance, and the next handoff.",
  robots: { index: false },
};

export default async function OrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return <OrderView orderId={orderId} />;
}
