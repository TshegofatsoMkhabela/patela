"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BalancePanel, formatZarp } from "@/components/BalancePanel";
import { DemoShell, PageHeader } from "@/components/demo/DemoShell";
import { ApiError, api, type OrderDetail } from "@/lib/api";
import { ESCROW_ADDRESS } from "@/lib/contracts";
import { NETWORK, NETWORK_LABEL, explorerTxUrl } from "@/lib/chain";
import { isPaid, partyAddresses } from "./order-data";

const ORDER_POLL_MS = 3000;

// Backend order statuses in the order they happen (backend/src/orders.ts OrderStatus).
const STATUS_ORDER = [
  "awaiting_supplier",
  "awaiting_chain",
  "awaiting_funding",
  "funded",
  "accepted",
  "driver_assigned",
  "in_progress",
  "delivered",
];

type ChainEvent = { event?: string; stage?: number | string; txHash?: string; observedAt?: string };

// Each custody step: the status rank that marks it done, and the chain event that proves it.
const STEPS = [
  { title: "Order created on-chain", doneAt: "funded", event: "OrderCreated" },
  { title: "Escrow funded", doneAt: "funded", event: "EscrowFunded" },
  { title: "Supplier accepted the agreement", doneAt: "accepted", event: "OrderAccepted" },
  { title: "Driver assigned", doneAt: "driver_assigned", event: "DriverAssigned" },
  {
    title: "Pickup handoff · supplier → driver",
    doneAt: "in_progress",
    event: "PaymentReleased",
    stage: 1,
  },
  {
    title: "Delivery handoff · driver → buyer",
    doneAt: "delivered",
    event: "PaymentReleased",
    stage: 2,
  },
] as const;

