"use client";

import { useEffect, useMemo, useState } from "react";
import { actions, usePatela } from "@/lib/patela-store";
import { buyerView, pickFocus } from "@/lib/buyer-shipments";
import { FocusedShipment } from "./FocusedShipment";
import { ShipmentList } from "./ShipmentList";
import { ActivityFeed } from "./ActivityFeed";

// Demo shipment times are anchored to this page load (this module only runs in the browser).
const PAGE_LOADED_AT = Date.now();
const NONE: { id: string; at: number }[] = [];

export default function BuyerDashboard() {
  const completed = usePatela().buyerCompleted ?? NONE;
  const { shipments, activity } = useMemo(() => buyerView(PAGE_LOADED_AT, completed), [completed]);
  const [now, setNow] = useState(() => Date.now());
  const [picked, setPicked] = useState<string | null>(null);
  const [trackerFulfilled] = useState(
    () =>
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("trackerFulfilled") === "PT-0412",
  );

  // Labels ("Today", "12 min ago", progress) refresh twice a minute; the map animates on its own.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const focus = shipments.find((s) => s.id === picked) ?? pickFocus(shipments);
  const active = shipments.filter((s) => !s.delivered).length;

  function act(id: string) {
    if (!shipments.find((s) => s.id === id)?.pendingAction) return;
    actions.completeShipmentAction(id);
    // Keep it in focus so the buyer sees the confirmation (a delivered shipment would otherwise drop out).
    setPicked(id);
  }

  if (trackerFulfilled) {
    return (
      <>
        <header className="bd-header">
          <div className="bd-stack-8">
            <span className="bd-label">Shipment PT-0412 · Demo delivery complete</span>
            <h1 className="bd-h1">Order fulfilled</h1>
          </div>
        </header>
        <section className="bd-fulfillment" role="status" aria-live="polite">
          <span className="bd-label">Final delivery verified</span>
          <h2>Blockchain has released funds</h2>
          <p>Cape Town → Worcester → Beaufort West</p>
          <div className="bd-fulfillment-details">
            <span>2 of 2 stops verified</span>
            <span>Shipment PT-0412 fulfilled</span>
          </div>
          <p className="bd-fulfillment-note">
            Demo confirmation. This simulated tracker does not submit an on-chain transfer.
          </p>
          <a className="bd-btn" href="/tracker">
            Replay route
          </a>
        </section>
      </>
    );
  }

  return (
    <>
      <header className="bd-header">
        <div className="bd-stack-8">
          <span className="bd-label">
            {active} {active === 1 ? "shipment" : "shipments"} on the move · Demo
          </span>
          <h1 className="bd-h1">Where your goods are</h1>
        </div>
        <div className="bd-header-side">
          <span className="bd-small bd-muted">Updated just now</span>
          <a className="bd-pill" href="/orders/new">
            New order
          </a>
        </div>
      </header>

      {focus ? (
        <FocusedShipment shipment={focus} now={now} onAction={act} />
      ) : (
        <section className="bd-card bd-empty">
          <strong className="bd-strong">Nothing on the road yet</strong>
          <span className="bd-muted">
            When a supplier dispatches your order, you&apos;ll see where it is here, live.
          </span>
          <a className="bd-btn" href="/orders/new">
            Create an order
          </a>
        </section>
      )}

      <div className="bd-lower">
        <ShipmentList
          shipments={shipments}
          focusId={focus?.id ?? null}
          now={now}
          onPick={setPicked}
        />
        <ActivityFeed activity={activity} now={now} />
      </div>

      <p className="bd-footnote">
        Demo data. Truck model “Low Poly Truck” by{" "}
        <a href="https://sketchfab.com/Arifido._" target="_blank" rel="noopener noreferrer">
          Arifido._
        </a>{" "}
        (
        <a
          href="http://creativecommons.org/licenses/by/4.0/"
          target="_blank"
          rel="noopener noreferrer"
        >
          CC BY 4.0
        </a>
        ). Map: Google Maps. Routes: © OpenStreetMap contributors via OSRM.
      </p>
    </>
  );
}
