"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { errorMessage, OrderPage, useSession, zar } from "@/components/orders/order-ui";
import { STATUS_LABEL } from "@/lib/order-flow";
import { patelaApi, type OrderSummary } from "@/lib/patela-api";

export function OrdersView() {
  const session = useSession();
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session.profile) return;
    patelaApi.listOrders().then(
      (r) => setOrders(r.orders),
      (e) => setError(errorMessage(e)),
    );
  }, [session.profile]);

  return (
    <OrderPage eyebrow="Orders" title="Paid at each handoff." session={session} needsWallet={false}>
      <p>
        <Link className="pt-btn" href="/orders/new">
          New order
        </Link>
      </p>
      {error && <p className="pt-order-error">{error}</p>}
      {orders && orders.length === 0 && <p className="pt-lead">No orders yet.</p>}
      {orders && orders.length > 0 && (
        <ul className="pt-order-list">
          {orders.map((o) => (
            <li key={o.id} className="pt-card">
              <Link href={`/orders/${o.id}`}>
                <strong>{zar(o.totalWei)}</strong> · {STATUS_LABEL[o.status]} ·{" "}
                {new Date(o.createdAt).toLocaleDateString("en-ZA")}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </OrderPage>
  );
}
