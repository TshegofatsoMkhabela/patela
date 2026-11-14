import { describe, expect, it } from "vitest";
import { nextStep, suggestedSplit, verifyUntilConfirmed, type OrderView } from "@/lib/order-flow";
import { ApiError } from "@/lib/patela-api";

const BUYER = "buyer-id";
const SUPPLIER = "supplier-id";
const DRIVER = "driver-id";

function order(status: OrderView["status"], over: Partial<OrderView> = {}): OrderView {
  return {
    id: "order-1",
    status,
    chainOrderId: status === "awaiting_supplier" || status === "awaiting_chain" ? null : "7",
    totalWei: "1000",
    driverAtPickupWei: "100",
    supplierAtPickupWei: "400",
    supplierAtDeliveryWei: "500",
    agreementText: "20 crates",
    agreementHash: `0x${"ab".repeat(32)}`,
    refundDeadline: "2026-11-20T00:00:00.000Z",
    escrowAddress: "0x3333333333333333333333333333333333333333",
    tokenAddress: "0x5555555555555555555555555555555555555555",
    parties: {
      buyer: {
        userId: BUYER,
        email: "b@x.test",
        wallet: "0x1111111111111111111111111111111111111111",
      },
      supplier: {
        userId: SUPPLIER,
        email: "s@x.test",
        wallet: "0x2222222222222222222222222222222222222222",
      },
      driver: null,
    },
    timeline: [],
    balances: null,
    disputes: [],
    ...over,
  };
}
const withDriver = (status: OrderView["status"]) =>
  order(status, {
    parties: {
      ...order(status).parties,
      driver: {
        userId: DRIVER,
        email: "d@x.test",
        wallet: "0x4444444444444444444444444444444444444444",
      },
    },
  });

describe("nextStep", () => {
  it("given a new order, the buyer waits for the supplier to accept the email invite", () => {
    expect(nextStep(order("awaiting_supplier"), BUYER)).toMatchObject({
      kind: "wait",
      role: "buyer",
    });
  });

  it("given the supplier joined, the buyer puts the order on Celo, then funds it", () => {
    expect(nextStep(order("awaiting_chain"), BUYER).kind).toBe("create");
    expect(nextStep(order("awaiting_funding"), BUYER).kind).toBe("fund");
    expect(nextStep(order("awaiting_funding"), SUPPLIER).kind).toBe("wait");
  });

  it("given a funded order, the supplier accepts it on chain", () => {
    expect(nextStep(order("funded"), SUPPLIER).kind).toBe("accept");
    expect(nextStep(order("funded"), BUYER).kind).toBe("wait");
  });

  it("given an accepted order, the supplier invites a driver, then assigns the driver who joined", () => {
    expect(nextStep(order("accepted"), SUPPLIER).kind).toBe("invite-driver");
    expect(nextStep(withDriver("accepted"), SUPPLIER).kind).toBe("assign-driver");
    expect(nextStep(withDriver("accepted"), DRIVER).kind).toBe("wait");
  });

  it("given a driver is assigned, the supplier shows the pickup QR and the driver scans it", () => {
    expect(nextStep(withDriver("driver_assigned"), SUPPLIER)).toMatchObject({
      kind: "show-qr",
      stage: 1,
    });
    expect(nextStep(withDriver("driver_assigned"), DRIVER)).toMatchObject({
      kind: "scan-qr",
      stage: 1,
    });
    expect(nextStep(withDriver("driver_assigned"), BUYER).kind).toBe("wait");
  });

  it("given pickup is done, the driver shows the delivery QR and the buyer scans it", () => {
    expect(nextStep(withDriver("in_progress"), DRIVER)).toMatchObject({
      kind: "show-qr",
      stage: 2,
    });
    expect(nextStep(withDriver("in_progress"), BUYER)).toMatchObject({ kind: "scan-qr", stage: 2 });
    expect(nextStep(withDriver("in_progress"), SUPPLIER).kind).toBe("wait");
  });

  it("given a delivered or refunded order, nobody has a step left", () => {
    expect(nextStep(withDriver("delivered"), SUPPLIER).kind).toBe("done");
    expect(nextStep(order("refunded"), BUYER).kind).toBe("done");
  });

  it("given an open dispute, handoffs are paused for everyone", () => {
    const disputed = withDriver("driver_assigned");
    disputed.disputes = [{ status: "open" }];
    expect(nextStep(disputed, SUPPLIER).kind).toBe("paused");
    expect(nextStep(disputed, DRIVER).kind).toBe("paused");
  });

  it("given a viewer who is not on the order, there is no step", () => {
    expect(nextStep(order("funded"), "someone-else")).toMatchObject({ kind: "wait", role: null });
  });
});

describe("verifyUntilConfirmed", () => {
  const notConfirmed = new ApiError("Transaction is not sufficiently confirmed", 409);

  it("retries while the backend says the transaction is not confirmed yet", async () => {
    let calls = 0;
    const result = await verifyUntilConfirmed(
      async () => {
        calls += 1;
        if (calls < 3) throw notConfirmed;
        return "ok";
      },
      { attempts: 5, delayMs: 0 },
    );
    expect(result).toBe("ok");
    expect(calls).toBe(3);
  });

  it("stops at once on any other error", async () => {
    let calls = 0;
    await expect(
      verifyUntilConfirmed(
        async () => {
          calls += 1;
          throw new ApiError("Transaction reverted", 409);
        },
        { attempts: 5, delayMs: 0 },
      ),
    ).rejects.toThrow("Transaction reverted");
    expect(calls).toBe(1);
  });

  it("gives up after the last attempt", async () => {
    await expect(
      verifyUntilConfirmed(
        async () => {
          throw notConfirmed;
        },
        { attempts: 2, delayMs: 0 },
      ),
    ).rejects.toThrow("not sufficiently confirmed");
  });
});

describe("suggestedSplit", () => {
  it("splits a total 10% driver at pickup, 40% supplier at pickup, the rest at delivery", () => {
    expect(suggestedSplit("1000")).toEqual({
      driverAtPickupZar: "100.00",
      supplierAtPickupZar: "400.00",
      supplierAtDeliveryZar: "500.00",
    });
  });

  it("puts the rounding cents on the delivery payment so the three always add up", () => {
    expect(suggestedSplit("0.99")).toEqual({
      driverAtPickupZar: "0.10",
      supplierAtPickupZar: "0.40",
      supplierAtDeliveryZar: "0.49",
    });
  });

  it("returns nothing for a total that is not a positive rand amount", () => {
    for (const total of ["", "0", "-5", "abc", "1.234"]) expect(suggestedSplit(total)).toBeNull();
  });
});
