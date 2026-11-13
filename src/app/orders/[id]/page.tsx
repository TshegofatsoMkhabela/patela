import type { Metadata } from "next";
import { OrderView } from "./order-view";

export const metadata: Metadata = {
  title: "Order — Patella (testnet demo)",
  description: "Escrow order timeline and live four-wallet balances.",
};

// Next 15: params is a Promise.
export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrderView id={id} />;
}
