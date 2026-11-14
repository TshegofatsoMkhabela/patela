import { describe, expect, it } from "vitest";
import {
  badgeFor,
  buyerView,
  chooseMapMode,
  completeAction,
  progressUpdates,
  pickFocus,
  positionAt,
  progressAt,
  seedShipments,
  type BuyerState,
  type Shipment,
} from "@/lib/buyer-shipments";

const HOUR = 3_600_000;
// Midday local time, so "today" never straddles midnight in any timezone the tests run in.
const NOW = new Date(2026, 10, 13, 12, 0).getTime();

function ship(over: Partial<Shipment>): Shipment {
  return {
    id: "SH-0000",
    cargo: "Test cargo",
    from: "A",
    to: "B",
    road: "N1",
    near: "Somewhere",
    supplier: "Supplier",
    driver: "Driver Name",
    routeId: "n1-cpt-jhb",
    departedAt: NOW - 10 * HOUR,
    plannedEtaAt: NOW + 30 * HOUR,
    etaAt: NOW + 30 * HOUR,
    pendingAction: null,
    actionNote: "",
    delivered: false,
    ...over,
  };
}

describe("buyer dashboard: which shipment is shown big", () => {
  it("shows the shipment waiting on the buyer first, then a delayed one, then the soonest arrival", () => {
    const review = ship({
      id: "REVIEW",
      pendingAction: "review-handoff",
      etaAt: NOW + 40 * HOUR,
      plannedEtaAt: NOW + 40 * HOUR,
    });
    const delayed = ship({ id: "DELAYED", plannedEtaAt: NOW + 20 * HOUR, etaAt: NOW + 23 * HOUR });
    const soon = ship({ id: "SOON", etaAt: NOW + 2 * HOUR, plannedEtaAt: NOW + 2 * HOUR });
    const later = ship({ id: "LATER", etaAt: NOW + 50 * HOUR, plannedEtaAt: NOW + 50 * HOUR });

    expect(pickFocus([later, soon, delayed, review])?.id).toBe("REVIEW");
    expect(pickFocus([later, soon, delayed])?.id).toBe("DELAYED");
    expect(pickFocus([later, soon])?.id).toBe("SOON");
    expect(pickFocus([ship({ id: "DONE", delivered: true }), later])?.id).toBe("LATER");
    expect(pickFocus([])).toBeNull();
  });
});

describe("buyer dashboard: status badges", () => {
  it("labels needs-review, delayed by whole hours, arriving today and delivered, and gives on-track shipments no badge", () => {
    expect(badgeFor(ship({ pendingAction: "review-handoff" }), NOW)).toEqual({
      label: "Needs review",
      tone: "review",
    });
    expect(badgeFor(ship({ plannedEtaAt: NOW + 20 * HOUR, etaAt: NOW + 23 * HOUR }), NOW)).toEqual({
      label: "Delayed 3 h",
      tone: "delay",
    });
    expect(badgeFor(ship({ etaAt: NOW + 4 * HOUR, plannedEtaAt: NOW + 4 * HOUR }), NOW)).toEqual({
      label: "Arriving today",
      tone: "today",
    });
    expect(badgeFor(ship({ delivered: true }), NOW)).toEqual({ label: "Delivered", tone: "done" });
    expect(badgeFor(ship({}), NOW)).toBeNull();
  });
});

describe("buyer dashboard: taking an action on a shipment", () => {
  it("marks the shipment delivered, removes the action, puts the entry on top of a 10-item feed, and ignores a second press", () => {
    const chairs = ship({
      id: "SH-2038",
      pendingAction: "confirm-delivery",
      etaAt: NOW + 4 * HOUR,
      plannedEtaAt: NOW + 4 * HOUR,
    });
    const old = Array.from({ length: 10 }, (_, i) => ({
      id: `a${i}`,
      text: `old ${i}`,
      at: NOW - (i + 1) * HOUR,
      tone: "info" as const,
    }));
    const before: BuyerState = { shipments: [chairs], activity: old };

    const after = completeAction(before, "SH-2038", NOW);
    const confirmed = after.shipments[0];
    expect(confirmed.delivered).toBe(true);
    expect(confirmed.pendingAction).toBeNull();
    expect(after.activity[0].text).toBe("Delivery confirmed for SH-2038");
    expect(after.activity).toHaveLength(10);
    expect(after.activity.map((a) => a.text)).not.toContain("old 9");

    expect(completeAction(after, "SH-2038", NOW + 1000)).toBe(after);
  });
});

