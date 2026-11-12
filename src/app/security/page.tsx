import type { Metadata } from "next";
import { InfoPage, Cards, Prose } from "@/components/InfoPage";

export const metadata: Metadata = {
  title: "Security — Patela",
  description:
    "How Patela keeps funds safe: smart-contract escrow, transparent AI review, human dispute resolution and wallet-based access.",
  openGraph: {
    title: "Security — Patela",
    description:
      "How Patela keeps funds safe: smart-contract escrow, transparent AI review, human dispute resolution and wallet-based access.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function SecurityPage() {
  return (
    <InfoPage
      eyebrow="Solutions · Security"
      title="Built so nobody has to trust anybody."
      lead="Patela never holds your money. Funds live in a smart contract with rules both sides can see."
      cta={true}
    >
      <Cards
        cols={3}
        items={[
          {
            t: "Non-custodial escrow",
            p: "Funds are held by the contract itself, not by Patela, and can only go to the worker or back to the client.",
          },
          {
            t: "Transparent rules",
            p: "Release conditions are set when the job is agreed and can't be changed by one side alone.",
          },
          {
            t: "Explained AI decisions",
            p: "Every approval or rejection comes with a written report tied to the deliverables.",
          },
          {
            t: "Human dispute panel",
            p: "Contested decisions are reviewed by people before funds move.",
          },
          {
            t: "Wallet-based access",
            p: "You sign in and approve actions with your own wallet. We never see your keys.",
          },
          {
            t: "Stablecoin pricing",
            p: "Pay in stablecoins so the job's value doesn't swing mid-project.",
          },
        ]}
      />
      <Prose
        sections={[
          {
            h: "Reporting a vulnerability",
            p: [
              "If you find a security issue, please contact us through the Contact page with the details. We'll respond quickly and keep you updated while we fix it.",
            ],
          },
        ]}
      />
    </InfoPage>
  );
}
