import type { Metadata } from "next";
import { InfoPage, Prose } from "@/components/InfoPage";

export const metadata: Metadata = {
  title: "Terms of service — Patela",
  description:
    "The terms that govern using Patela's escrow marketplace, AI verification and dispute process.",
  openGraph: {
    title: "Terms of service — Patela",
    description:
      "The terms that govern using Patela's escrow marketplace, AI verification and dispute process.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function TermsPage() {
  return (
    <InfoPage
      eyebrow="Legal"
      title="Terms of service"
      lead="Last updated November 2026. These terms are a placeholder summary and will be replaced with the full legal version."
      cta={false}
    >
      <Prose
        sections={[
          {
            h: "Using Patela",
            p: [
              "By posting or accepting a job you agree to these terms. You are responsible for your wallet and the accuracy of the job details you provide.",
            ],
          },
          {
            h: "Escrow and release",
            p: [
              "Funds are locked in a smart contract when both parties agree. They are released to the worker when milestones are approved, or returned to the client if a job is cancelled before delivery.",
            ],
          },
          {
            h: "AI review and disputes",
            p: [
              "AI verification is used to check deliverables. Either party may open a dispute within the review window, and a human review panel will make the final decision.",
            ],
          },
          {
            h: "Fees",
            p: [
              "Any platform fee is shown before funds are locked and is taken only when funds are released.",
            ],
          },
        ]}
      />
    </InfoPage>
  );
}
