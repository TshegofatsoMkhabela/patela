"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";

/** Only same-site paths are allowed as the post-sign-in destination. */
export function nextPath(fallback = "/orders/new"): string {
  if (typeof window === "undefined") return fallback;
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}

/** Backend session sign-in: email → 6-digit code → /me. */
export function EmailCodeForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) return setError("Enter a valid email address.");
    setBusy(true);
    setError(null);
    try {
      const res = await api.requestOtp(email.trim());
      setSent(true);
      if (res?.code) {
        setCode(res.code);
        toast.success(`Demo inbox: your code is ${res.code} (filled in).`);
      } else {
        toast.success(`Code sent to ${email.trim()}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) return setError("Enter the 6-digit code from the email.");
    setBusy(true);
    setError(null);
    try {
      await api.verifyOtp(email.trim(), code);
      const me = await api.me();
      toast.success(`Signed in as ${me.email}`);
      router.push(nextPath());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="pt-form pt-card"
      onSubmit={sent ? verifyCode : requestCode}
      style={{ padding: "36px 32px", marginTop: 0 }}
    >
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: "1.25rem", margin: "0 0 4px", fontWeight: 600 }}>
          Sign in with an email code
        </h2>
        <p style={{ color: "#a2a9b8", fontSize: "0.875rem", margin: 0 }}>
          We email you a one-time 6-digit code. New emails get an account automatically.
        </p>
      </div>

      <div className="pt-field">
        <label htmlFor="si-email">Email</label>
        <input
          id="si-email"
          type="email"
          className="pt-in"
          placeholder="name@company.co.za"
          autoComplete="email"
          value={email}
          disabled={sent || busy}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      {sent ? (
        <div className="pt-field">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <label htmlFor="si-code">6-digit code</label>
            <button
              type="button"
              onClick={() => {
                setSent(false);
                setCode("");
                setError(null);
              }}
              style={{
                background: "none",
                border: 0,
                color: "#ffe2b2",
                fontSize: "0.8rem",
                textDecoration: "underline",
                cursor: "pointer",
              }}
            >
              Use another email
            </button>
          </div>
          <input
            id="si-code"
            className="pt-in"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            placeholder="123456"
            value={code}
            disabled={busy}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            autoFocus
            required
          />
        </div>
      ) : null}

      {error ? (
        <p role="alert" style={{ color: "#ff9b8a", fontSize: "0.9rem", margin: "4px 0 12px" }}>
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        className="pt-btn"
        disabled={busy}
        style={{ width: "100%", justifyContent: "center", padding: "13px" }}
      >
        <span>{busy ? "Please wait…" : sent ? "Verify code and sign in" : "Email me a code"}</span>
        <span aria-hidden="true">→</span>
      </button>

      <div style={{ textAlign: "center", marginTop: 22, fontSize: "0.85rem", color: "#a2a9b8" }}>
        Don&apos;t have an account yet?{" "}
        <Link
          href="/signup"
          style={{ color: "#ffe2b2", fontWeight: 600, textDecoration: "underline" }}
        >
          Sign up
        </Link>
      </div>
    </form>
  );
}
