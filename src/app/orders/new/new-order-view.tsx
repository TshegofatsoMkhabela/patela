"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { OrderPage, StatusLine, useSession, useTask } from "@/components/orders/order-ui";
import { suggestedSplit } from "@/lib/order-flow";
import { isEmail, patelaApi } from "@/lib/patela-api";

type Split = NonNullable<ReturnType<typeof suggestedSplit>>;

export function NewOrderView() {
  const session = useSession();
  const { busy, status, run } = useTask();
  const [supplierEmail, setSupplierEmail] = useState("");
  const [agreementText, setAgreementText] = useState("");
  const [total, setTotal] = useState("");
  const [split, setSplit] = useState<Split | null>(null);
  const [refundAfterHours, setRefundAfterHours] = useState("48");
  const [created, setCreated] = useState<{ id: string; acceptUrl?: string } | null>(null);

  function changeTotal(value: string) {
    setTotal(value);
    setSplit(suggestedSplit(value));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void run("Saving the order…", async () => {
      setCreated(
        await patelaApi.createOrder({
          supplierEmail: supplierEmail.trim(),
          agreementText: agreementText.trim(),
          totalZar: total,
          ...split,
          refundAfterHours: Number(refundAfterHours),
        }),
      );
    });
  }

  if (created) {
    return (
      <OrderPage eyebrow="Order saved" title="Invitation sent." session={session}>
        <div className="pt-card pt-order-panel">
          <p>
            We emailed {supplierEmail} a link to accept. Once they accept, you put the order on Celo
            and fund it from the order page.
          </p>
          {created.acceptUrl && (
            <p>
              Demo link (shown only in demo mode):{" "}
              <a href={created.acceptUrl}>{created.acceptUrl}</a>
            </p>
          )}
          <Link className="pt-btn" href={`/orders/${created.id}`}>
            Open the order
          </Link>
        </div>
      </OrderPage>
    );
  }

  const ready =
    isEmail(supplierEmail.trim()) && agreementText.trim().length >= 10 && split !== null;
  const part = (key: keyof Split, label: string) => (
    <div className="pt-field">
      <label htmlFor={key}>{label}</label>
      <input
        id={key}
        className="pt-in"
        inputMode="decimal"
        value={split?.[key] ?? ""}
        disabled={!split}
        onChange={(e) => split && setSplit({ ...split, [key]: e.target.value })}
      />
    </div>
  );

  return (
    <OrderPage eyebrow="New order" title="Agree the terms, then lock the money." session={session}>
      <form className="pt-form" onSubmit={submit}>
        <div className="pt-field">
          <label htmlFor="supplier">Supplier email</label>
          <input
            id="supplier"
            type="email"
            className="pt-in"
            value={supplierEmail}
            onChange={(e) => setSupplierEmail(e.target.value)}
            placeholder="supplier@company.co.za"
          />
        </div>
        <div className="pt-field">
          <label htmlFor="agreement">Agreement</label>
          <small>
            What, how many, from where to where, and by when. Its fingerprint goes on Celo, and the
            supplier must accept this exact text.
          </small>
          <textarea
            id="agreement"
            className="pt-in"
            value={agreementText}
            onChange={(e) => setAgreementText(e.target.value)}
            placeholder="20 crates of tomatoes, Johannesburg to Polokwane, delivered by Friday."
          />
        </div>
        <div className="pt-field">
          <label htmlFor="total">Total (ZAR)</label>
          <input
            id="total"
            className="pt-in"
            inputMode="decimal"
            value={total}
            onChange={(e) => changeTotal(e.target.value)}
            placeholder="1000"
          />
        </div>
        <fieldset className="pt-order-split">
          <legend>Who is paid when</legend>
          {part("driverAtPickupZar", "Driver, at pickup")}
          {part("supplierAtPickupZar", "Supplier, at pickup")}
          {part("supplierAtDeliveryZar", "Supplier, at delivery")}
        </fieldset>
        <div className="pt-field">
          <label htmlFor="refund">Refund after (hours)</label>
          <small>If the goods never arrive, you can take back what is unpaid after this.</small>
          <input
            id="refund"
            className="pt-in"
            inputMode="numeric"
            value={refundAfterHours}
            onChange={(e) => setRefundAfterHours(e.target.value)}
          />
        </div>
        <button className="pt-btn" type="submit" disabled={!ready || busy}>
          Save and invite supplier
        </button>
        <StatusLine status={status} />
      </form>
    </OrderPage>
  );
}