const STATUS_LABEL: Record<string, string> = {
  awaiting_supplier: "Waiting for supplier",
  awaiting_chain: "Ready to put on-chain",
  awaiting_funding: "Waiting for funding",
  funded: "Funded",
  accepted: "Supplier accepted",
  driver_assigned: "Driver assigned",
  in_progress: "In transit · pickup paid",
  delivered: "Delivered · all paid",
  refunded: "Refunded",
};

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const zar = (wei: unknown) => {
  try {
    return `R ${formatZarp(BigInt(String(wei)))}`;
  } catch {
    return "—";
  }
};

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
  const rank = STATUS_ORDER.indexOf(order?.status ?? "");
  const events = (order?.timeline ?? []) as ChainEvent[];
  const txFor = (event: string, stage?: number) =>
    events.find((e) => e.event === event && (stage === undefined || Number(e.stage) === stage))
      ?.txHash;
  const steps = STEPS.map((s) => {
    const done = rank >= STATUS_ORDER.indexOf(s.doneAt);
    return { ...s, done, txHash: txFor(s.event, "stage" in s ? s.stage : undefined) };
  });
  const nextIndex = steps.findIndex((s) => !s.done);
  const pickupPaid = rank >= STATUS_ORDER.indexOf("in_progress");
  const deliveryPaid = rank >= STATUS_ORDER.indexOf("delivered");
  const nextHandoff =
    order?.status === "driver_assigned"
      ? "pickup"
      : order?.status === "in_progress"
        ? "delivery"
        : null;
  const handoffHref = (stage: string) => `/handoff/${encodeURIComponent(id)}/${stage}`;

  return (
    <DemoShell>
      <Link href="/buyer" className="dm-back">
        ← Back to overview
      </Link>

      <PageHeader
        eyebrow={`Order ${order?.chainOrderId ? `#${order.chainOrderId}` : ""} · ${NETWORK.name}`}
        title={order?.agreementText ? String(order.agreementText).slice(0, 60) : "Order"}
        actions={
          <>
            <a className="bd-pill" href="#trail">
              View audit trail
            </a>
            {nextHandoff ? (
              <Link className="bd-btn" href={handoffHref(nextHandoff)}>
                Open {nextHandoff} handoff
              </Link>
            ) : null}
          </>
        }
      >
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
          <span className="bd-soft">
            {order?.parties?.supplier?.email ?? order?.supplierEmail ?? "Supplier"} →{" "}
            {order?.parties?.buyer?.email ?? "you"}
          </span>
          <span className={order && isPaid(order) ? "dm-badge dm-badge--ok" : "dm-badge"}>
            {STATUS_LABEL[order?.status ?? ""] ?? order?.status ?? "Loading…"}
          </span>
        </div>
      </PageHeader>

      {error?.status === 401 ? (
        <p role="alert" className="dm-note">
          Sign in to see this order.{" "}
          <Link href={`/signin?next=/orders/${encodeURIComponent(id)}`}>Sign in</Link>
        </p>
      ) : error ? (
        <p role="alert" className="dm-msg dm-msg--err">
          Couldn&apos;t load the order: {error.message}
        </p>
      ) : null}

      <div className="dm-row">
        <section id="trail" aria-labelledby="custody-title" className="dm-card dm-wide">
          <h2 id="custody-title" className="bd-h2">
            Who has it, step by step
          </h2>
          <ol className="dm-steps">
            {steps.map((s, i) => {
              const now = i === nextIndex;
              return (
                <li key={s.title}>
                  <div className="dm-rail" aria-hidden>
                    <span
                      className={
                        s.done ? "dm-dot dm-dot--done" : now ? "dm-dot dm-dot--now" : "dm-dot"
                      }
                    >
                      {s.done ? "✓" : ""}
                    </span>
                    {i < steps.length - 1 ? (
                      <span className={s.done ? "dm-line dm-line--done" : "dm-line"} />
                    ) : null}
                  </div>
                  <div className="dm-step-body">
                    <span className="dm-step-title">
                      {s.title}
                      {s.txHash ? (
                        <span className="dm-badge dm-badge--chain">Verified on-chain</span>
                      ) : null}
                      {now ? <span className="dm-badge dm-badge--ok">Next</span> : null}
                    </span>
                    {s.txHash ? (
                      explorerTxUrl(s.txHash) ? (
                        <a
                          className="dm-mono bd-soft"
                          href={explorerTxUrl(s.txHash)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {short(s.txHash)} ↗
                        </a>
                      ) : (
                        <span className="dm-mono bd-muted">{short(s.txHash)}</span>
                      )
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <section aria-labelledby="money-title" className="dm-card dm-narrow">
          <h2 id="money-title" className="bd-h2">
            Your money
          </h2>
          <div className="bd-stack-6">
            <span className="bd-label">Held in escrow</span>
            <span className="dm-figure dm-figure--xl">{zar(order?.totalWei)}</span>
          </div>
          <ul className="dm-money">
            <li>
              <span>
                <span>Driver, at pickup</span>
                <span className={pickupPaid ? "bd-small dm-msg" : "bd-small bd-muted"}>
                  {pickupPaid ? "Paid" : "Released at pickup"}
                </span>
              </span>
              <span className="bd-nums">{zar(order?.driverAtPickupWei)}</span>
            </li>
            <li>
              <span>
                <span>Supplier, at pickup</span>
                <span className={pickupPaid ? "bd-small dm-msg" : "bd-small bd-muted"}>
                  {pickupPaid ? "Paid" : "Released at pickup"}
                </span>
              </span>
              <span className="bd-nums">{zar(order?.supplierAtPickupWei)}</span>
            </li>
            <li>
              <span>
                <span>Supplier, at delivery</span>
                <span className={deliveryPaid ? "bd-small dm-msg" : "bd-small bd-muted"}>
                  {deliveryPaid ? "Paid" : "Released when you confirm"}
                </span>
              </span>
              <span className="bd-nums">{zar(order?.supplierAtDeliveryWei)}</span>
            </li>
          </ul>
          <p className="dm-note">
            {NETWORK_LABEL}, so no real money moves. If the goods never arrive you can take back
            anything unpaid after the refund deadline.
          </p>
          <div className="dm-btns">
            <Link className="dm-btn-ghost" href={handoffHref("pickup")}>
              Pickup handoff
            </Link>
            <Link className="dm-btn-ghost" href={handoffHref("delivery")}>
              Delivery handoff
            </Link>
          </div>
        </section>
      </div>

      <div className="dm-row">
        <section aria-labelledby="agreement-title" className="dm-card dm-wide">
          <h2 id="agreement-title" className="bd-h2">
            The agreement
          </h2>
          <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{order?.agreementText ?? "…"}</p>
          {order?.agreementHash ? (
            <div className="bd-stack-6">
              <span className="bd-label">Fingerprint on-chain</span>
              <span className="dm-mono bd-muted">{order.agreementHash}</span>
            </div>
          ) : null}
        </section>
        <section className="dm-card dm-narrow" aria-label="Live balances">
          <BalancePanel addresses={addresses} />
        </section>
      </div>

      {NETWORK.local ? (
        <p className="bd-small bd-muted">
          Demo: <Link href="/demo-inbox">demo inbox (codes and accept links)</Link>
        </p>
      ) : null}
    </DemoShell>
  );
}
