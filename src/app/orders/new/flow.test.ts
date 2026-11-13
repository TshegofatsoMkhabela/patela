import { describe, expect, it, vi } from "vitest";
import { parseUnits, type Hex } from "viem";
import { refundDeadlineSeconds, runOrderFlow, type FlowDeps, type FlowState } from "./flow";

const HASH = ("0x" + "22".repeat(32)) as Hex;
const form = {
  supplierEmail: "s@example.com",
  supplierWallet: "0x5050000000000000000000000000000000000004" as const,
  totalZarp: "100",
  refundAfterHours: 72,
  agreementText: "100 bags of maize",
};

function deps(overrides: Partial<FlowDeps> = {}) {
  const log: string[] = [];
  const d: FlowDeps = {
    createOrder: vi.fn(async (body) => {
      log.push(`POST /orders ${JSON.stringify(body)}`);
      return { id: "o-1", agreementHash: HASH, refundDeadline: 1_900_000_000 };
    }),
    recordChainOrder: vi.fn(async (id, body) => {
      log.push(`POST /orders/${id}/chain ${body.chainOrderId} ${body.createTxHash}`);
      return { id };
    }),
    verifyFunding: vi.fn(async (id, tx) => {
      log.push(`POST /orders/${id}/funding/verify ${tx}`);
      return { id };
    }),
    createAndFund: vi.fn(async (params, onStep) => {
      log.push(
        `chain total=${params.total} deadline=${params.refundDeadline} existing=${params.existingOrderId ?? "-"}`,
      );
      if (params.existingOrderId === undefined)
        await onStep({ step: "created", orderId: 9n, txHash: "0xc" });
      await onStep({ step: "approved", txHash: "0xa" });
      await onStep({ step: "funded", txHash: "0xf" });
      return {
        orderId: params.existingOrderId ?? 9n,
        createTxHash: "0xc" as Hex,
        approveTxHash: "0xa" as Hex,
        fundTxHash: "0xf" as Hex,
      };
    }),
    ...overrides,
  };
  return { d, log };
}

describe("runOrderFlow", () => {
  it("Given a filled form, When run, Then POST /orders → chain → /chain → /funding/verify in that order with 10/40/50 splits", async () => {
    const { d, log } = deps();
    const result = await runOrderFlow(d, form, {}, () => {});
    expect(log).toEqual([
      `POST /orders ${JSON.stringify({ supplierEmail: "s@example.com", totalZarp: "100", driverAtPickupZarp: "10", supplierAtPickupZarp: "40", supplierAtDeliveryZarp: "50", refundAfterHours: 72, agreementText: "100 bags of maize" })}`,
      `chain total=${parseUnits("100", 18)} deadline=1900000000 existing=-`,
      "POST /orders/o-1/chain 9 0xc",
      "POST /orders/o-1/funding/verify 0xf",
    ]);
    expect(result).toEqual({
      orderId: "o-1",
      chainOrderId: 9n,
      agreementHash: HASH,
      refundDeadline: 1_900_000_000n,
    });
  });

  it("Given each step, When run, Then statuses go pending → done for every step", async () => {
    const { d } = deps();
    const seen: FlowState[] = [];
    await runOrderFlow(d, form, {}, (s) => seen.push(structuredClone(s)));
    const final = seen[seen.length - 1];
    expect(Object.values(final.steps).every((s) => s.status === "done")).toBe(true);
    expect(seen.some((s) => s.steps.fund.status === "pending")).toBe(true);
  });

  it("Given funding failed after the order was created on-chain, When retried with progress, Then it does not create again", async () => {
    const { d, log } = deps();
    const progress = {
      orderId: "o-1",
      agreementHash: HASH,
      refundDeadline: 1_900_000_000n,
      chainOrderId: 9n,
      chainRecorded: true,
    };
    await runOrderFlow(d, form, progress, () => {});
    expect(log).toEqual([
      "chain total=100000000000000000000 deadline=1900000000 existing=9",
      "POST /orders/o-1/funding/verify 0xf",
    ]);
  });

  it("Given a step throws, When run, Then that step is marked error with the message and the progress so far is kept", async () => {
    const { d } = deps({
      createAndFund: vi.fn(async (_p, onStep) => {
        await onStep({ step: "created", orderId: 9n, txHash: "0xc" });
        throw new Error("Transaction cancelled in MetaMask.");
      }),
    });
    let last: FlowState | undefined;
    const err = await runOrderFlow(d, form, {}, (s) => {
      last = structuredClone(s);
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect(last?.steps.approve).toEqual({
      status: "error",
      message: "Transaction cancelled in MetaMask.",
    });
    expect(last?.progress).toMatchObject({ orderId: "o-1", chainOrderId: 9n, chainRecorded: true });
  });

  it("Given a non-positive or malformed total, When run, Then it rejects before calling the API", async () => {
    const { d } = deps();
    await expect(runOrderFlow(d, { ...form, totalZarp: "0" }, {}, () => {})).rejects.toThrow(
      /total/i,
    );
    await expect(runOrderFlow(d, { ...form, totalZarp: "abc" }, {}, () => {})).rejects.toThrow(
      /total/i,
    );
    expect(d.createOrder).not.toHaveBeenCalled();
  });
});

describe("refundDeadlineSeconds", () => {
  it("Given unix seconds, numeric strings or ISO dates, Then returns unix seconds as bigint", () => {
    expect(refundDeadlineSeconds(1_900_000_000)).toBe(1_900_000_000n);
    expect(refundDeadlineSeconds("1900000000")).toBe(1_900_000_000n);
    expect(refundDeadlineSeconds("2030-03-17T17:46:40.000Z")).toBe(1_900_000_000n);
    expect(() => refundDeadlineSeconds("soon")).toThrow();
  });
});
