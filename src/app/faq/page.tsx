import type { Metadata } from "next";
import { InfoPage } from "@/components/InfoPage";
import { Reveal } from "@/components/Reveal";
import { faqs } from "@/lib/patela-data";

export const metadata: Metadata = {
  title: "FAQ — Patella",
  description:
    "Frequently asked questions about Patella: multi-hop logistics, South African Rand escrow, guest mobile handoffs, isolated disputes, and smart contracts.",
  openGraph: {
    title: "FAQ — Patella",
    description:
      "Answers to common questions about Patella supply chain custody, Rand-to-ZARP escrow, driver guest handoffs, and dispute resolution.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function FaqPage() {
  return (
    <InfoPage
      eyebrow="FAQ"
      title="Questions, answered."
      lead="Everything buyers, suppliers, carriers, and auditors ask about Patella's supply chain custody and escrow platform."
      cta={true}
    >
      <div className="pt-faq">
        {faqs.map((f, i) => (
          <Reveal key={f.q} delay={i * 50}>
            <details>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          </Reveal>
        ))}
      </div>
    </InfoPage>
  );
}
