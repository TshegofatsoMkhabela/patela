import type { Metadata } from "next";
import { JobView } from "./job-view";

export const metadata: Metadata = {
  title: "Job details & milestones — Patela",
  description:
    "Submit deliverables and track each milestone's AI review and escrow release status.",
  openGraph: {
    title: "Job details & milestones — Patela",
    description: "Track milestones, upload deliverables and watch escrow release on approval.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function JobDetailPage() {
  return <JobView />;
}
