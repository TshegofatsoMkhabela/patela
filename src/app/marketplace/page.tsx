import type { Metadata } from "next";
import { MarketplaceView } from "./marketplace-view";

export const metadata: Metadata = {
  title: "Marketplace — Patela",
  description:
    "Browse open jobs with budgets locked in smart-contract escrow and paid in stablecoins.",
  openGraph: {
    title: "Marketplace — Patela",
    description: "Find escrow-backed crypto jobs that pay instantly when AI verifies your work.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function MarketplacePage() {
  return <MarketplaceView />;
}
