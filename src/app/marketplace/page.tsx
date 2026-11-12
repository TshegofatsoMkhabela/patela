import type { Metadata } from "next";
import { MarketplaceView } from "./marketplace-view";

export const metadata: Metadata = {
  title: "Orders & Tender Directory — Patella",
  description:
    "Explore commercial supply chain consignments, freight tender RFQs, and multi-hop logistics orders backed by Rand escrow.",
  openGraph: {
    title: "Orders & Tender Directory — Patella",
    description:
      "Commercial logistics orders and tender opportunities backed by bank-grade escrow and verified two-party handoffs.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function MarketplacePage() {
  return <MarketplaceView />;
}
