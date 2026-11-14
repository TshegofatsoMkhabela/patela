import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HandoffView } from "./handoff-view";

export const metadata: Metadata = {
  title: "Handoff — Patela",
  description: "Show or scan the handoff QR. Both people sign, and the payment is released.",
  robots: { index: false },
};

export default async function HandoffPage({
  params,
}: {
  params: Promise<{ orderId: string; stage: string }>;
}) {
  const { orderId, stage } = await params;
  if (stage !== "1" && stage !== "2") notFound();
  return <HandoffView orderId={orderId} stage={stage === "1" ? 1 : 2} />;
}
