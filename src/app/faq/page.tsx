import type { Metadata } from "next";
import { InfoPage } from "@/components/InfoPage";
import { Reveal } from "@/components/Reveal";
import { faqs } from "@/lib/patela-data";

export const metadata: Metadata = {
  title: "FAQ — Patela",
  description:
    "Answers about Patela: how AI verification works, disputes, supported stablecoins, custody of funds and fees.",
  openGraph: {
    title: "FAQ — Patela",
    description:
      "Answers about Patela: how AI verification works, disputes, supported stablecoins, custody of funds and fees.",
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
      lead="Everything people usually ask before posting their first job or taking on work."
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
