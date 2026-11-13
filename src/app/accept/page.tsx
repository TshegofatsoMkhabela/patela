"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

// Invitation emails link to /accept?token=… (backend orders.ts); the page lives at /accept/[token].
function Redirect() {
  const router = useRouter();
  const token = useSearchParams().get("token");
  useEffect(() => {
    if (token) router.replace(`/accept/${encodeURIComponent(token)}`);
  }, [router, token]);
  return <p className="p-8">{token ? "Opening your invitation…" : "This invitation link has no token."}</p>;
}

export default function AcceptRedirectPage() {
  return (
    <Suspense fallback={<p className="p-8">Opening your invitation…</p>}>
      <Redirect />
    </Suspense>
  );
}
