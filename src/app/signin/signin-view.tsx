"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { SiteNav } from "@/components/SiteNav";
import { Reveal } from "@/components/Reveal";

interface DemoAccount {
  name: string;
  role: string;
  company: string;
  icon: string;
  email: string;
  redirectUrl: string;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    name: "Alex Vance",
    role: "Commercial Buyer / Consignor",
    company: "Anglo African Resources (Pty) Ltd",
    icon: "🏢",
    email: "alex@resources.co.za",
    redirectUrl: "/html/orders.html",
  },
  {
    name: "Dumisani Khumalo",
    role: "Freight Fleet Operator",
    company: "Trans-Limpopo Freight Logistics",
    icon: "🚛",
    email: "dumisani@translimpopo.co.za",
    redirectUrl: "/html/tender-trail.html",
  },
  {
    name: "Johan van der Merwe",
    role: "Commodity Supplier",
    company: "Witbank Minerals & Mining Co",
    icon: "🏭",
    email: "johan@witbankminerals.co.za",
    redirectUrl: "/html/order-detail.html",
  },
  {
    name: "Sipho Ndlovu",
    role: "Frontline Driver / Clerk",
    company: "Cross-Dock Heavy Articulated Driver",
    icon: "🚚",
    email: "sipho.driver@patella.demo",
    redirectUrl: "/html/guest-handoff.html",
  },
  {
    name: "Dr. Nomsa Mthembu",
    role: "Forensic Auditor / Inspector",
    company: "IRBA Registered Compliance Audit",
    icon: "🔍",
    email: "nomsa.audit@deloitte.demo",
    redirectUrl: "/html/auditor-trail.html",
  },
];

export function SignInView() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      toast.error("Please enter a valid email address.");
      return;
    }
    if (!password.trim()) {
      toast.error("Please enter your password.");
      return;
    }

    // Sign in demo session
    const authUser = {
      fullName: email.split("@")[0].toUpperCase(),
      email,
      role: "buyer",
      roleTitle: "Commercial Consignor / Buyer",
      verified: true,
      signedInAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem("patela_auth_user", JSON.stringify(authUser));
    } catch {
      /* safe */
    }

    toast.success(`Welcome back! Signed in as ${email}.`);
    router.push("/html/orders.html");
  }

  function handleDemoLogin(account: DemoAccount) {
    const authUser = {
      fullName: account.name,
      email: account.email,
      company: account.company,
      role: account.role,
      roleTitle: account.role,
      verified: true,
      signedInAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem("patela_auth_user", JSON.stringify(authUser));
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
            {/* Standard Credentials Sign In */}
            <form
              className="pt-form pt-card"
              onSubmit={handleSubmit}
              style={{ padding: "36px 32px", marginTop: 0 }}
            >
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: "1.25rem", margin: "0 0 4px", fontWeight: 600 }}>
                  Account Credentials
                </h2>
                <p style={{ color: "#a2a9b8", fontSize: "0.875rem", margin: 0 }}>
                  Enter your registered enterprise email and password.
                </p>
              </div>

              <div className="pt-field">
                <label htmlFor="si-email">Business Email or Phone</label>
                <input
                  id="si-email"
                  type="email"
                  className="pt-in"
                  placeholder="name@company.co.za"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="pt-field">
                <div
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
                >
                  <label htmlFor="si-pw">Password</label>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      toast.info(
                        "For testnet demo: use any password or click a quick persona below.",
                      );
                    }}
                    style={{ fontSize: "0.8rem", color: "#ffe2b2", textDecoration: "underline" }}
                  >
                    Forgot password?
                  </a>
                </div>
                <input
                  id="si-pw"
                  type="password"
                  className="pt-in"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "6px 0 16px" }}>
                <input
                  type="checkbox"
                  id="rem"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  style={{ accentColor: "#ffe2b2", width: 16, height: 16 }}
                />
                <label
                  htmlFor="rem"
                  style={{ fontSize: "0.85rem", color: "#a2a9b8", cursor: "pointer" }}
                >
                  Remember this device for 30 days
                </label>
              </div>

              <button
                type="submit"
                className="pt-btn"
                style={{ width: "100%", justifyContent: "center", padding: "13px" }}
              >
                <span>Sign In to Workspace</span>
                <span aria-hidden="true">→</span>
              </button>

              <div
                style={{
                  textAlign: "center",
                  marginTop: 22,
                  fontSize: "0.85rem",
                  color: "#a2a9b8",
                }}
              >
                Don&apos;t have an account yet?{" "}
                <Link
                  href="/signup"
                  style={{ color: "#ffe2b2", fontWeight: 600, textDecoration: "underline" }}
                >
                  Sign up with progressive onboarding
                </Link>
              </div>
            </form>

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
                  screens and controls:
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
                      <span style={{ fontSize: "1.4rem" }}>{acc.icon}</span>
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
