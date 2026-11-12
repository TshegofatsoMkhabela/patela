import type { Metadata } from "next";
import { InfoPage, Cards, Prose } from "@/components/InfoPage";

export const metadata: Metadata = {
  title: "Careers — Patela",
  description:
    "Join Patela and help build the marketplace where crypto payments are released only when AI verifies the work.",
  openGraph: {
    title: "Careers — Patela",
    description:
      "Join Patela and help build the marketplace where crypto payments are released only when AI verifies the work.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function CareersPage() {
  return (
    <InfoPage
      eyebrow="Careers"
      title="Help build trustless work."
      lead="We're a small team working on smart contracts, AI review and a marketplace people actually enjoy using."
      cta={true}
    >
      <Cards
        cols={3}
        items={[
          {
            n: "ENGINEERING",
            t: "Smart contract engineer",
            p: "Design and ship the escrow contracts that hold every job's funds.",
          },
          {
            n: "AI",
            t: "AI review engineer",
            p: "Teach our agent to check deliverables accurately and explain its decisions.",
          },
          {
            n: "DESIGN",
            t: "Product designer",
            p: "Make posting, delivering and getting paid feel effortless.",
          },
        ]}
      />
      <Prose
        sections={[
          {
            h: "Don't see your role?",
            p: [
              "We're always happy to hear from great people. Reach out through the Contact page and tell us what you'd like to work on.",
            ],
          },
        ]}
      />
    </InfoPage>
  );
}
