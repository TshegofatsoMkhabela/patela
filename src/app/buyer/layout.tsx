import type { ReactNode } from "react";
import Image from "next/image";
import { Icon } from "@/components/buyer/Icon";
import "@/styles/buyer-dashboard.css";

const NAV = [
  { href: "/buyer", label: "Overview", icon: "M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z", current: true },
  {
    href: "/html/orders.html",
    label: "Orders",
    icon: "M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8",
  },
  {
    href: "/html/shipment-overview.html",
    label: "Shipments",
    icon: "M3 6h11v10H3zM14 9h4l3 3v4h-7M5.2 17.5a1.8 1.8 0 1 0 3.6 0 1.8 1.8 0 1 0-3.6 0M15.2 17.5a1.8 1.8 0 1 0 3.6 0 1.8 1.8 0 1 0-3.6 0",
  },
  {
    href: "/html/payments.html",
    label: "Payments",
    icon: "M5 6h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM16 12.5h2M3 10h18",
  },
  {
    href: "/html/documents-evidence.html",
    label: "Documents",
    icon: "M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6",
  },
  { href: "/html/dispute-centre.html", label: "Disputes", icon: "M5 21V4M5 4h11l-2 4 2 4H5" },
];

export default function BuyerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bd-page">
      <nav className="bd-nav" aria-label="Buyer navigation">
        <div className="bd-brand">
          <Image src="/patela-logo.png" alt="Patela" width={150} height={24} priority />
          <span className="bd-label">Buyer workspace</span>
        </div>
        <ul className="bd-nav-list">
          {NAV.map((n) => (
            <li key={n.href}>
              <a href={n.href} aria-current={n.current ? "page" : undefined}>
                <Icon d={n.icon} />
                <span>{n.label}</span>
              </a>
            </li>
          ))}
        </ul>
        <div className="bd-account">
          <span className="bd-strong">Ndlovu Home Stores</span>
          <span className="bd-small bd-muted">Buyer · Demo account</span>
        </div>
      </nav>
      <main className="bd-main">{children}</main>
    </div>
  );
}
