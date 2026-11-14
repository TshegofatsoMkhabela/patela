"use client";

import Script from "next/script";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

type GoogleId = {
  initialize(options: { client_id: string; callback: (r: { credential: string }) => void }): void;
  renderButton(el: HTMLElement, options: Record<string, unknown>): void;
};

const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

/**
 * Google Identity Services only hands out an ID token through its own button,
 * so that button is rendered when a client ID is configured. Without one, the
 * styled placeholder stays and says Google is not set up.
 */
export function GoogleSignInButton({
  onCredential,
  fallback,
  className,
}: {
  onCredential: (credential: string) => void;
  fallback: ReactNode;
  className?: string;
}) {
  const target = useRef<HTMLDivElement>(null);
  const callback = useRef(onCredential);
  const [ready, setReady] = useState(false);
  callback.current = onCredential;

  useEffect(() => {
    // Through unknown: @types/google.maps (from the Maps loader) also declares window.google.
    const google = (window as unknown as { google?: { accounts: { id: GoogleId } } }).google;
    if (!clientId || !ready || !google || !target.current) return;
    google.accounts.id.initialize({
      client_id: clientId,
      callback: ({ credential }) => callback.current(credential),
    });
    google.accounts.id.renderButton(target.current, {
      theme: "outline",
      size: "large",
      text: "continue_with",
      width: target.current.offsetWidth || 320,
    });
  }, [ready]);

  if (!clientId) {
    return (
      <button
        type="button"
        className={className}
        onClick={() =>
          toast.info("Google sign-in needs NEXT_PUBLIC_GOOGLE_CLIENT_ID to be configured.")
        }
      >
        {fallback}
      </button>
    );
  }
  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onReady={() => setReady(true)}
      />
      <div ref={target} className="pa-google" aria-label="Continue with Google" />
    </>
  );
}
