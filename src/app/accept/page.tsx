import type { Metadata } from "next";
import { Suspense } from "react";
import { AcceptView } from "./accept-view";

export const metadata: Metadata = {
  title: "Accept order — Patela",
  description: "Review the agreement you were invited to and accept it with your wallet.",
  robots: { index: false },
};

export default function AcceptPage() {
  return (
    <Suspense>
      <AcceptView />
    </Suspense>
  );
}
