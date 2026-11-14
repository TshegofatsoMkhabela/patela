"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { KeyRound, Mail } from "lucide-react";
import { toast } from "sonner";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { useBackendTask } from "@/hooks/use-backend-task";
import { isEmail, isOtpCode, patelaApi, saveAuthUser, toAuthUser } from "@/lib/patela-api";
import "@/styles/journey-auth.css";

type Method = "code" | "password";

function GoogleMark() {
  return (
    <svg className="pa-social-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M21.35 12.25c0-.73-.06-1.42-.18-2.09H12v3.95h5.24a4.48 4.48 0 0 1-1.95 2.94v2.44h3.16c1.85-1.7 2.9-4.2 2.9-7.24Z"
      />
      <path
        fill="#34A853"
        d="M12 21.5c2.64 0 4.85-.87 6.47-2.35l-3.16-2.44c-.88.59-2 .95-3.31.95-2.55 0-4.72-1.72-5.5-4.03H3.25v2.51A9.5 9.5 0 0 0 12 21.5Z"
      />
      <path
        fill="#FBBC05"
        d="M6.5 13.63a5.7 5.7 0 0 1 0-3.26V7.86H3.25a9.5 9.5 0 0 0 0 8.28l3.25-2.51Z"
      />
      <path
        fill="#EA4335"
        d="M12 6.34c1.44 0 2.72.5 3.74 1.46l2.8-2.8A9.1 9.1 0 0 0 12 2.5a9.5 9.5 0 0 0-8.75 5.36l3.25 2.51c.78-2.31 2.95-4.03 5.5-4.03Z"
      />
    </svg>
  );
}

function MetaMaskMark() {
  return (
    <svg className="pa-social-icon" viewBox="0 0 32 32" aria-hidden="true">
      <path fill="#E2761B" d="M29 3 18 11l2 5 8-3 1-10ZM3 3l11 8-2 5-8-3L3 3Z" />
      <path fill="#F6851B" d="m28 13-8 3 2 6 6-1V13ZM4 13v8l6 1 2-6-8-3Z" />
      <path fill="#763D16" d="m10 22 4 3 2-2-4-7-2 6Zm12 0-4 3-2-2 4-7 2 6Z" />
      <path fill="#E4761B" d="m14 25-4-3-3 2 5 4 2-3Zm4 0 4-3 3 2-5 4-2-3Z" />
      <path fill="#C0AD9E" d="m12 28 4 2 4-2-2-3h-4l-2 3Z" />
      <path fill="#F6851B" d="m12 16 4 3 4-3-2-5h-4l-2 5Z" />
    </svg>
  );
}

/** Post-sign-in destination: a same-site `?next=` path (e.g. /orders/new), else the dashboard. */
function nextPath(): string {
  const next =
    typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/buyer";
}

export function SignInView() {
  const router = useRouter();
  const [method, setMethod] = useState<Method>("code");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, runBackend] = useBackendTask("Sign-in failed. Try again.");

  function resetCode() {
    setCodeSent(false);
    setCode("");
  }

  function enter(user: Record<string, unknown>, message: string) {
    if (!saveAuthUser(user)) {
      toast.error("This browser could not save your session.");
      return;
    }
    toast.success(message);
    router.push(nextPath());
  }

  // Demo only: the backend has no password sign-in.
  function demoPasswordSignIn() {
    enter(
      {
        fullName: email.split("@")[0],
        email,
        role: "buyer",
        roleTitle: "Commercial Buyer / Consignor",
        verified: true,
        source: "demo",
        signedInAt: new Date().toISOString(),
      },
      "Signed in to the Patela demo workspace.",
    );
  }

  function handleGoogle(credential: string) {
    runBackend(async () => {
      const profile = await patelaApi.googleSignIn(credential);
      enter(toAuthUser(profile), "Signed in with Google.");
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const address = email.trim();
    if (!isEmail(address)) {
      toast.error("Enter a valid email address.");
      return;
    }
    if (method === "password") {
      if (!password) {
        toast.error("Enter your password.");
        return;
      }
      demoPasswordSignIn();
      return;
    }
    if (!codeSent) {
      runBackend(async () => {
        await patelaApi.requestOtp(address);
        setCodeSent(true);
        toast.info("Code requested. Enter the 6-digit code to continue.");
      });
      return;
    }
    if (!isOtpCode(code)) {
      toast.error("Enter the 6-digit code.");
      return;
    }
    runBackend(async () => {
      const profile = await patelaApi.verifyOtp(address, code);
      enter(toAuthUser(profile), "Signed in to Patela.");
    });
  }

  const submitLabel = busy
    ? "Please wait…"
    : method === "password"
      ? "Sign in (demo)"
      : codeSent
        ? "Verify code"
        : "Send code";

  return (
    <main className="pa-page">
      <div className="pa-shell">
        <Link href="/" className="pa-brand" aria-label="Patela home">
          <Image src="/patela-logo.png" alt="Patela" width={252} height={41} priority />
        </Link>
        <h1>Sign in to your account</h1>
        <div className="pa-card">
          <form onSubmit={handleSubmit}>
            <div className="pa-tabs" role="group" aria-label="Sign in method">
              <button
                type="button"
                aria-pressed={method === "code"}
                className={method === "code" ? "active" : ""}
                onClick={() => {
                  setMethod("code");
                  resetCode();
                }}
              >
                <Mail size={17} /> Email code
              </button>
              <button
                type="button"
                aria-pressed={method === "password"}
                className={method === "password" ? "active" : ""}
                onClick={() => setMethod("password")}
              >
                <KeyRound size={17} /> Password (demo)
              </button>
            </div>
            <label htmlFor="pa-email">Email</label>
            <input
              id="pa-email"
              type="email"
              autoComplete="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                resetCode();
              }}
              required
            />
            {method === "password" ? (
              <>
                <label htmlFor="pa-password" className="pa-secondary-label">
                  Password
                </label>
                <input
                  id="pa-password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <p className="pa-help">
                  Demo only: any password opens a local demo session. It does not sign you in to the
                  Patela server.
                </p>
              </>
            ) : codeSent ? (
              <>
                <label htmlFor="pa-code" className="pa-secondary-label">
                  Sign-in code
                </label>
                <input
                  id="pa-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="Enter the 6-digit code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                />
                <p className="pa-help">
                  The code is valid for 10 minutes.{" "}
                  <button type="button" className="pa-link" onClick={resetCode}>
                    Use a different email
                  </button>
                </p>
              </>
            ) : (
              <p className="pa-help">
                We&apos;ll send a 6-digit code to this email. Preview: code emails are queued in the
                server&apos;s outbox and not delivered yet.
              </p>
            )}
            <button className="pa-submit" type="submit" disabled={busy}>
              {submitLabel}
            </button>
          </form>
          <div className="pa-divider">
            <span>Or continue with</span>
          </div>
          <div className="pa-social">
            <GoogleSignInButton
              onCredential={handleGoogle}
              fallback={
                <>
                  <GoogleMark /> Continue with Google
                </>
              }
            />
            <button
              type="button"
              onClick={() => toast.info("MetaMask sign-in is not connected in this demo.")}
            >
              <MetaMaskMark /> Continue with MetaMask
            </button>
          </div>
        </div>
        <p className="pa-signup">
          Don&apos;t have an account? <Link href="/signup">Sign up</Link>
        </p>
        <p className="pa-demo">
          Patela product preview · Email code and Google use the Patela server · Password is a demo
        </p>
      </div>
    </main>
  );
}