describe("buyer dashboard: saved actions survive a reload", () => {
  it("replays completed actions onto freshly seeded shipments and ignores repeats and unknown ids", () => {
    const view = buyerView(NOW, [
      { id: "SH-2038", at: NOW - 60_000 },
      { id: "SH-2038", at: NOW - 30_000 },
      { id: "NOPE", at: NOW },
    ]);
    const chairs = view.shipments.find((s) => s.id === "SH-2038")!;
    expect(chairs.delivered).toBe(true);
    expect(chairs.lastDone).toBe("confirm-delivery");
    expect(view.activity.filter((a) => a.text === "Delivery confirmed for SH-2038")).toHaveLength(
      1,
    );
    expect(
      progressAt(
        view.shipments.find((s) => s.id === "SH-2041")!,
        NOW,
      ),
    ).toBeGreaterThan(0);
  });
});

describe("buyer dashboard: where the truck is", () => {
  const path: [number, number][] = [
    [0, 0],
    [0, 1],
    [0, 2],
  ];

  it("is halfway along the route halfway through the trip, at the start before departure and never past the destination", () => {
    const s = ship({
      departedAt: NOW - 5 * HOUR,
      etaAt: NOW + 5 * HOUR,
      plannedEtaAt: NOW + 5 * HOUR,
    });
    expect(progressAt(s, NOW)).toBeCloseTo(0.5);
    expect(positionAt(path, 0.5)[1]).toBeCloseTo(1);
    expect(progressAt(s, NOW - 6 * HOUR)).toBe(0);
    expect(positionAt(path, progressAt(s, NOW - 6 * HOUR))).toEqual([0, 0]);
    expect(progressAt(s, NOW + 99 * HOUR)).toBe(1);
    expect(positionAt(path, progressAt(s, NOW + 99 * HOUR))).toEqual([0, 2]);
  });

  it("seeds every undelivered demo shipment partway along its route at the moment the page loads", () => {
    for (const s of seedShipments(NOW).filter((x) => !x.delivered)) {
      const p = progressAt(s, NOW);
      expect(p).toBeGreaterThan(0);
      expect(p).toBeLessThan(1);
    }
  });
});

describe("buyer dashboard: journey progress updates", () => {
  it("summarises the completed, current and upcoming parts of the route", () => {
    const shipment = ship({
      from: "Pretoria",
      to: "Polokwane",
      near: "Mokopane",
      road: "N1",
      departedAt: NOW - 3 * HOUR,
      etaAt: NOW + 1 * HOUR,
    });

    expect(progressUpdates(shipment, NOW)).toEqual([
      { label: "Left Pretoria", meta: "On the road", state: "done" },
      { label: "Near Mokopane · N1", meta: "75% of route complete", state: "current" },
      { label: "Arrive Polokwane", meta: "Next", state: "upcoming" },
    ]);
  });
});

describe("buyer dashboard: which map to show", () => {
  it("shows 3D only with WebGL2 and a vector map, the flat map otherwise, and nothing when there is no key or Maps fails", () => {
    const ok = { hasKey: true, loadFailed: false, webgl2: true, renderingType: "VECTOR" as const };
    expect(chooseMapMode(ok)).toBe("3d");
    expect(chooseMapMode({ ...ok, webgl2: false })).toBe("flat");
    expect(chooseMapMode({ ...ok, renderingType: "RASTER" })).toBe("flat");
    expect(chooseMapMode({ ...ok, hasKey: false })).toBe("none");
    expect(chooseMapMode({ ...ok, loadFailed: true })).toBe("none");
  });
});
