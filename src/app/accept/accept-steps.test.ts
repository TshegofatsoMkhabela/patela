import { describe, expect, it } from "vitest";
import { supplierStep } from "./accept-steps";

const DRIVER = "0x00000000000000000000000000000000000000d1";

describe("supplierStep (INTERFACES §1 steps 4–6)", () => {
  // Given the supplier accepted the invite before the buyer put the order on-chain,
  // when the order is read, then the supplier waits for funding instead of calling acceptOrder
  it.each(["awaiting_chain", "awaiting_funding"])(
    "waits for the buyer while the order is %s",
    (status) => {
      expect(supplierStep({ status })).toBe("await-funding");
    },
  );

  it("asks the supplier to accept once the escrow is funded", () => {
    expect(supplierStep({ status: "funded" })).toBe("accept");
  });

  // Given the supplier already accepted (e.g. reopened the link), then it goes straight to the driver
  it("asks for a driver after acceptance, and offers the assignment once the driver has a wallet", () => {
    expect(supplierStep({ status: "accepted", parties: { driver: null } })).toBe("invite-driver");
    expect(supplierStep({ status: "accepted", parties: { driver: { wallet: DRIVER } } })).toBe(
      "assign",
    );
  });

  it.each(["driver_assigned", "in_progress", "delivered"])(
    "is done once the order is %s",
    (status) => {
      expect(supplierStep({ status })).toBe("done");
    },
  );

  it.each(["refunded", "disputed", undefined])(
    "stops on a closed or unknown order (%s)",
    (status) => {
      expect(supplierStep({ status })).toBe("closed");
    },
  );
});
