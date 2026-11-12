import type { Metadata } from "next";
import { InfoPage, Cards } from "@/components/InfoPage";

export const metadata: Metadata = {
  title: "For workers — Patela",
  description:
    "Find escrow-backed crypto jobs, see the money locked before you start, and get paid instantly when AI approves your work.",
  openGraph: {
    title: "For workers — Patela",
    description:
      "Find escrow-backed crypto jobs, see the money locked before you start, and get paid instantly when AI approves your work.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function ForWorkersPage() {
  return (
    <InfoPage
      eyebrow="Solutions · For workers"
      title="Know the money is there before you start."
      lead="Every funded job has its budget locked on-chain. Deliver great work and get paid the moment it's approved."
      cta={true}
    >
      <Cards
        cols={3}
        items={[
          {
            t: "See funds up front",
            p: "Check that the budget is locked in escrow before accepting a job.",
          },
          {
            t: "Instant payouts",
            p: "Approved milestones pay straight to your wallet, with no waiting period.",
          },
          {
            t: "No chargebacks",
            p: "Once released, payment is final. No unpaid invoices, ever.",
          },
          {
            t: "Fair, explained reviews",
            p: "The AI tells you exactly what passed and what needs changes.",
          },
          {
            t: "Paid as you go",
            p: "Milestones mean you're paid through the project, not just at the end.",
          },
          {
            t: "On-chain reputation",
            p: "Build a verifiable history of completed, approved work.",
          },
        ]}
      />
    </InfoPage>
  );
}
