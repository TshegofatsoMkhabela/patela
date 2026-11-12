import type { Metadata } from "next";
import { InfoPage, Prose } from "@/components/InfoPage";

export const metadata: Metadata = {
  title: "Privacy policy — Patela",
  description:
    "How Patela handles your data, wallet addresses, job details and submitted deliverables.",
  openGraph: {
    title: "Privacy policy — Patela",
    description:
      "How Patela handles your data, wallet addresses, job details and submitted deliverables.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function PrivacyPage() {
  return (
    <InfoPage
      eyebrow="Legal"
      title="Privacy policy"
      lead="Last updated November 2026. This is a placeholder summary and will be replaced with the full policy."
      cta={false}
    >
      <Prose
        sections={[
          {
            h: "What we collect",
            p: [
              "Your wallet address, the job details you post, the files and notes you submit, and basic usage information needed to run the service.",
            ],
          },
          {
            h: "How we use it",
            p: [
              "To run escrow, perform AI review of deliverables, resolve disputes and improve the product. We do not sell your data.",
            ],
          },
          {
            h: "On-chain data",
            p: [
              "Transactions on public blockchains are visible to anyone and cannot be deleted by us.",
            ],
          },
          {
            h: "Your choices",
            p: ["You can ask us to delete off-chain data at any time through the Contact page."],
          },
        ]}
      />
    </InfoPage>
  );
}
