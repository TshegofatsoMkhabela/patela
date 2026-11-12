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
            From brief to payout, without the trust problem.
          </h2>
          <p className="pt-lead" style={{ marginInline: "auto" }}>
            Patela replaces the middleman with a smart contract and an AI reviewer, so clients only
            pay for work that's done and workers always get paid for work they deliver.
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
          <span className="pt-eyebrow">The marketplace</span>
          <h2 className="pt-h2">Built for work that gets paid on proof.</h2>
          <p className="pt-lead">
            Everything you need to hire and get hired globally, settled on-chain.
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
          <h2 className="pt-h2">One contract. Two sides protected.</h2>
        </Reveal>
        <div className="pt-grid pt-g2">
          <div
            className="pt-card"
            style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}
          >
            <div>
              <span className="pt-num">FOR CLIENTS</span>
              <h3>Only pay for work that meets the brief.</h3>
              <ul className="pt-list">
                <li>Funds never leave escrow until deliverables pass</li>
                <li>Clear AI reports on every submission</li>
                <li>Hire talent anywhere, with no banks in the way</li>
                <li>Full refund if the job is cancelled before delivery</li>
              </ul>
            </div>
            <div style={{ marginTop: 24 }}>
              <Link href="/html/client-dashboard.html" className="pt-btn sm">
                <span>Open Client Dashboard</span>
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
          <div
            className="pt-card"
            style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}
          >
            <div>
              <span className="pt-num">FOR WORKERS</span>
              <h3>Know the money is there before you start.</h3>
              <ul className="pt-list">
                <li>See locked funds on-chain before accepting</li>
                <li>Get paid instantly when work is approved</li>
                <li>No chargebacks, no unpaid invoices</li>
                <li>Build a verifiable on-chain work history</li>
              </ul>
            </div>
            <div style={{ marginTop: 24 }}>
              <Link href="/html/worker-dashboard.html" className="pt-btn ghost sm">
                <span>Open Worker Dashboard</span>
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </div>
        <div className="pt-stats">
          <div className="pt-stat">
            <b>0%</b>
            <span>chance of chargebacks</span>
          </div>
          <div className="pt-stat">
            <b>&lt;60s</b>
            <span>payout after approval</span>
          </div>
          <div className="pt-stat">
            <b>24/7</b>
            <span>AI review, any timezone</span>
          </div>
          <div className="pt-stat">
            <b>100%</b>
            <span>funds held on-chain</span>
          </div>
        </div>
      </section>

      <section className="pt-sec">
        <Reveal>
          <span className="pt-eyebrow">Supported assets</span>
          <h2 className="pt-h2">Pay in the crypto you already hold.</h2>
          <p className="pt-lead">
            Lock funds in stablecoins for a fixed price, or use major tokens across leading
            networks.
          </p>
        </Reveal>
        <div className="pt-chips">
          {[
            "USDC",
            "USDT",
            "DAI",
            "ETH",
            "SOL",
            "BTC (wrapped)",
            "Ethereum",
            "Base",
            "Arbitrum",
            "Polygon",
            "Solana",
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
          <h2 className="pt-h2">Lock the deal. Ship the work. Get paid.</h2>
          <p className="pt-lead">
            Join the marketplace where every job is backed by escrow and every payout is backed by
            proof.
          </p>
          <div
            className="pt-cta-cards"
            style={{ maxWidth: 1020, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}
          >
            <Link href="/post-job" className="pt-cta-card">
              <b>
                Post a job <span className="ar">→</span>
              </b>
              <span>
                Define deliverables and milestones, choose stablecoins, and lock your budget.
              </span>
            </Link>
            <Link href="/marketplace" className="pt-cta-card">
              <b>
                Explore the marketplace <span className="ar">→</span>
              </b>
              <span>
                Browse funded jobs, deliver great work, and get paid the moment AI approves.
              </span>
            </Link>
            <Link href="/html/index.html" className="pt-cta-card">
              <b>
                Launch Workspace <span className="ar">→</span>
              </b>
              <span>
                Enter the full Client or Worker dashboard to track escrows, AI reviews, and
                analytics.
              </span>
            </Link>
          </div>
        </Reveal>
      </section>

      <SiteFooter />
    </div>
  );
}
