"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { SiteNav } from "@/components/SiteNav";
import { Reveal } from "@/components/Reveal";
import { EmailCodeForm } from "./email-code-form";

interface DemoAccount {
  name: string;
  role: string;
  roleCategory: "client" | "worker" | "auditor";
  company: string;
  badgeLabel: string;
  badgeClass: string;
  email: string;
  redirectUrl: string;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    name: "Alex Morgan / Alex Vance",
    role: "Commercial Buyer & Consignor",
    roleCategory: "client",
    company: "Anglo-Bavarian Mineral Trade (Pty) Ltd",
    badgeLabel: "CLIENT",
    badgeClass: "badge badge-gold",
    email: "alex@resources.co.za",
    redirectUrl: "/html/client-dashboard.html",
  },
  {
    name: "Jordan Blake / Dumisani Khumalo",
    role: "Freight Carrier & Fleet Operator",
    roleCategory: "worker",
    company: "Trans-Limpopo Freight Logistics Ltd",
    badgeLabel: "WORKER",
    badgeClass: "badge badge-blue",
    email: "jordan@translimpopo.co.za",
    redirectUrl: "/html/worker-dashboard.html",
  },
  {
    name: "Johan van der Merwe",
    role: "Commodity Supplier & Producer",
    roleCategory: "worker",
    company: "Witbank Minerals & Mining Co",
    badgeLabel: "SUPPLIER",
    badgeClass: "badge badge-blue",
    email: "johan@witbankminerals.co.za",
    redirectUrl: "/html/worker-dashboard.html",
  },
  {
    name: "Sipho Ndlovu",
    role: "Frontline Driver & Custody Clerk",
    roleCategory: "worker",
    company: "Cross-Dock Depot Heavy Haulage",
    badgeLabel: "DRIVER",
    badgeClass: "badge badge-gold",
    email: "sipho.driver@patella.demo",
    redirectUrl: "/html/guest-handoff.html",
  },
  {
    name: "Dr. Nomsa Mthembu",
    role: "Forensic Auditor & Block Verifier",
    roleCategory: "auditor",
    company: "Independent IRBA Registered Audit",
    badgeLabel: "AUDITOR",
    badgeClass: "badge badge-neutral",
    email: "nomsa.audit@deloitte.demo",
    redirectUrl: "/html/auditor-trail.html",
  },
];

export function SignInView() {
  const router = useRouter();

  function handleDemoLogin(account: DemoAccount) {
    const authUser = {
      fullName: account.name,
      email: account.email,
      company: account.company,
      role: account.roleCategory,
      roleTitle: account.role,
      verified: true,
      signedInAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem("patela_auth_user", JSON.stringify(authUser));
      localStorage.setItem(
        "patela_current_role",
        account.roleCategory === "worker" ? "worker" : "client",
      );
    } catch {
      /* safe */
    }

    toast.success(`Signed in as ${account.name} (${account.role})`);
    router.push(account.redirectUrl);
  }

  return (
    <div className="pt-app" style={{ minHeight: "100vh" }}>
      <SiteNav />
      <main className="pt-wrap" style={{ maxWidth: 940, padding: "40px 20px 100px" }}>
        <Reveal>
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <span className="pt-eyebrow">Enterprise Supply Chain Portal</span>
            <h1 className="pt-h2" style={{ margin: "10px auto 14px", maxWidth: "24ch" }}>
              Sign in to your Patella workspace.
            </h1>
            <p className="pt-lead" style={{ margin: "0 auto", maxWidth: "56ch" }}>
              Access active multi-hop orders, manage custody handoffs, review declarative escrow
              tranches, and inspect the Base Sepolia auditor trail.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
              gap: 28,
            }}
          >
            {/* Backend session sign-in (email code) */}
            <EmailCodeForm />

            {/* Quick 1-Click Persona Logins */}
            <div className="pt-card" style={{ padding: "36px 32px" }}>
              <div style={{ marginBottom: 18 }}>
                <span
                  className="badge badge-gold"
                  style={{ fontSize: "0.75rem", marginBottom: 8, display: "inline-block" }}
                >
                  Instant Demo Access
                </span>
                <h2 style={{ fontSize: "1.25rem", margin: "0 0 4px", fontWeight: 600 }}>
                  1-Click Role Login
                </h2>
                <p style={{ color: "#a2a9b8", fontSize: "0.85rem", margin: 0 }}>
                  Switch directly into any verified supply chain role to inspect their dedicated
                  screens and controls (demo preview only: stored in this browser, not signed in to
                  Patela, and not used by the escrow order flow):
                </p>
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                {DEMO_ACCOUNTS.map((acc) => (
                  <div
                    key={acc.name}
                    onClick={() => handleDemoLogin(acc)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 14px",
                      borderRadius: 12,
                      border: "1px solid rgba(196, 214, 232, 0.14)",
                      background: "rgba(255, 255, 255, 0.02)",
                      cursor: "pointer",
                      transition: "all 0.25s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "rgba(255, 228, 182, 0.5)";
                      e.currentTarget.style.background = "rgba(255, 226, 178, 0.08)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "rgba(196, 214, 232, 0.14)";
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.02)";
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span
                        className={acc.badgeClass}
                        style={{ fontSize: "0.7rem", padding: "4px 8px", letterSpacing: "0.04em" }}
                      >
                        {acc.badgeLabel}
                      </span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "#fff" }}>
                          {acc.name}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "#ffe2b2" }}>{acc.role}</div>
                        <div style={{ fontSize: "0.7rem", color: "#7c8596" }}>{acc.company}</div>
                      </div>
                    </div>
                    <span style={{ color: "#ffe2b2", fontSize: "0.85rem", fontWeight: 600 }}>
                      Enter →
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </main>
    </div>
  );
}
