import type { Metadata } from "next";
import { InfoPage, Cards } from "@/components/InfoPage";

export const metadata: Metadata = {
  title: "About — Patella",
  description:
    "Patella is building the B2B order, custody and payment coordination platform for multi-hop supply chains and logistics in South Africa.",
  openGraph: {
    title: "About — Patella",
    description:
      "Patella is building the B2B order, custody and payment coordination platform for multi-hop supply chains and logistics in South Africa.",
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
      title="Every handoff accounted for. Every payment governed by agreed rules."
      lead="Patella was founded to solve a pervasive structural challenge across African logistics: freight carriers worry about delayed payment and non-payment, while commercial buyers worry about missing, damaged, or delayed cargo. By connecting multi-hop route custody directly to declarative smart-contract escrow, we replace manual chasing with cryptographic coordination."
      cta={true}
    >
      <Cards
        cols={3}
        items={[
          {
            t: "Our mission",
            p: "Make complex supply chains accountable and predictable through route-agnostic custody tracking and rule-governed escrow settlement.",
          },
          {
            t: "Our approach",
            p: "Honest trust boundaries, zero barrier to entry for frontline drivers, and strict conservation of money across every transaction.",
          },
          {
            t: "Where we operate",
            p: "South African mining, industrial manufacturing, agricultural export, and commercial freight corridors connecting mines, depots, and deep-water ports.",
          },
        ]}
      />
    </InfoPage>
  );
}
