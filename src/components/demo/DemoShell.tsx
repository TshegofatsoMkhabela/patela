import type { ReactNode } from "react";
import Image from "next/image";
import { Icon } from "@/components/buyer/Icon";
import "@/styles/buyer-dashboard.css";
import "@/styles/patela-demo.css";

export const NAV_ICONS = {
  overview: "M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z",
  order: "M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8",
  inbox: "M3 6h18v12H3zM3 7l9 6 9-6",
} as const;

export type NavItem = {
  href: string;
  label: string;
  icon: string;
  current?: boolean;
  /** Static design preview (hard-coded data), not wired to the backend yet. */
  preview?: boolean;
};

export const BUYER_NAV: NavItem[] = [
  { href: "/buyer", label: "Overview", icon: NAV_ICONS.overview },
  { href: "/orders/new", label: "Orders", icon: NAV_ICONS.order },
  {
    href: "/html/shipment-overview.html",
    label: "Shipments",
    icon: "M3 6h11v10H3zM14 9h4l3 3v4h-7M5.2 17.5a1.8 1.8 0 1 0 3.6 0 1.8 1.8 0 1 0-3.6 0M15.2 17.5a1.8 1.8 0 1 0 3.6 0 1.8 1.8 0 1 0-3.6 0",
    preview: true,
  },
  {
    href: "/html/payments.html",
    label: "Payments",
    icon: "M5 6h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM16 12.5h2M3 10h18",
    preview: true,
  },
  {
    href: "/html/documents-evidence.html",
    label: "Documents",
    icon: "M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6",
    preview: true,
  },
  {
    href: "/html/dispute-centre.html",
    label: "Disputes",
    icon: "M5 21V4M5 4h11l-2 4 2 4H5",
    preview: true,
  },
];

/** The buyer-workspace frame (sidebar + main) shared by every laptop page of the demo. */
export function DemoShell({
  workspace = "Buyer workspace",
  nav = BUYER_NAV,
  current,
  account,
  children,
}: {
  workspace?: string;
  nav?: NavItem[];
  /** href of the nav item to mark as the current page */
  current?: string;
  account?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="bd-page">
      <nav className="bd-nav" aria-label={`${workspace} navigation`}>
        <div className="bd-brand">
          <Image src="/patela-logo.png" alt="Patella" width={150} height={24} priority />
          <span className="bd-label">{workspace}</span>
        </div>
        <ul className="bd-nav-list">
          {nav.map((n) => (
            <li key={n.href}>
              <a href={n.href} aria-current={n.href === current ? "page" : undefined}>
                <Icon d={n.icon} />
                <span>{n.label}</span>
                {n.preview ? <span className="dm-preview">Preview</span> : null}
              </a>
            </li>
          ))}
        </ul>
        {account ? <div className="bd-account">{account}</div> : null}
      </nav>
      <main className="bd-main">{children}</main>
    </div>
  );
}

/** Page header: eyebrow, Mona title, optional actions on the right. */
export function PageHeader({
  eyebrow,
  title,
  children,
  actions,
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="bd-header">
      <div className="bd-stack-8" style={{ minWidth: 0 }}>
        <span className="bd-label">{eyebrow}</span>
        <h1 className="bd-h1">{title}</h1>
        {children}
      </div>
      {actions ? <div className="bd-header-side">{actions}</div> : null}
    </header>
  );
}

/** Mobile-first frame for the driver/receiver handoff and payment screens. */
export function PhoneShell({ who, children }: { who?: ReactNode; children: ReactNode }) {
  return (
    <div className="bd-page" style={{ display: "block" }}>
      <div className="dm-phone">
        <div className="dm-phone-col">
          <div className="dm-phone-top">
            <Image src="/patela-logo.png" alt="Patella" width={110} height={18} priority />
            {who ? <span className="bd-label">{who}</span> : null}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
