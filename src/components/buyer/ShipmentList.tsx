import { badgeFor, type Shipment } from "@/lib/buyer-shipments";
import { StatusBadge } from "./StatusBadge";
import { formatEtaShort } from "./format";

export function ShipmentList({
  shipments,
  focusId,
  now,
  onPick,
}: {
  shipments: Shipment[];
  focusId: string | null;
  now: number;
  onPick: (id: string) => void;
}) {
  return (
    <section className="bd-card bd-list" aria-labelledby="bd-list-title">
      <h2 id="bd-list-title" className="bd-h2">
        Your shipments
      </h2>
      {shipments.map((s) => (
        <button
          key={s.id}
          type="button"
          className="bd-row"
          aria-pressed={s.id === focusId}
          onClick={() => onPick(s.id)}
        >
          <span className="bd-row-main">
            <span className="bd-row-title">{s.cargo}</span>
            <span className="bd-muted bd-small">
              {s.from} → {s.to} · {s.id}
            </span>
          </span>
          <span className="bd-row-side">
            <StatusBadge badge={badgeFor(s, now)} />
            <span className="bd-small bd-soft bd-nums">{formatEtaShort(s.etaAt, now)}</span>
          </span>
        </button>
      ))}
    </section>
  );
}
