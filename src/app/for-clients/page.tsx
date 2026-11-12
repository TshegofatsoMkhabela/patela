import type { Metadata } from "next";
import { InfoPage, Cards } from "@/components/InfoPage";

export const metadata: Metadata = {
  title: "For clients — Patela",
  description:
    "Hire talent worldwide and only pay for work that meets the brief. Funds stay in escrow until AI verifies delivery.",
  openGraph: {
    title: "For clients — Patela",
    description:
      "Hire talent worldwide and only pay for work that meets the brief. Funds stay in escrow until AI verifies delivery.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function ForClientsPage() {
  return (
    <InfoPage
      eyebrow="Solutions · For clients"
      title="Only pay for work that meets the brief."
      lead="Your budget sits in a smart contract, not in someone's pocket. It moves only when the work is checked and approved."
      cta={true}
    >
      <Cards
        cols={3}
        items={[
          {
            t: "Funds stay in escrow",
            p: "Nothing leaves the contract until the deliverables pass review.",
          },
          {
            t: "Clear AI reports",
            p: "Every submission comes with a written check against each deliverable.",
          },
          {
            t: "Pay per milestone",
            p: "Release money step by step, so you never risk the whole budget at once.",
          },
          {
            t: "Hire anywhere",
            p: "No banks or borders. Pay in USDC, USDT, DAI, PYUSD or EURC.",
          },
          {
            t: "Refunds on cancellation",
            p: "If a job is cancelled before delivery, locked funds return to you.",
          },
          {
            t: "Human backup",
            p: "Disputes go to a human review panel before any funds move.",
          },
        ]}
      />
    </InfoPage>
  );
}
