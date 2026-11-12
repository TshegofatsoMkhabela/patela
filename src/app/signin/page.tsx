import type { Metadata } from "next";
import { SignInView } from "./signin-view";

export const metadata: Metadata = {
  title: "Sign In — Patella",
  description:
    "Sign in to your Patella workspace. Access orders, custody handoffs, declarative escrow tranches, and the Base Sepolia auditor trail.",
  openGraph: {
    title: "Sign In — Patella",
    description:
      "Enterprise workspace login for commercial buyers, freight operators, commodity suppliers, drivers, and auditors.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function SignInPage() {
  return <SignInView />;
}
