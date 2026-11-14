"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import {
  ACTION_LABEL,
  DONE_LABEL,
  badgeFor,
  initialMapMode,
  progressAt,
  progressUpdates,
  type Shipment,
} from "@/lib/buyer-shipments";
import { StatusBadge } from "./StatusBadge";
import { formatEta } from "./format";
import { Icon } from "./Icon";

// deck.gl + Google Maps load after the details card, in the browser only.
const ShipmentMap = dynamic(() => import("./ShipmentMap"), { ssr: false });

function ProgressUpdates({
  shipment,
  now,
  overlay = false,
}: {
  shipment: Shipment;
  now: number;
  overlay?: boolean;
}) {
  const updates = progressUpdates(shipment, now);
  return (
    <section
      className={
        overlay
          ? "bd-progress-updates bd-map-progress"
          : "bd-progress-updates bd-progress-updates--detail"
      }
      aria-label="Journey progress updates"
    >
      <span className="bd-label">Progress updates</span>
      <ol>
        {updates.map((update) => (
          <li key={update.label} className={`bd-update bd-update--${update.state}`}>
            <span className="bd-update-dot" aria-hidden="true" />
            <span>
              <strong>{update.label}</strong>
              <small>{update.meta}</small>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function FocusedShipment({
  shipment,
  now,
  onAction,
}: {
  shipment: Shipment;
  now: number;
  onAction: (id: string) => void;
}) {
  const [mode, setMode] = useState(() =>
    initialMapMode(!!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY),
  );
  const progress = Math.round(progressAt(shipment, now) * 100);
  const eta = formatEta(shipment.etaAt, now);

  return (
    <section className="bd-hero" aria-labelledby="bd-focus-title">
      <div className="bd-map">
        {mode === "none" ? (
          <div className="bd-map-none">
            <Icon d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14" size={28} />
            <strong>Map unavailable right now</strong>
            <span className="bd-muted">
              {shipment.id} arrives {eta}. Tracking still updates here.
            </span>
          </div>
        ) : (
          <>
            <ShipmentMap shipment={shipment} onModeChange={setMode} />
            <div className="bd-map-chips">
              <span className="bd-chip">
                <span className="bd-live-dot" aria-hidden="true" />
                Live
              </span>
            </div>
            <div className="bd-map-near">
              <span className="bd-small bd-muted">Now near</span>
              <span className="bd-strong">
                {shipment.near} · {shipment.road}
              </span>
            </div>
            <ProgressUpdates shipment={shipment} now={now} overlay />
          </>
        )}
      </div>

      <article className="bd-card bd-detail">
        <div className="bd-stack-6">
          <span className="bd-small bd-muted">
            {shipment.id} · {shipment.supplier}
          </span>
          <h2 id="bd-focus-title" className="bd-cargo">
            {shipment.cargo}
          </h2>
          <span className="bd-soft">
            {shipment.from} → {shipment.to}
          </span>
          <StatusBadge badge={badgeFor(shipment, now)} />
        </div>

        <div className="bd-stack-10">
          <div className="bd-eta">
            <span className="bd-label">Arrives</span>
            <span className="bd-eta-value">{eta}</span>
          </div>
          <div
            className="bd-progress"
            role="progressbar"
            aria-label="Distance covered"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <div style={{ width: `${progress}%` }} />
          </div>
          <div className="bd-progress-ends bd-small bd-muted">
            <span>{shipment.from}</span>
            <span>{shipment.to}</span>
          </div>
        </div>

        <div className="bd-driver">
          <span className="bd-driver-icon" aria-hidden="true">
            <Icon d="M12 14.2V21M9.9 11.4 3.4 9.8M14.1 11.4l6.5-1.6">
              <circle cx="12" cy="12" r="9" />
              <circle cx="12" cy="12" r="2.2" />
            </Icon>
          </span>
          <span>
            <strong className="bd-strong">{shipment.driver}</strong>{" "}
            <span className="bd-muted">– Driver</span>
          </span>
        </div>

        <ProgressUpdates shipment={shipment} now={now} />

        {shipment.pendingAction ? (
          <div className="bd-action">
            <p className="bd-soft">{shipment.actionNote}</p>
            <button type="button" className="bd-btn" onClick={() => onAction(shipment.id)}>
              {ACTION_LABEL[shipment.pendingAction]}
            </button>
          </div>
        ) : shipment.lastDone ? (
          <div className="bd-done" role="status">
            <Icon d="M5 12.5 10 17 19 7" strokeWidth={2.2} />
            {DONE_LABEL[shipment.lastDone]} · demo
          </div>
        ) : (
          <p className="bd-muted bd-quiet">
            {shipment.delivered ? "Delivered. Nothing more needed." : shipment.actionNote}
          </p>
        )}
      </article>
    </section>
  );
}
