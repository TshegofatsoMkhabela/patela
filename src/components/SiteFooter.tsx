import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="pt-footer">
      <div>
        <h4>Patella</h4>
        <p>
          B2B order, custody and payment coordination for multi-hop supply chains across South
          Africa. Every handoff accounted for. Every payment governed by agreed rules.
        </p>
      </div>
      <div>
        <h4>Platform &amp; Operations</h4>
        <Link href="/how-it-works">How it works</Link>
        <Link href="/buyer">Orders &amp; RFQs</Link>
        <Link href="/orders/new">Create Order</Link>
        <Link href="/html/route-builder.html">Route Builder</Link>
        <Link href="/html/payment-builder.html">Payment Builder</Link>
        <Link href="/html/guest-handoff.html">Guest Mobile Handoff</Link>
        <Link href="/html/dispute-centre.html">Dispute Centre</Link>
        <Link href="/html/auditor-trail.html">Auditor Trail</Link>
        <Link href="/html/operations-console.html">Operations Console</Link>
        <Link href="/html/index.html">Master Blueprint Hub</Link>
      </div>
      <div>
        <h4>Account &amp; Company</h4>
        <Link href="/signin">Sign In</Link>
        <Link href="/signup">Sign Up (Progressive)</Link>
        <Link href="/about">About</Link>
        <Link href="/careers">Careers</Link>
        <Link href="/contact">Contact</Link>
        <Link href="/faq">FAQ</Link>
      </div>
      <div>
        <h4>Trust &amp; Legal</h4>
        <Link href="/security">Security &amp; Trust Boundaries</Link>
        <Link href="/terms">Terms of Service</Link>
        <Link href="/privacy">Privacy Notice</Link>
      </div>
      <div className="pt-copy">
        © 2026 Patella Technologies (Pty) Ltd. All rights reserved. Escrow settlement facilitated
        via licensed South African banking partners.
      </div>
    </footer>
  );
}
