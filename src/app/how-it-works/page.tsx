import type { Metadata } from "next";
import { InfoPage, Cards, Prose } from "@/components/InfoPage";

export const metadata: Metadata = {
  title: "How it works — Patela",
  description:
    "How Patela escrow works: post a job, lock crypto in a smart contract, deliver, and get paid when AI verifies the work.",
  openGraph: {
    title: "How it works — Patela",
    description:
      "How Patela escrow works: post a job, lock crypto in a smart contract, deliver, and get paid when AI verifies the work.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function HowItWorksPage() {
  return (
    <InfoPage
      title="From brief to payout, without the trust problem."
      lead="Patela replaces the middleman with a smart contract and an AI reviewer. Here's every step a job goes through."
      centerTitle={true}
      cta={true}
    >
      <Cards
        cols={3}
        items={[
          {
            n: "STEP 01",
            t: "Post the job",
            p: "Describe the work, list exact deliverables, split it into milestones and set a budget in stablecoins.",
          },
          {
            n: "STEP 02",
            t: "Agree & lock funds",
            p: "When client and worker agree on terms, the full budget is locked in a smart contract that neither side can touch.",
          },
          {
            n: "STEP 03",
            t: "Deliver the work",
            p: "The worker uploads files, links or code against each milestone, straight to the job page.",
          },
          {
            n: "STEP 04",
            t: "AI verifies",
            p: "Patela's AI agent checks the submission against every deliverable and writes a report both sides can read.",
          },
          {
            n: "STEP 05",
            t: "Funds release",
            p: "Approved milestones release instantly to the worker's wallet. Changes requested? The worker revises and resubmits.",
          },
          {
            n: "STEP 06",
            t: "Disputes, if needed",
            p: "Disagree with the AI? Open a dispute and a human review panel decides while funds stay locked.",
          },
        ]}
      />
      <Prose
        sections={[
          {
            h: "Why milestones?",
            p: [
              "Big jobs are split into smaller milestones, each with its own deliverables and amount. Clients only risk one milestone at a time, and workers get paid as they go.",
            ],
          },
          {
            h: "What the AI checks",
            p: [
              "Every deliverable you write becomes a check. The AI looks for the files, functionality and quality described in the brief, and explains its decision in plain language.",
            ],
          },
        ]}
      />
    </InfoPage>
  );
}
