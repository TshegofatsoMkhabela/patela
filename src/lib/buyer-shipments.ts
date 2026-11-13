/**
 * Buyer dashboard demo shipments (AGENTS.md: demo data, labelled as demo in the UI).
 * Pure functions only, so the rules are testable without a browser; the store wires them in.
 */

export type ShipmentAction = "review-handoff" | "confirm-delivery" | "approve-milestone";

export interface Shipment {
  id: string;
  cargo: string;
  from: string;
  to: string;
  road: string;
  near: string;
  supplier: string;
  driver: string;
  /** Route geometry file under public/buyer/routes/<routeId>.json */
  routeId: string;
  departedAt: number;
  plannedEtaAt: number;
  etaAt: number;
  pendingAction: ShipmentAction | null;
  actionNote: string;
  delivered: boolean;
  /** The action the buyer last completed on this shipment, for the "done" note. */
  lastDone?: ShipmentAction;
}

export type ActivityTone = "review" | "delay" | "done" | "info";
export interface Activity {
  id: string;
  text: string;
  at: number;
  tone: ActivityTone;
}

export interface BuyerState {
  shipments: Shipment[];
  activity: Activity[];
}

export type BadgeTone = "review" | "delay" | "today" | "done";
export type MapMode = "3d" | "flat" | "none";

const HOUR = 3_600_000;
const FEED_LIMIT = 10;

const delayHours = (s: Shipment) => Math.round((s.etaAt - s.plannedEtaAt) / HOUR);
const isDelayed = (s: Shipment) => delayHours(s) >= 1;
const byEta = (a: Shipment, b: Shipment) => a.etaAt - b.etaAt;

/** The shipment shown big: one waiting on the buyer, else a delayed one, else the soonest arrival. */
export function pickFocus(shipments: Shipment[]): Shipment | null {
  const active = shipments.filter((s) => !s.delivered).sort(byEta);
  return active.find((s) => s.pendingAction) ?? active.find(isDelayed) ?? active[0] ?? null;
}

/** Same calendar day in the viewer's local time. */
export const sameDay = (a: number, b: number) =>
  new Date(a).toDateString() === new Date(b).toDateString();

export function badgeFor(s: Shipment, now: number): { label: string; tone: BadgeTone } | null {
  if (s.delivered) return { label: "Delivered", tone: "done" };
  if (s.pendingAction === "review-handoff") return { label: "Needs review", tone: "review" };
  if (isDelayed(s)) return { label: `Delayed ${delayHours(s)} h`, tone: "delay" };
  if (sameDay(s.etaAt, now)) return { label: "Arriving today", tone: "today" };
  return null;
}

export const ACTION_LABEL: Record<ShipmentAction, string> = {
  "review-handoff": "Review handoff",
  "confirm-delivery": "Confirm delivery",
  "approve-milestone": "Approve milestone",
};

/** Past-tense label for a completed action ("Delivery confirmed"). */
export const DONE_LABEL: Record<ShipmentAction, string> = {
  "review-handoff": "Handoff reviewed",
  "confirm-delivery": "Delivery confirmed",
  "approve-milestone": "Milestone approved",
};

/** Apply the shipment's pending action. Returns the same state object when there is nothing to do. */
export function completeAction<T extends BuyerState>(state: T, id: string, now: number): T {
  const target = state.shipments.find((s) => s.id === id);
  const action = target?.pendingAction;
  if (!target || !action) return state;
  const updated: Shipment = {
    ...target,
    pendingAction: null,
    lastDone: action,
    delivered: target.delivered || action === "confirm-delivery",
  };
  const note = action === "approve-milestone" ? " (demo, no money moved)" : "";
  const entry: Activity = {
    id: `${id}-${action}-${now}`,
    text: `${DONE_LABEL[action]} for ${id}${note}`,
    at: now,
    tone: "done",
  };
  return {
    ...state,
    shipments: state.shipments.map((s) => (s.id === id ? updated : s)),
    activity: [entry, ...state.activity].slice(0, FEED_LIMIT),
  };
}

/** The buyer's demo view: shipments seeded at `anchor`, with the completed actions replayed on top. */
export function buyerView(anchor: number, completed: { id: string; at: number }[]): BuyerState {
  const seeded: BuyerState = { shipments: seedShipments(anchor), activity: seedActivity(anchor) };
  return completed.reduce((state, c) => completeAction(state, c.id, c.at), seeded);
}

/** Share of the trip done at `now`, clamped to 0..1. */
export function progressAt(s: Shipment, now: number): number {
  const span = s.etaAt - s.departedAt;
  if (span <= 0) return 1;
  return Math.min(1, Math.max(0, (now - s.departedAt) / span));
}

export type LngLat = [number, number];

const toRad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in metres. */
export function metres(a: LngLat, b: LngLat) {
  const s =
    Math.sin(toRad(b[1] - a[1]) / 2) ** 2 +
    Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(toRad(b[0] - a[0]) / 2) ** 2;
  return 2 * 6371008.8 * Math.asin(Math.sqrt(s));
}

