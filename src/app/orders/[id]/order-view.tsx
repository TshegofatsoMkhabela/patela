"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SiteNav } from "@/components/SiteNav";
import { BalancePanel } from "@/components/BalancePanel";
import { ApiError, api, type OrderDetail } from "@/lib/api";
import { ESCROW_ADDRESS } from "@/lib/contracts";
import { isPaid, partyAddresses, timelineItems } from "./order-data";

const ORDER_POLL_MS = 3000;

export function OrderView({ id }: { id: string }) {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<{ message: string; status: number } | null>(null);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      try {
        const o = await api.getOrder(id);
        if (!stopped) {
          setOrder(o);
          setError(null);
        }
      } catch (err) {
        if (!stopped)
          setError({
            message: err instanceof Error ? err.message : String(err),
            status: err instanceof ApiError ? err.status : 0,
          });
      }
      if (!stopped) timer = setTimeout(load, ORDER_POLL_MS);
    };
    void load();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [id]);

  const addresses = order
    ? partyAddresses(order, ESCROW_ADDRESS)
    : { buyer: null, supplier: null, driver: null, escrow: ESCROW_ADDRESS || null };
  const items = order ? timelineItems(order) : [];

  return (
    <div className="pt-app" style={{ minHeight: "100vh" }}>
      <SiteNav />
      <main className="pt-wrap" style={{ maxWidth: 1200, padding: "32px 20px 100px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <h1 className="pt-h2" style={{ margin: 0 }}>
            Order {order?.chainOrderId ? `#${order.chainOrderId}` : ""}
          </h1>
          <span
            style={{
              fontSize: "1.3rem",
              fontWeight: 700,
              color: "#ffe2b2",
              textTransform: "uppercase",
            }}
          >
            {order?.status ?? "…"}
          </span>
        </div>

        {error?.status === 401 ? (
          <p role="alert" style={{ fontSize: "1.1rem" }}>
            Sign in to see this order.{" "}
            <Link
              href={`/signin?next=/orders/${encodeURIComponent(id)}`}
              style={{ color: "#ffe2b2", textDecoration: "underline" }}
            >
              Sign in
            </Link>
          </p>
        ) : error ? (
          <p role="alert" style={{ color: "#ff9b8a", fontSize: "1.1rem" }}>
            Couldn&apos;t load the order: {error.message}
          </p>
        ) : null}

        {order && isPaid(order) ? (
          <div
            className="pt-card"
            style={{
              textAlign: "center",
              padding: "28px",
              margin: "20px 0",
              borderTop: "6px solid #9fd6a8",
            }}
          >
            <div
              style={{
                fontSize: "clamp(3rem, 8vw, 6rem)",
                fontWeight: 900,
                color: "#9fd6a8",
                lineHeight: 1,
              }}
            >
              PAID
            </div>
            <div style={{ fontSize: "1.2rem", color: "#a2a9b8", marginTop: 8 }}>
              All stages released from escrow.
            </div>
          </div>
        ) : null}

        <div style={{ margin: "24px 0 32px" }}>
          <BalancePanel addresses={addresses} />
        </div>

        <section className="pt-card" style={{ padding: "24px 28px" }}>
          <h2 style={{ margin: "0 0 14px", fontSize: "1.5rem" }}>Timeline</h2>
          {items.length === 0 ? (
            <p style={{ margin: 0, color: "#a2a9b8", fontSize: "1.1rem" }}>
              {order ? "No events yet." : "Loading…"}
            </p>
          ) : (
            <ol
              style={{ margin: 0, paddingLeft: 22, display: "grid", gap: 12, fontSize: "1.2rem" }}
            >
              {items.map((t, i) => (
                <li key={i}>
                  <strong>{t.label}</strong>
                  {t.at ? (
                    <span style={{ color: "#a2a9b8", marginLeft: 10 }}>
                      {new Date(t.at).toLocaleTimeString()}
                    </span>
                  ) : null}
                  {t.txHash ? (
                    <a
                      href={`https://sepolia.basescan.org/tx/${t.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        marginLeft: 10,
                        color: "#ffe2b2",
                        fontFamily: "monospace",
                        fontSize: "0.95rem",
                      }}
                    >
                      {t.txHash.slice(0, 10)}…
                    </a>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </section>

        <p style={{ marginTop: 20, color: "#7c8596", fontSize: "0.9rem" }}>
          Testnet demo · MockZARP on Base Sepolia · not real money
        </p>
      </main>
    </div>
  );
}
