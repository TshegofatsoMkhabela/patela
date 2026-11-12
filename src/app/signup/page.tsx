import type { Metadata } from "next";
import { SignUpView } from "./signup-view";

export const metadata: Metadata = {
  title: "Sign Up & Progressive Onboarding — Patella",
  description:
    "Register for Patella B2B supply chain custody and escrow. Complete step-by-step role profile onboarding for buyers, carriers, suppliers, drivers, and auditors.",
  openGraph: {
    title: "Sign Up & Progressive Onboarding — Patella",
    description:
      "Enterprise onboarding for South African multi-hop logistics: role-specific credentials, CIPC registration, and escrow configuration.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function SignUpPage() {
  return <SignUpView />;
}
