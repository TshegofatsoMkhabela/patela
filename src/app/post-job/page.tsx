import type { Metadata } from "next";
import { PostJobView } from "./post-job-view";

export const metadata: Metadata = {
  title: "Post a job — Patela",
  description:
    "Post a job with scope, deliverables, milestones and a stablecoin budget locked in smart-contract escrow.",
  openGraph: {
    title: "Post a job — Patela",
    description:
      "Define deliverables and milestones, pick stablecoins, and lock the budget in escrow.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function PostJobPage() {
  return <PostJobView />;
}
