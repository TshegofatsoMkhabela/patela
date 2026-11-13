// Buyer order flow (INTERFACES §1 step 3): POST /orders → createOrder → POST /orders/:id/chain
// → approve → fundEscrow → POST /orders/:id/funding/verify. Progress is kept so a failed step can
// be retried without creating a second order (off-chain or on-chain).
import { formatUnits, parseUnits, type Address, type Hex } from "viem";
import type { CreateOrderInput, CreatedOrder } from "@/lib/api";
import {
  contractErrorMessage,
  splitTotal,
  type FundResult,
  type FundStep,
  type OrderParams,
} from "@/lib/chain";
import { ZARP_DECIMALS } from "@/lib/contracts";

export type StepKey = "save" | "create" | "record" | "approve" | "fund" | "verify";
export type StepStatus = { status: "idle" | "pending" | "done" | "error"; message?: string };

export const STEP_LABELS: Record<StepKey, string> = {
  save: "Save order with Patela (agreement hash)",
  create: "Create order on-chain (MetaMask)",
  record: "Record on-chain order id",
  approve: "Approve ZARm for the escrow (MetaMask)",
  fund: "Fund escrow (MetaMask)",
  verify: "Patela verifies funding and invites the supplier",
};

export type OrderForm = {
  supplierEmail: string;
  supplierWallet: Address;
  totalZarp: string;
  refundAfterHours: number;
  agreementText: string;
};

export type FlowProgress = {
  orderId?: string;
  agreementHash?: Hex;
  refundDeadline?: bigint;
  /** DEMO_MODE: the supplier's accept link returned by the backend. */
  acceptUrl?: string;
  chainOrderId?: bigint;
  createTxHash?: Hex;
  chainRecorded?: boolean;
  /** Set once fundEscrow is mined: a retry then only re-runs the backend verification. */
  fundTxHash?: Hex;
};

export type FlowState = { steps: Record<StepKey, StepStatus>; progress: FlowProgress };

export type FlowDeps = {
  createOrder: (body: CreateOrderInput) => Promise<CreatedOrder>;
  recordChainOrder: (
    orderId: string,
    body: { chainOrderId: bigint; createTxHash: string },
  ) => Promise<unknown>;
  verifyFunding: (orderId: string, txHash: string) => Promise<unknown>;
  createAndFund: (
    params: OrderParams,
    onStep: (s: FundStep) => Promise<void>,
  ) => Promise<FundResult>;
};

/** The API may return unix seconds (number or numeric string) or an ISO date; the contract wants uint64 seconds. */
export function refundDeadlineSeconds(value: number | string): bigint {
  if (typeof value === "number" && Number.isFinite(value)) return BigInt(Math.floor(value));
  if (typeof value === "string" && /^\d+$/.test(value)) return BigInt(value);
  const ms = typeof value === "string" ? Date.parse(value) : NaN;
  if (Number.isNaN(ms)) throw new Error(`Unrecognised refund deadline: ${String(value)}`);
  return BigInt(Math.floor(ms / 1000));
}

function parseTotal(totalZarp: string): bigint {
  const trimmed = totalZarp.trim();
  if (!/^\d+(\.\d{1,18})?$/.test(trimmed))
    throw new Error("Enter the order total as a ZARm amount, e.g. 100");
  const wei = parseUnits(trimmed, ZARP_DECIMALS);
  if (wei <= 0n) throw new Error("The order total must be more than 0 ZARm");
  return wei;
}

const KEYS: StepKey[] = ["save", "create", "record", "approve", "fund", "verify"];

export async function runOrderFlow(
  deps: FlowDeps,
  form: OrderForm,
  initial: FlowProgress,
  onChange: (s: FlowState) => void,
): Promise<
  Required<Pick<FlowProgress, "orderId" | "chainOrderId" | "agreementHash" | "refundDeadline">>
> {
  const total = parseTotal(form.totalZarp);
  const split = splitTotal(total);
  const progress: FlowProgress = { ...initial };
  const steps = Object.fromEntries(KEYS.map((k) => [k, { status: "idle" }])) as Record<
    StepKey,
    StepStatus
  >;
  const emit = () => onChange({ steps: { ...steps }, progress: { ...progress } });
  let current: StepKey = "save";
  const start = (k: StepKey) => {
    current = k;
    steps[k] = { status: "pending" };
    emit();
  };
  const done = (k: StepKey) => {
    steps[k] = { status: "done" };
    emit();
  };

  if (progress.orderId) done("save");
  if (progress.chainOrderId !== undefined) done("create");
  if (progress.chainRecorded) done("record");
  if (progress.fundTxHash) {
    done("approve");
    done("fund");
  }

  try {
    if (!progress.orderId) {
      start("save");
      const created = await deps.createOrder({
        supplierEmail: form.supplierEmail.trim(),
        totalZarp: formatUnits(total, ZARP_DECIMALS),
        driverAtPickupZarp: formatUnits(split.driverAtPickup, ZARP_DECIMALS),
        supplierAtPickupZarp: formatUnits(split.supplierAtPickup, ZARP_DECIMALS),
        supplierAtDeliveryZarp: formatUnits(split.supplierAtDelivery, ZARP_DECIMALS),
        refundAfterHours: form.refundAfterHours,
        agreementText: form.agreementText,
      });
      progress.orderId = created.id;
      progress.agreementHash = created.agreementHash;
      progress.refundDeadline = refundDeadlineSeconds(created.refundDeadline);
      if (created.acceptUrl) progress.acceptUrl = created.acceptUrl;
      done("save");
    }
    const orderId = progress.orderId!;

    // The backend must know the on-chain id before funding is verified.
    const record = async () => {
      start("record");
      await deps.recordChainOrder(orderId, {
        chainOrderId: progress.chainOrderId!,
        createTxHash: progress.createTxHash ?? "",
      });
      progress.chainRecorded = true;
      done("record");
    };
    if (progress.chainOrderId !== undefined && !progress.chainRecorded) await record();

    if (!progress.fundTxHash) {
      start(progress.chainOrderId === undefined ? "create" : "approve");
      await deps.createAndFund(
        {
          supplier: form.supplierWallet,
          total,
          ...split,
          refundDeadline: progress.refundDeadline!,
          agreementHash: progress.agreementHash!,
          existingOrderId: progress.chainOrderId,
        },
        async (s) => {
          if (s.step === "created") {
            progress.chainOrderId = s.orderId;
            progress.createTxHash = s.txHash;
            done("create");
            await record();
            start("approve");
          } else if (s.step === "approved") {
            done("approve");
            start("fund");
          } else {
            progress.fundTxHash = s.txHash;
            done("fund");
          }
        },
      );
    }

    start("verify");
    await deps.verifyFunding(orderId, progress.fundTxHash!);
    done("verify");
    return {
      orderId,
      chainOrderId: progress.chainOrderId!,
      agreementHash: progress.agreementHash!,
      refundDeadline: progress.refundDeadline!,
    };
  } catch (err) {
    steps[current] = { status: "error", message: contractErrorMessage(err) };
    emit();
    throw err;
  }
}
