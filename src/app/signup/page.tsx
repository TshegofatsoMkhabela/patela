import type { Metadata } from "next";
import { BuyerOnboardingView } from "./buyer-onboarding-view";

export const metadata: Metadata = {
  title: "Buyer onboarding — Patella",
  description: "Create and verify a Patella buyer profile in four short steps.",
  openGraph: {
    title: "Buyer onboarding — Patella",
    description: "Four-step buyer onboarding for the Patella demo.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function SignUpPage() {
  return <BuyerOnboardingView />;
}
