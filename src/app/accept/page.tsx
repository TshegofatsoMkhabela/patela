import type { Metadata } from "next";
import { Suspense } from "react";
import { AcceptView } from "./accept-view";

export const metadata: Metadata = {
  title: "Order invitation — Patella",
  description: "Accept an escrow order as its supplier or driver.",
};

// The backend emails `<site>/accept?token=…` (backend/src/orders.ts invite()).
export default function AcceptPage() {
  return (
    <Suspense>
      <AcceptView />
    </Suspense>
  );
}
