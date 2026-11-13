"use client";

import dynamic from "next/dynamic";

/** Client-only: demo times are seeded in the browser, so server HTML would never match them. */
const BuyerDashboard = dynamic(() => import("./BuyerDashboard"), {
  ssr: false,
  loading: () => (
    <div className="bd-loading" aria-busy="true" aria-label="Loading your shipments">
      <div className="bd-skeleton" style={{ width: "40%", height: 12 }} />
      <div className="bd-skeleton" style={{ width: "70%", height: 44 }} />
      <div className="bd-skeleton" style={{ width: "100%", height: 420, borderRadius: 21 }} />
    </div>
  ),
});

export default function BuyerDashboardClient() {
  return <BuyerDashboard />;
}