/** Compass bearing from a to b, 0..360. */
export function bearing(a: LngLat, b: LngLat) {
  const y = Math.sin(toRad(b[0] - a[0])) * Math.cos(toRad(b[1]));
  const x =
    Math.cos(toRad(a[1])) * Math.sin(toRad(b[1])) -
    Math.sin(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.cos(toRad(b[0] - a[0]));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** A path with its cumulative distances, built once so lookups are O(log n) with no allocation. */
export interface Route {
  path: LngLat[];
  cum: Float64Array;
  length: number;
}

export function makeRoute(path: LngLat[]): Route {
  if (path.length === 0) throw new Error("empty path");
  const cum = new Float64Array(path.length);
  for (let i = 1; i < path.length; i++) cum[i] = cum[i - 1] + metres(path[i - 1], path[i]);
  return { path, cum, length: cum[path.length - 1] };
}

/** Point at `fraction` (0..1, clamped) of the route's length. */
export function pointAt(route: Route, fraction: number): LngLat {
  const { path, cum, length } = route;
  const d = Math.min(1, Math.max(0, fraction)) * length;
  let lo = 0;
  let hi = path.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= d) lo = mid;
    else hi = mid;
  }
  const span = cum[hi] - cum[lo];
  if (span <= 0) return path[hi];
  const t = (d - cum[lo]) / span;
  return [
    path[lo][0] + (path[hi][0] - path[lo][0]) * t,
    path[lo][1] + (path[hi][1] - path[lo][1]) * t,
  ];
}

/** Road heading at `fraction`, read across ±`window` metres so single kinks don't twitch it. */
export function headingAt(route: Route, fraction: number, window = 60) {
  const w = window / Math.max(route.length, 1);
  return bearing(pointAt(route, fraction - w), pointAt(route, fraction + w));
}

/** Point at `fraction` of a path's length (convenience; build a Route once for repeated lookups). */
export const positionAt = (path: LngLat[], fraction: number): LngLat =>
  pointAt(makeRoute(path), fraction);

// A plain two-argument helper, not a closure over `anchor`: Next 15.5.29's minifier inlined such a
// closure and left `anchor` unbound in the server bundle ("anchor is not defined" at build).
// Re-check after a Next upgrade; the closure form is fine if the build passes.
const hoursFrom = (anchor: number, h: number) => anchor + h * HOUR;

/** Demo shipments timed relative to `anchor` (first page load), so every truck is mid-route. */
export function seedShipments(anchor: number): Shipment[] {
  return [
    {
      id: "SH-2041",
      cargo: "Packaged snacks · 18 pallets",
      from: "Cape Town",
      to: "Johannesburg",
      road: "N1",
      near: "Beaufort West",
      supplier: "Karoo Snacks (Pty) Ltd",
      driver: "Sipho Dlamini",
      routeId: "n1-cpt-jhb",
      departedAt: hoursFrom(anchor, -9),
      plannedEtaAt: hoursFrom(anchor, 26),
      etaAt: hoursFrom(anchor, 26),
      pendingAction: "review-handoff",
      actionNote:
        "Karoo Depot uploaded seal photos and a weighbridge slip at the Beaufort West handoff.",
      delivered: false,
    },
    {
      id: "SH-2038",
      cargo: "Office chairs · 40 units",
      from: "Johannesburg",
      to: "Durban",
      road: "N3",
      near: "Pinetown",
      supplier: "Seatwell Furniture",
      driver: "Thandi Nkosi",
      routeId: "n3-jhb-dbn",
      departedAt: hoursFrom(anchor, -5.5),
      plannedEtaAt: hoursFrom(anchor, 1),
      etaAt: hoursFrom(anchor, 1),
      pendingAction: "confirm-delivery",
      actionNote:
        "Confirm once the chairs are at your Durban store. This moves the order to Delivered.",
      delivered: false,
    },
    {
      id: "SH-2045",
      cargo: "Kitchen appliances · 12 crates",
      from: "Pretoria",
      to: "Polokwane",
      road: "N1",
      near: "Mokopane",
      supplier: "Highveld Appliances",
      driver: "Pieter van Wyk",
      routeId: "n1-pta-plk",
      departedAt: hoursFrom(anchor, -2.5),
      plannedEtaAt: hoursFrom(anchor, 1.5),
      etaAt: hoursFrom(anchor, 4.5),
      pendingAction: null,
      actionNote: "Roadworks on the N1 near Mokopane. Nothing needs you yet.",
      delivered: false,
    },
    {
      id: "SH-2049",
      cargo: "Cleaning supplies · 6 pallets",
      from: "Germiston",
      to: "Midrand",
      road: "R21",
      near: "Kempton Park",
      supplier: "CleanPro Distributors",
      driver: "Lerato Mokoena",
      routeId: "r21-ger-mid",
      departedAt: hoursFrom(anchor, -0.5),
      plannedEtaAt: hoursFrom(anchor, 0.7),
      etaAt: hoursFrom(anchor, 0.7),
      pendingAction: null,
      actionNote: "On track. Nothing needs you on this shipment.",
      delivered: false,
    },
  ];
}

export function seedActivity(anchor: number): Activity[] {
  return [
    {
      id: "seed-1",
      text: "Karoo Depot took over SH-2041 from Kwena Freight at Beaufort West",
      at: hoursFrom(anchor, -0.5),
      tone: "review",
    },
    {
      id: "seed-2",
      text: "SH-2045 delayed 3 h by roadworks near Mokopane",
      at: hoursFrom(anchor, -1.5),
      tone: "delay",
    },
    { id: "seed-3", text: "Waybill uploaded for SH-2038", at: hoursFrom(anchor, -5), tone: "info" },
    {
      id: "seed-4",
      text: "Milestone approved for SH-2033 (demo, no money moved)",
      at: hoursFrom(anchor, -20),
      tone: "done",
    },
  ];
}

/** The map mode to start in, before the map reports its rendering type. */
export const initialMapMode = (hasKey: boolean): MapMode =>
  chooseMapMode({ hasKey, loadFailed: false, webgl2: true, renderingType: null });

export function chooseMapMode(env: {
  hasKey: boolean;
  loadFailed: boolean;
  webgl2: boolean;
  renderingType: "VECTOR" | "RASTER" | "UNINITIALIZED" | null;
}): MapMode {
  if (!env.hasKey || env.loadFailed) return "none";
  if (!env.webgl2 || env.renderingType === "RASTER") return "flat";
  return "3d";
}
