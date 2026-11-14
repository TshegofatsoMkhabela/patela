"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { Address, Hex } from "viem";
import {
  confirmTx,
  errorMessage,
  OrderPage,
  StatusLine,
  useSession,
  useTask,
  zar,
  type Session,
} from "@/components/orders/order-ui";
import { STAGE_PARTIES, STATUS_LABEL, nextStep, type OrderView as Order } from "@/lib/order-flow";
import {
  acceptOrderTransaction,
  assignDriverTransaction,
  createdOrderId,
  createOrderTransaction,
  fundOrderTransaction,
} from "@/lib/order-escrow";
import { isEmail, patelaApi } from "@/lib/patela-api";
import { shortAddr } from "@/lib/patela-store";

const POLL_MS = 5000;

export function OrderView({ orderId }: { orderId: string }) {
  const session = useSession();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setOrder(await patelaApi.order(orderId));
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [orderId]);

  // Poll while other people may move the order on; stop once it is finished, skip hidden tabs.
  const finished = order?.status === "delivered" || order?.status === "refunded";
  useEffect(() => {
    if (!session.profile) return;
    void load();
    if (finished) return;
    const timer = setInterval(() => {
      if (!document.hidden) void load();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [session.profile, load, finished]);

  return (
    <OrderPage
      eyebrow="Order"
      title={order ? STATUS_LABEL[order.status] : "Order"}
      session={session}
    >
      {error && <p className="pt-order-error">{error}</p>}
      {order && session.profile && (
        <>
          <NextStepPanel order={order} session={session} reload={load} />
          <Balances order={order} />
          <Details order={order} />
        </>
      )}
    </OrderPage>
  );
}

function NextStepPanel({
  order,
  session,
  reload,
}: {
  order: Order;
  session: Session;
  reload: () => Promise<void>;
}) {
  const { busy, status, run } = useTask();
  const [driverEmail, setDriverEmail] = useState("");
  const [driverLink, setDriverLink] = useState<string | null>(null);
  const step = nextStep(order, session.profile!.id);
  const eth = session.eth;
  const account = session.account!;
  const send = { eth, account, escrow: order.escrowAddress as Address };
  const chainOrderId = order.chainOrderId ? BigInt(order.chainOrderId) : 0n;

  /** Wallet transaction, then the backend's check of its confirmed events, then fresh state. */
  async function confirmed(hash: Hex, say: (s: string) => void, verify: () => Promise<unknown>) {
    await confirmTx(eth, hash, say, verify);
    await reload();
  }

  const putOnChain = () =>
    run("Confirm in MetaMask: put the order on Celo", async (say) => {
      const hash = await createOrderTransaction(send, {
        supplier: order.parties.supplier!.wallet as Address,
        totalWei: BigInt(order.totalWei),
        driverAtPickupWei: BigInt(order.driverAtPickupWei),
        supplierAtPickupWei: BigInt(order.supplierAtPickupWei),
        supplierAtDeliveryWei: BigInt(order.supplierAtDeliveryWei),
        refundDeadline: BigInt(Math.floor(new Date(order.refundDeadline).getTime() / 1000)),
        agreementHash: order.agreementHash as Hex,
      });
      say("Waiting for Celo to confirm…");
      const id = await createdOrderId(eth, hash, send.escrow);
      await patelaApi.linkChain(order.id, id.toString(), hash);
      await reload();
      toast.success("The order is on Celo. Next: fund it.");
    });

  const fund = () =>
    run("Confirm in MetaMask: approve, then fund", async (say) => {
      const { fundingHash } = await fundOrderTransaction(
        send,
        chainOrderId,
        BigInt(order.totalWei),
        order.tokenAddress as Address,
      );
      await confirmed(fundingHash, say, () => patelaApi.verifyTx(order.id, "funding", fundingHash));
      toast.success(`${zar(order.totalWei)} is locked in escrow.`);
    });

  const accept = () =>
    run("Confirm in MetaMask: accept the agreement", async (say) => {
      const hash = await acceptOrderTransaction(send, chainOrderId, order.agreementHash as Hex);
      await confirmed(hash, say, () => patelaApi.verifyTx(order.id, "acceptance", hash));
      toast.success("Accepted. Next: invite your driver.");
    });

  const inviteDriver = () =>
    run("Sending the invitation…", async () => {
      const result = await patelaApi.inviteDriver(order.id, driverEmail.trim());
      setDriverLink(result.acceptUrl ?? null);
      toast.success(`Invitation sent to ${driverEmail.trim()}.`);
    });

  const assignDriver = () =>
    run("Confirm in MetaMask: assign the driver", async (say) => {
      const hash = await assignDriverTransaction(
        send,
        chainOrderId,
        order.parties.driver!.wallet as Address,
      );
      await confirmed(hash, say, () => patelaApi.verifyTx(order.id, "driver", hash));
      toast.success("Driver assigned. Next: the pickup handoff.");
    });

  let body;
  switch (step.kind) {
    case "create":
      body = (
        <Action
          onClick={putOnChain}
          busy={busy}
          text="Put the order on Celo"
          note="One MetaMask transaction. It records the payment split and the agreement's fingerprint."
        />
      );
      break;
    case "fund":
      body = (
        <Action
          onClick={fund}
          busy={busy}
          text={`Fund ${zar(order.totalWei)}`}
          note="Two MetaMask steps: allow the escrow to take exactly this much ZARm, then lock it."
        />
      );
      break;
    case "accept":
      body = (
        <Action
          onClick={accept}
          busy={busy}
          text="Accept the agreement on Celo"
          note="The money is in escrow. Accepting confirms you agree to the exact text below."
        />
      );
      break;
    case "invite-driver":
      body = (
        <>
          <p>Invite the driver who will collect the goods.</p>
          <input
            className="pt-in"
            type="email"
            aria-label="Driver email"
            placeholder="driver@company.co.za"
            value={driverEmail}
            onChange={(e) => setDriverEmail(e.target.value)}
          />
          <button
            className="pt-btn"
            disabled={busy || !isEmail(driverEmail.trim())}
            onClick={inviteDriver}
          >
            Invite driver
          </button>
          {driverLink && (
            <p>
              Demo link (shown only in demo mode): <a href={driverLink}>{driverLink}</a>
            </p>
          )}
        </>
      );
      break;
    case "assign-driver":
      body = (
        <Action
          onClick={assignDriver}
          busy={busy}
          text={`Assign ${order.parties.driver?.email ?? "the driver"}`}
          note="Fixes the driver on Celo for the pickup and delivery handoffs."
        />
      );
      break;
    case "show-qr":
    case "scan-qr": {
      const { giver, receiver } = STAGE_PARTIES[step.stage];
      body = (
        <>
          <p>
            {step.kind === "show-qr"
              ? `Show your QR to the ${receiver} when you hand over the goods.`
              : `Scan the ${giver}'s QR when you receive the goods.`}
          </p>
          <Link className="pt-btn" href={`/orders/${order.id}/handoff/${step.stage}`}>
            {step.kind === "show-qr" ? "Show handoff QR" : "Scan handoff QR"}
          </Link>
        </>
      );
      break;
    }
    case "wait":
      body = <p>Waiting for {step.waitingFor}.</p>;
      break;
    case "paused":
      body = <p>Handoffs are paused while a dispute is reviewed.</p>;
      break;
    case "done":
      body = (
        <p>
          {order.status === "delivered" ? "Delivered and paid in full." : "Refunded to the buyer."}
        </p>
      );
      break;
  }

  return (
    <section className="pt-card pt-order-panel" aria-label="Next step">
      <span className="pt-eyebrow">Your next step{step.role ? ` (${step.role})` : ""}</span>
      {body}
      <StatusLine status={status} />
    </section>
  );
}

function Action({
  onClick,
  busy,
  text,
  note,
}: {
  onClick: () => void;
  busy: boolean;
  text: string;
  note: string;
}) {
  return (
    <>
      <p>{note}</p>
      <button className="pt-btn" onClick={onClick} disabled={busy}>
        {text}
      </button>
    </>
  );
}

function Balances({ order }: { order: Order }) {
  const rows = [
    ["Buyer", order.balances?.buyer, order.parties.buyer?.wallet],
    ["Supplier", order.balances?.supplier, order.parties.supplier?.wallet],
    ["Driver", order.balances?.driver, order.parties.driver?.wallet],
    ["Escrow", order.balances?.escrow, order.escrowAddress],
  ] as const;
  return (
    <section className="pt-card pt-order-panel" aria-label="ZARm balances">
      <span className="pt-eyebrow">ZARm balances on Celo</span>
      <div className="pt-order-balances">
        {rows.map(([name, balance, wallet]) => (
          <div key={name}>
            <small>{name}</small>
            <strong>{zar(balance)}</strong>
            <small className="pt-mono">{wallet ? shortAddr(wallet) : "not joined"}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

const EVENT_LABEL: Record<string, string> = {
  OrderCreated: "Order put on Celo",
  EscrowFunded: "Escrow funded",
  OrderAccepted: "Supplier accepted",
  DriverAssigned: "Driver assigned",
  HandoffVerified: "Handoff signed by both",
  PaymentReleased: "Payment released",
  OrderRefunded: "Refunded",
};

function Details({ order }: { order: Order }) {
  return (
    <section className="pt-card pt-order-panel" aria-label="Agreement and history">
      <span className="pt-eyebrow">Agreement</span>
      {order.agreementText && (
        <blockquote className="pt-order-agreement">{order.agreementText}</blockquote>
      )}
      <p>
        {zar(order.totalWei)} total: driver {zar(order.driverAtPickupWei)} at pickup, supplier{" "}
        {zar(order.supplierAtPickupWei)} at pickup and {zar(order.supplierAtDeliveryWei)} at
        delivery. Refund possible after {new Date(order.refundDeadline).toLocaleString("en-ZA")}.
      </p>
      {order.timeline.length > 0 && (
        <>
          <span className="pt-eyebrow">On Celo</span>
          <ol className="pt-order-timeline">
            {order.timeline.map((e, i) => (
              <li key={`${e.txHash}-${i}`}>
                {EVENT_LABEL[e.event] ?? e.event}
                {e.event === "PaymentReleased" && ` · ${zar(e.amountWei)}`}
                {e.txHash && <small className="pt-mono"> {shortAddr(e.txHash)}</small>}
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
