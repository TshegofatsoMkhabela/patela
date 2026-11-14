"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  errorMessage,
  OrderPage,
  StatusLine,
  useSession,
  useTask,
} from "@/components/orders/order-ui";
import { patelaApi, type Invitation } from "@/lib/patela-api";

const ROLE_DUTY: Record<Invitation["role"], string> = {
  supplier: "You supply the goods. You are paid 40% when the driver collects and 50% on delivery.",
  driver: "You carry the goods. You are paid your share when the supplier hands them to you.",
};

export function AcceptView() {
  const token = useSearchParams().get("token") ?? "";
  const router = useRouter();
  const session = useSession();
  const { busy, status, run } = useTask();
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return setError("This link has no invitation in it.");
    patelaApi.invitation(token).then(setInvitation, (e) => setError(errorMessage(e)));
  }, [token]);

  const wrongPerson =
    invitation &&
    session.profile &&
    invitation.email.toLowerCase() !== session.profile.email.toLowerCase();

  function accept() {
    void run("Accepting…", async () => {
      if (!session.account) return;
      const order = await patelaApi.acceptInvitation(token, session.account);
      router.push(`/orders/${order.id}`);
    });
  }

  return (
    <OrderPage eyebrow="Invitation" title="You've been asked to join an order." session={session}>
      {error && <p className="pt-order-error">{error}</p>}
      {invitation && (
        <div className="pt-card pt-order-panel">
          <p>
            <strong>Your role:</strong> {invitation.role}. {ROLE_DUTY[invitation.role]}
          </p>
          {invitation.agreementText && (
            <blockquote className="pt-order-agreement">{invitation.agreementText}</blockquote>
          )}
          {wrongPerson ? (
            <p className="pt-order-error">
              This invitation is for {invitation.email}, but you are signed in as{" "}
              {session.profile?.email}.
            </p>
          ) : (
            <button className="pt-btn" onClick={accept} disabled={busy}>
              Accept with this wallet
            </button>
          )}
          <StatusLine status={status} />
        </div>
      )}
    </OrderPage>
  );
}
