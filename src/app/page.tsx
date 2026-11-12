import type { Metadata } from "next";
import Link from "next/link";
import { HeroBar, VIDEO, POSTER } from "@/components/HeroBar";
import "@/styles/patela.css";
import { PatelaSections } from "@/components/PatelaSections";

export const metadata: Metadata = {
  title: "Patela — Crypto Escrow for Work, Verified by AI",
  description:
    "Post a job, lock payment in a smart contract, and get paid in crypto once AI verifies the deliverables.",
  openGraph: {
    title: "Patela — Crypto Escrow for Work, Verified by AI",
    description:
      "Smart-contract escrow for freelance work. Funds release only when AI approves the deliverables.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function Home() {
  const feats = [
    "Smart-contract escrow",
    "AI-verified delivery",
    "Stablecoin payouts",
    "Instant release",
  ];
  return (
    <div className="pt-page">
      <div className="patela">
        <video
          className="art"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
          poster={POSTER}
          src={VIDEO}
        />
        <div className="veil" />
        <HeroBar />
        <main className="hero">
          <h1 className="title">
            <span id="h1a">Trustless Work, Paid in Crypto.</span>
            <span id="h1b">Verified by AI, Released on Target.</span>
          </h1>
          <p className="sub">
            <span id="sub1">Funds lock in a smart contract on agreement</span>
            <span id="sub2">and release only when AI approves the deliverables.</span>
          </p>
          <Link className="cta" href="/post-job">
            <span>Post a job today</span>
            <svg className="arrow" viewBox="0 0 16 11" aria-hidden="true">
              <path d="M0 5.5 H14.6 M10.3 1.2 L14.9 5.5 L10.3 9.8" />
            </svg>
          </Link>
          <ul className="feats">
            {feats.map((f) => (
              <li key={f}>
                <svg className="chev" viewBox="0 0 11 20" aria-hidden="true">
                  <path d="M1.15 1.15 L9.6 10 L1.15 18.85" />
                </svg>
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <span className="rule" aria-hidden="true" />
        </main>
        <footer className="foot">
          <span id="foot1">Trusted by clients and builders across the onchain economy.</span>
          <span id="foot2">2026</span>
        </footer>
      </div>
      <PatelaSections />
    </div>
  );
}
