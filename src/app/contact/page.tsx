import type { Metadata } from "next";
import { InfoPage } from "@/components/InfoPage";
import { ContactForm } from "@/components/ContactForm";

export const metadata: Metadata = {
  title: "Contact — Patela",
  description:
    "Get in touch with the Patela team about hiring, working, partnerships, press or security reports.",
  openGraph: {
    title: "Contact — Patela",
    description:
      "Get in touch with the Patela team about hiring, working, partnerships, press or security reports.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function ContactPage() {
  return (
    <InfoPage
      eyebrow="Contact"
      title="Talk to the Patela team."
      lead="Questions about hiring, delivering work, partnerships or security? Send us a message."
      cta={false}
    >
      <ContactForm />
    </InfoPage>
  );
}
