import { describe, expect, it } from "vitest";
import { parseUnits } from "viem";
import { splitTotal } from "@/lib/chain";
import { findSimilarOrder, parseSpokenOrder, SEEDED_ORDERS } from "./spoken-order";

describe("parseSpokenOrder", () => {
  it("pulls the total, refund time and split out of a spoken order", () => {
    const p = parseSpokenOrder(
      "40 office chairs from Johannesburg to Durban by Friday for 48,000 rand, refund after 3 days, driver gets 15 percent and supplier gets 35 percent at pickup",
    );
    expect(p.total).toBe("48000");
    expect(p.refundHours).toBe(72);
    expect(p.driverPct).toBe(15);
    expect(p.supplierPickupPct).toBe(35);
    expect(p.agreement).toBe("40 office chairs from Johannesburg to Durban by Friday");
  });

  it("understands R amounts and refund hours", () => {
    const p = parseSpokenOrder(
      "20 crates of tomatoes to Polokwane. Total R 1500. Refund after 48 hours.",
    );
    expect(p.total).toBe("1500");
    expect(p.refundHours).toBe(48);
    expect(p.agreement).toBe("20 crates of tomatoes to Polokwane.");
  });

  it("leaves fields it did not hear undefined", () => {
    const p = parseSpokenOrder("Ten bags of cement to Soweto by Monday");
    expect(p).toEqual({ agreement: "Ten bags of cement to Soweto by Monday" });
  });

  it("ignores a split that would not leave anything for delivery", () => {
    const p = parseSpokenOrder("driver gets 60 percent, supplier gets 50 percent at pickup");
    expect(p.driverPct).toBeUndefined();
    expect(p.supplierPickupPct).toBeUndefined();
  });
});

describe("findSimilarOrder", () => {
  const past = [
    { id: "a", label: "Order #1", text: "40 office chairs from Johannesburg to Durban by Friday" },
    { id: "b", label: "Order #2", text: "20 crates of tomatoes, Johannesburg to Polokwane" },
  ];

  it("finds the closest previous order above the threshold", () => {
    const hit = findSimilarOrder("40 office chairs Johannesburg to Durban next week", past);
    expect(hit?.order.id).toBe("a");
    expect(hit!.score).toBeGreaterThan(0.5);
  });

  it("returns nothing when no order is close", () => {
    expect(findSimilarOrder("Ten bags of cement to Soweto", past)).toBeNull();
  });

  it("ships seeded previous orders for the demo, each with full terms", () => {
    expect(SEEDED_ORDERS.length).toBeGreaterThanOrEqual(3);
    for (const s of SEEDED_ORDERS) {
      expect(s.text.length).toBeGreaterThan(20);
      expect(Number(s.total)).toBeGreaterThan(0);
      expect(s.refundHours).toBeGreaterThan(0);
    }
  });
});

describe("splitTotal with a custom split", () => {
  it("defaults to 10/40/50", () => {
    const s = splitTotal(parseUnits("100", 18));
    expect(s.driverAtPickup).toBe(parseUnits("10", 18));
  });

  it("uses the given percentages and gives delivery the rest", () => {
    const s = splitTotal(parseUnits("100", 18), { driverPct: 15, supplierPickupPct: 35 });
    expect(s.driverAtPickup).toBe(parseUnits("15", 18));
    expect(s.supplierAtPickup).toBe(parseUnits("35", 18));
    expect(s.supplierAtDelivery).toBe(parseUnits("50", 18));
  });
});
