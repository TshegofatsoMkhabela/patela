import type { Metadata } from "next";
import Link from "next/link";
import { HeroBar, VIDEO, POSTER } from "@/components/HeroBar";
import "@/styles/patela.css";
import { PatelaSections } from "@/components/PatelaSections";

export const metadata: Metadata = {
  title: "Patella — B2B Order, Custody & Escrow Coordination",
  description:
    "B2B supply chain coordination for multi-hop logistics across South Africa. Route-agnostic custody, guest-first mobile handoffs, and declarative Rand escrow on Base Sepolia.",
  openGraph: {
    title: "Patella — B2B Order, Custody & Escrow Coordination",
    description:
      "Route-agnostic multi-hop logistics, two-party mobile handoffs, and automated Rand escrow on Base Sepolia.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function Home() {
  const feats = [
    "Route-agnostic multi-hop",
    "Guest-first mobile handoffs",
    "Rand in, Rand out (ZARP)",
    "Isolated dispute holding",
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
            <span id="h1a">Every handoff accounted for.</span>
            <span id="h1b">Every payment governed by agreed rules.</span>
          </h1>
          <p className="sub">
            <span id="sub1">Patella coordinates B2B supply chains across South Africa:</span>
            <span id="sub2">
              route-agnostic multi-hop logistics, two-party mobile handoffs, and automated Rand
              escrow.
            </span>
          </p>
          <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", justifyContent: "center" }}>
            <Link className="cta" href="/html/orders.html">
              <span>Explore active orders</span>
              <svg className="arrow" viewBox="0 0 16 11" aria-hidden="true">
                <path d="M0 5.5 H14.6 M10.3 1.2 L14.9 5.5 L10.3 9.8" />
              </svg>
            </Link>
            <Link
              className="cta"
              href="/html/index.html"
              style={{
                background: "rgba(255, 255, 255, 0.08)",
                borderColor: "rgba(217, 195, 154, 0.35)",
                color: "#ffe2b2",
              }}
            >
              <span>Launch Blueprint Hub</span>
              <svg className="arrow" viewBox="0 0 16 11" aria-hidden="true">
                <path d="M0 5.5 H14.6 M10.3 1.2 L14.9 5.5 L10.3 9.8" />
              </svg>
            </Link>
          </div>
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
          <span id="foot1">
            Trusted by commercial buyers, suppliers, and logistics operators across South Africa.
          </span>
          <span id="foot2">2026</span>
        </footer>
      </div>
      <PatelaSections />
    </div>
  );
}
