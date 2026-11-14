import { describe, expect, it } from "vitest";
import { isPaid, partyAddresses, timelineItems } from "./order-data";

const ESCROW = "0xE5c0000000000000000000000000000000000001";

describe("partyAddresses", () => {
  it("Given parties with wallet or walletAddress fields, Then picks them and adds the escrow", () => {
    const out = partyAddresses(
      {
        id: "o",
        parties: {
          buyer: { wallet: "0xb0b" },
          supplier: { walletAddress: "0x505" },
          driver: { wallet: null },
        },
      },
      ESCROW,
    );
    expect(out).toEqual({ buyer: "0xb0b", supplier: "0x505", driver: null, escrow: ESCROW });
  });

  it("Given flat *_wallet columns and no parties, Then falls back to them", () => {
    const out = partyAddresses(
      { id: "o", buyer_wallet: "0x1", supplier_wallet: "0x2", driver_wallet: "0x3" },
      ESCROW,
    );
    expect(out).toEqual({ buyer: "0x1", supplier: "0x2", driver: "0x3", escrow: ESCROW });
  });

  it("Given nothing known, Then every party is null but escrow is set", () => {
    expect(partyAddresses({ id: "o" }, ESCROW)).toEqual({
      buyer: null,
      supplier: null,
      driver: null,
      escrow: ESCROW,
    });
  });
});

describe("timelineItems", () => {
  it("Given mixed timeline entries, Then each gets a label and optional time / tx", () => {
    expect(
      timelineItems({
        id: "o",
        timeline: [
          { event: "EscrowFunded", at: "2026-11-13T10:00:00Z", txHash: "0xabc" },
          { label: "Supplier invited" },
        ],
      }),
    ).toEqual([
      { label: "EscrowFunded", at: "2026-11-13T10:00:00Z", txHash: "0xabc" },
      { label: "Supplier invited", at: undefined, txHash: undefined },
    ]);
    expect(timelineItems({ id: "o" })).toEqual([]);
  });
});

describe("isPaid", () => {
  it("Given a completed status, Then the order is paid", () => {
    expect(isPaid({ id: "o", status: "completed" })).toBe(true);
    expect(isPaid({ id: "o", status: "PAID" })).toBe(true);
    expect(isPaid({ id: "o", status: "funded" })).toBe(false);
  });
});
