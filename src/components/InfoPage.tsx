"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { Reveal } from "@/components/Reveal";

export function InfoPage({
  eyebrow,
  title,
  lead,
  children,
  cta = true,
  centerTitle = false,
}: {
  eyebrow?: string;
  title: string;
  lead: string;
  children: ReactNode;
  cta?: boolean;
  centerTitle?: boolean;
}) {
  return (
    <div className="pt-app">
      <SiteNav />
      <main className="pt-wrap" style={{ maxWidth: 1120 }}>
        <Reveal style={centerTitle ? { textAlign: "center" } : undefined}>
          {eyebrow ? <span className="pt-eyebrow">{eyebrow}</span> : null}
          <h1
            className="pt-h2"
            style={{
              fontSize: "clamp(36px,5vw,60px)",
              ...(centerTitle
                ? { textAlign: "center", marginInline: "auto", maxWidth: "24ch" }
                : {}),
            }}
          >
            {title}
          </h1>
          <p className="pt-lead" style={centerTitle ? { marginInline: "auto" } : undefined}>
            {lead}
          </p>
        </Reveal>
        {children}
        {cta && (
          <Reveal className="pt-cta-big pt-mt">
            <h2 className="pt-h2">Coordinate custody. Release on verified rules.</h2>
            <div
              className="pt-cta-cards"
              style={{
                maxWidth: 1020,
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              }}
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
                  Explore all 28 enterprise supply-chain screens, demo narrative, and auditor
                  console.
                </span>
              </Link>
            </div>
          </Reveal>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

export function Cards({
  items,
  cols = 3,
}: {
  items: { t: string; p: string; n?: string }[];
  cols?: 2 | 3 | 4;
}) {
  return (
    <div className={`pt-grid pt-g${cols}`}>
      {items.map((it, i) => (
        <Reveal className="pt-card" key={it.t} delay={(i % cols) * 90}>
          {it.n && <span className="pt-num">{it.n}</span>}
          <h3>{it.t}</h3>
          <p>{it.p}</p>
        </Reveal>
      ))}
    </div>
  );
}

export function Prose({ sections }: { sections: { h: string; p: string[] }[] }) {
  return (
    <div className="pt-prose">
      {sections.map((s, i) => (
        <Reveal key={s.h} delay={i * 40}>
          <h2>{s.h}</h2>
          {s.p.map((x) => (
            <p key={x}>{x}</p>
          ))}
        </Reveal>
      ))}
    </div>
  );
}
