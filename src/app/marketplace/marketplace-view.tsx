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
              <span className="pt-eyebrow">Marketplace</span>
              <h1 className="pt-h2">Open jobs, money already on the table.</h1>
              <p className="pt-lead">
                Every funded job has its budget locked in escrow. Pick one, deliver, and get paid
                when the client approves your AI-verified submission.
              </p>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link href="/html/marketplace.html" className="pt-btn ghost sm">
                <span>Worker Find-Work Console</span>
                <span aria-hidden="true">↗</span>
              </Link>
              <Link href="/html/client-dashboard.html" className="pt-btn sm">
                <span>Client Dashboard</span>
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </Reveal>
        <div className="pt-jobs">
          {jobs.map((j, i) => {
            const done = j.milestones.filter((m) => m.status === "approved").length;
            return (
              <Reveal key={j.id} delay={i * 80}>
                <Link href={`/jobs/${j.id}`} className="pt-card pt-job">
                  <span className={`pt-badge ${j.funded ? "funded" : "unfunded"}`}>
                    {j.funded ? "Escrow funded" : "Awaiting escrow"}
                  </span>
                  <h3>{j.title}</h3>
                  <p>{j.scope.length > 110 ? j.scope.slice(0, 110) + "…" : j.scope}</p>
                  <div className="pt-meta">
                    <span className="pt-tag">
                      {j.budget.toLocaleString()} {j.coins[0]}
                    </span>
                    <span className="pt-tag">
                      {done}/{j.milestones.length} milestones
                    </span>
                    {j.coins.map((c) => (
                      <span className="pt-tag" key={c}>
                        {c}
                      </span>
                    ))}
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
