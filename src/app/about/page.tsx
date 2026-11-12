import type { Metadata } from "next";
import { InfoPage, Cards } from "@/components/InfoPage";

export const metadata: Metadata = {
  title: "About — Patela",
  description:
    "Patela is building a crypto marketplace where work is escrowed by smart contracts and verified by AI before payment.",
  openGraph: {
    title: "About — Patela",
    description:
      "Patela is building a crypto marketplace where work is escrowed by smart contracts and verified by AI before payment.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function AboutPage() {
  return (
    <InfoPage
      eyebrow="About"
      title="Work should be paid on proof, not promises."
      lead="Patela started from a simple problem: clients worry about paying for work that never arrives, and workers worry about never getting paid. Smart contracts and AI let us remove that risk for both sides."
      cta={true}
    >
      <Cards
        cols={3}
        items={[
          {
            t: "Our mission",
            p: "Make it safe for anyone, anywhere, to hire and get hired, with money that moves only when work is proven.",
          },
          {
            t: "What we believe",
            p: "Trust should come from transparent rules and clear evidence, not from a middleman holding your funds.",
          },
          {
            t: "Where we're going",
            p: "A global marketplace where every payout is backed by verified delivery.",
          },
        ]}
      />
    </InfoPage>
  );
}
