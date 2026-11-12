"use client";

import Link from "next/link";
import { SiteNav } from "@/components/SiteNav";
import { Reveal } from "@/components/Reveal";
import { usePatela } from "@/lib/patela-store";

export function MarketplaceView() {
  const { jobs } = usePatela();
  return (
    <div className="pt-app">
      <SiteNav />
      <main className="pt-wrap" style={{ maxWidth: 1180 }}>
        <Reveal>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              gap: 20,
              flexWrap: "wrap",
            }}
          >
            <div>
              <span className="pt-eyebrow">Commercial Orders & Corridors</span>
              <h1 className="pt-h2">Active orders, guaranteed in escrow.</h1>
              <p className="pt-lead">
                Every consignment has its budget locked in smart contract escrow or bank trust.
                Explore active multi-hop corridors, bid on freight RFQs, and track verified
                handoffs.
              </p>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link href="/html/orders.html" className="pt-btn sm">
                <span>Orders & RFQs</span>
                <span aria-hidden="true">→</span>
              </Link>
              <Link href="/html/tender-trail.html" className="pt-btn ghost sm">
                <span>Tender Trail (RFQ)</span>
                <span aria-hidden="true">↗</span>
              </Link>
              <Link href="/html/partner-directory.html" className="pt-btn ghost sm">
                <span>Carrier Directory</span>
                <span aria-hidden="true">↗</span>
              </Link>
            </div>
          </div>
        </Reveal>
        <div className="pt-jobs">
          {jobs.map((j, i) => {
            const done = j.milestones.filter((m) => m.status === "approved").length;
            const isSupplyChain = j.id === "ORD-2026-8941" || j.coins.includes("ZARP");
            return (
              <Reveal key={j.id} delay={i * 80}>
                <Link
                  href={isSupplyChain ? `/html/order-detail.html?order=${j.id}` : `/jobs/${j.id}`}
                  className="pt-card pt-job"
                  style={
                    isSupplyChain
                      ? {
                          borderColor: "rgba(217, 195, 154, 0.4)",
                          background:
                            "linear-gradient(135deg, rgba(217, 195, 154, 0.08) 0%, rgba(2, 6, 15, 0.75) 100%)",
                        }
                      : undefined
                  }
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <span className={`pt-badge ${j.funded ? "funded" : "unfunded"}`}>
                      {j.funded ? "Escrow funded" : "Awaiting escrow"}
                    </span>
                    {isSupplyChain && (
                      <span
                        className="pt-badge"
                        style={{
                          background: "rgba(150, 196, 244, 0.15)",
                          color: "#96c4f4",
                          borderColor: "rgba(150, 196, 244, 0.3)",
                        }}
                      >
                        Multi-Hop Supply Chain · ZAR / ZARP
                      </span>
                    )}
                  </div>
                  <h3>{j.title}</h3>
                  <p>{j.scope.length > 130 ? j.scope.slice(0, 130) + "…" : j.scope}</p>
                  <div className="pt-meta">
                    <span className="pt-tag" style={{ color: "#ffe2b2", fontWeight: 600 }}>
                      R {j.budget.toLocaleString()} {j.coins[0]}
                    </span>
                    <span className="pt-tag">
                      {done}/{j.milestones.length} tranches released
                    </span>
                    {j.coins.map((c) => (
                      <span className="pt-tag" key={c}>
                        {c}
                      </span>
                    ))}
                    {isSupplyChain && (
                      <span className="pt-tag" style={{ marginLeft: "auto", color: "#96c4f4" }}>
                        View Canonical Agreement & Route →
                      </span>
                    )}
                  </div>
                </Link>
              </Reveal>
            );
          })}
        </div>
      </main>
    </div>
  );
}
