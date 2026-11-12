import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="pt-footer">
      <div>
        <h4>Patela</h4>
        <p>The crypto marketplace where work is escrowed by smart contracts and verified by AI.</p>
      </div>
      <div>
        <h4>Product</h4>
        <Link href="/how-it-works">How it works</Link>
        <Link href="/marketplace">Marketplace</Link>
        <Link href="/post-job">Post a job</Link>
        <Link href="/html/client-dashboard.html">Client dashboard</Link>
        <Link href="/html/worker-dashboard.html">Worker dashboard</Link>
        <Link href="/html/analytics.html">Analytics</Link>
        <Link href="/faq">FAQ</Link>
      </div>
      <div>
        <h4>Company</h4>
        <Link href="/about">About</Link>
        <Link href="/careers">Careers</Link>
        <Link href="/contact">Contact</Link>
      </div>
      <div>
        <h4>Legal</h4>
        <Link href="/terms">Terms</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/security">Security</Link>
      </div>
      <div className="pt-copy">© 2026 Patela. All rights reserved.</div>
    </footer>
  );
}
