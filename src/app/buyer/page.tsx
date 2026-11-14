import type { Metadata } from "next";
import BuyerDashboardClient from "@/components/buyer/BuyerDashboardClient";

export const metadata: Metadata = {
  title: "Where your goods are — Patela",
  description:
    "Buyer dashboard: live position, ETA and the next action for each shipment (demo data).",
};

export default function BuyerPage() {
  return <BuyerDashboardClient />;
}
