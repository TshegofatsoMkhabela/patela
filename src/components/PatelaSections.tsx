"use client";

import Link from "next/link";
import "@/styles/patela-sections.css";
import { Reveal } from "@/components/Reveal";
import { SiteFooter } from "@/components/SiteFooter";

import { steps, features, faqs } from "@/lib/patela-data";
export { steps, features, faqs };

const Icon = ({ d }: { d: string }) => (
  <div className="pt-icon">
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={d} />
    </svg>
  </div>
);

export function PatelaSections() {
  return (
    <div className="pt-sections">
      <section className="pt-sec" id="how">
        <Reveal style={{ textAlign: "center" }}>
          <h2
            className="pt-h2"
            style={{ textAlign: "center", marginInline: "auto", maxWidth: "24ch" }}
          >
            From order to settlement, without the custody trust problem.
          </h2>
          <p className="pt-lead" style={{ marginInline: "auto" }}>
            Patella coordinates multi-hop freight logistics with smart-contract escrow on Base
            Sepolia. Buyers deposit Rand in trust, handoffs are verified via short-lived mobile
            links, and declarative payment tranches release automatically.
          </p>
        </Reveal>
        <div className="pt-grid pt-g4">
          {steps.map((s, i) => (
            <Reveal className="pt-card" key={s.t} delay={i * 90}>
              <span className="pt-num">STEP 0{i + 1}</span>
              <h3>{s.t}</h3>
              <p>{s.p}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="pt-sec" id="features">
        <Reveal>
          <span className="pt-eyebrow">The Coordination Platform</span>
          <h2 className="pt-h2">Built for supply chains that move on proof.</h2>
          <p className="pt-lead">
            Everything you need to orchestrate multi-party routes, enforce payment rules, and
            isolate dispute risk across South Africa.
          </p>
        </Reveal>
        <div className="pt-grid pt-g3">
          {features.map((f, i) => (
            <Reveal className="pt-card" key={f.t} delay={(i % 3) * 90}>
              <Icon d={f.d} />
              <h3>{f.t}</h3>
              <p>{f.p}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="pt-sec" id="who">
        <Reveal>
          <span className="pt-eyebrow">Solutions</span>
          <h2 className="pt-h2">Two sides protected across every corridor.</h2>
        </Reveal>
        <div className="pt-grid pt-g2">
          <div
            className="pt-card"
            style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}
          >
            <div>
              <span className="pt-num">FOR BUYERS & CONSIGNORS</span>
              <h3>Deposit Rand with bank-grade peace of mind.</h3>
              <ul className="pt-list">
                <li>Funds held in client trust account with a licensed South African bank</li>
                <li>Release payment tranches only upon verified handoff milestones</li>
                <li>Split consignments across multi-destination logistics corridors</li>
                <li>Isolated dispute holding keeps unaffected cargo and tranches moving</li>
              </ul>
            </div>
            <div style={{ marginTop: 24 }}>
              <Link href="/buyer" className="pt-btn sm">
                <span>Open Order Tracking</span>
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
          <div
            className="pt-card"
            style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}
          >
            <div>
              <span className="pt-num">FOR SUPPLIERS & CARRIERS</span>
              <h3>Know payment is guaranteed before wheels roll.</h3>
              <ul className="pt-list">
                <li>EscrowVault locks full funds before goods leave the warehouse</li>
                <li>Drivers sign custody handoffs from any smartphone without an app</li>
                <li>Rule-triggered payouts release straight to your bank account in ZAR</li>
                <li>Build a verifiable CIPC-linked track record of on-time delivery</li>
              </ul>
            </div>
            <div style={{ marginTop: 24 }}>
              <Link href="/html/partner-directory.html" className="pt-btn ghost sm">
                <span>Open Partner Directory</span>
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </div>
        <div className="pt-stats">
          <div className="pt-stat">
            <b>R 0</b>
            <span>unauthorised fund leakage</span>
          </div>
          <div className="pt-stat">
            <b>&lt;60s</b>
            <span>rule-triggered release upon handoff</span>
          </div>
          <div className="pt-stat">
            <b>100%</b>
            <span>isolated dispute protection</span>
          </div>
          <div className="pt-stat">
            <b>2-Party</b>
            <span>verified custody signatures</span>
          </div>
        </div>
      </section>

      <section className="pt-sec">
        <Reveal>
          <span className="pt-eyebrow">Financial & Custody Infrastructure</span>
          <h2 className="pt-h2">Rand in, Rand out. Governed by code.</h2>
          <p className="pt-lead">
            Transact natively in South African Rand (ZAR), backed by licensed banking partners and
            anchored on Base Sepolia.
          </p>
        </Reveal>
        <div className="pt-chips">
          {[
            "ZAR (South African Rand)",
            "ZARP (Rand Stablecoin)",
            "Base Sepolia EVM",
            "Standard Bank Escrow Trust",
            "Two-Party Cryptographic Signatures",
            "CIPC Verified Profiles",
            "KMS Release Authority",
            "ISO 20022 Ready",
          ].map((c) => (
            <span className="pt-chip" key={c}>
              {c}
            </span>
          ))}
        </div>
      </section>

      <section className="pt-sec" id="faq">
        <Reveal>
          <span className="pt-eyebrow">FAQ</span>
          <h2 className="pt-h2">Questions, answered.</h2>
        </Reveal>
        <div className="pt-faq">
          {faqs.map((f) => (
            <details key={f.q}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="pt-sec" id="start">
        <Reveal className="pt-cta-big">
          <span className="pt-eyebrow">Get started</span>
          <h2 className="pt-h2">Coordinate custody. Release on verified rules.</h2>
          <p className="pt-lead">
            Join commercial buyers, freight operators, and terminals orchestrating South African
            supply chains with Patella.
          </p>
          <div
            className="pt-cta-cards"
            style={{ maxWidth: 1020, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}
          >
            <Link href="/orders/new" className="pt-cta-card">
              <b>
                Create Order & Route <span className="ar">→</span>
              </b>
              <span>
                Configure multi-hop corridors, split parcels, and declarative payment tranches.
              </span>
            </Link>
            <Link href="/html/guest-handoff.html" className="pt-cta-card">
              <b>
                Guest Mobile Handoff <span className="ar">→</span>
              </b>
              <span>
                Simulate two-party custody handoff verification with zero mobile app required.
              </span>
            </Link>
            <Link href="/html/index.html" className="pt-cta-card">
              <b>
                Master Blueprint Hub <span className="ar">→</span>
              </b>
              <span>
                Explore all 28 enterprise supply-chain screens, demo narrative, and auditor console.
              </span>
            </Link>
          </div>
        </Reveal>
      </section>

      <SiteFooter />
    </div>
  );
}
