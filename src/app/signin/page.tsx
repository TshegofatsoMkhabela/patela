import type { Metadata } from "next";
import { SignInView } from "./signin-view";

export const metadata: Metadata = {
  title: "Sign In — Patela",
  description:
    "Sign in to your Patela workspace to coordinate orders, custody handoffs and payments.",
  openGraph: {
    title: "Sign In — Patela",
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
