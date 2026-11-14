"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, type DemoEmail } from "@/lib/api";

// LOCAL DEMO ONLY: shows what the backend would have emailed (sign-in codes, accept links).
// The backend serves /demo/inbox only with DEMO_MODE, no mail configured and a localhost API.
export default function DemoInboxPage() {
  const [emails, setEmails] = useState<DemoEmail[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;
    const load = () =>
      api.demoInbox().then(
        (r) => !stop && (setEmails(r.emails), setError(null)),
        () =>
          !stop && setError("The demo inbox is only available in the local demo (npm run demo)."),
      );
    void load();
    const t = setInterval(load, 3000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, []);

  return (
    <main
      style={{ maxWidth: 860, margin: "0 auto", padding: "40px 16px", fontFamily: "system-ui" }}
    >
      <p style={{ textTransform: "uppercase", letterSpacing: 1, fontSize: 12, opacity: 0.7 }}>
        Demo
      </p>
      <h1 style={{ margin: "4px 0 8px" }}>Demo inbox</h1>
      <p style={{ opacity: 0.75, marginTop: 0 }}>
        Local demo only: emails are not sent. Sign-in codes and accept links appear here instead.
        Open each persona in its own browser profile or private window.
      </p>
      {error ? <p role="alert">{error}</p> : null}
      {emails && emails.length === 0 ? <p>No emails yet.</p> : null}
      <ul style={{ listStyle: "none", padding: 0 }}>
        {emails?.map((e) => (
          <li
            key={e.id}
            style={{ border: "1px solid #8884", borderRadius: 8, padding: 12, marginBottom: 10 }}
          >
            <div style={{ fontSize: 13, opacity: 0.7 }}>
              {new Date(e.created_at).toLocaleTimeString()} · to {e.to_email} · {e.template}
            </div>
            {e.payload.code ? (
              <div style={{ fontFamily: "monospace", fontSize: 22, marginTop: 4 }}>
                {e.payload.code}
              </div>
            ) : null}
            {e.payload.acceptUrl ? (
              <Link
                href={new URL(e.payload.acceptUrl).pathname + new URL(e.payload.acceptUrl).search}
              >
                Open accept link
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    </main>
  );
}
