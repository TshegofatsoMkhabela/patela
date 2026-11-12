"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";

export const SOLUTIONS = [
  {
    to: "/for-clients",
    t: "For buyers & consignors",
    d: "Deposit Rand into licensed bank trust; release on verified delivery.",
  },
  {
    to: "/for-workers",
    t: "For suppliers & carriers",
    d: "Guaranteed locked funds before dispatch; zero-app mobile handoffs.",
  },
  {
    to: "/html/orders.html",
    t: "Orders & Agreements",
    d: "Dual-signed canonical agreements, split parcels, and tender bidding.",
  },
  {
    to: "/html/shipment-overview.html",
    t: "Multi-hop custody",
    d: "Live route graphs, active custody holders, and parcel tracking.",
  },
  {
    to: "/html/dispute-centre.html",
    t: "Dispute centre",
    d: "Isolated parcel holding and commercial exception triage.",
  },
  {
    to: "/html/auditor-trail.html",
    t: "Auditor trail",
    d: "Read-only forensic event log and Base Sepolia block anchor verifier.",
  },
  {
    to: "/security",
    t: "Trust & security",
    d: "Honest trust disclosures, Base Sepolia EscrowVault, and bank accounts.",
  },
] as const;

/**
 * Solutions nav item. Mouse: opens on hover. Touch: tap toggles.
 * Keyboard: Enter/Space/ArrowDown opens and focuses the first item, arrows/Home/End move,
 * Escape closes and returns focus to the trigger, Tab away closes.
 * Always closes on outside click/tap and on navigation.
 */
export function SolutionsMenu({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const path = usePathname();
  const inSection = SOLUTIONS.some((s) => s.to === path);

  const items = () =>
    Array.from(ref.current?.querySelectorAll<HTMLAnchorElement>(".pt-dd-item") ?? []);
  const focusItem = (i: number) => {
    const list = items();
    if (!list.length) return;
    list[(i + list.length) % list.length]?.focus();
  };
  const openAndFocus = (i: number) => {
    setOpen(true);
    requestAnimationFrame(() => focusItem(i));
  };
  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) trigger.current?.focus();
  };

  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  function onTriggerKey(e: KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openAndFocus(0);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      openAndFocus(-1);
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      close(true);
    }
  }

  function onPanelKey(e: KeyboardEvent) {
    const list = items();
    const i = list.indexOf(document.activeElement as HTMLAnchorElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      focusItem(i + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusItem(i - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      focusItem(0);
    } else if (e.key === "End") {
      e.preventDefault();
      focusItem(-1);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close(true);
    }
  }

  return (
    <div
      ref={ref}
      className={`pt-dd ${open ? "open" : ""} ${className}`}
      onPointerEnter={(e) => e.pointerType === "mouse" && setOpen(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setOpen(false)}
      onBlur={(e) => {
        if (!ref.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        className={`pt-dd-trigger ${inSection ? "on" : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="solutions-menu"
        onClick={(e) => {
          if (e.detail === 0) return;
          setOpen((o) => !o);
        }}
        onKeyDown={onTriggerKey}
      >
        <span>Solutions</span>
        <svg className="caret" viewBox="0 0 9 6" aria-hidden="true">
          <path d="M0.7 1.1 L4.5 4.6 L8.3 1.1" />
        </svg>
      </button>
      <div
        className="pt-dd-panel"
        role="menu"
        id="solutions-menu"
        aria-label="Solutions"
        onKeyDown={onPanelKey}
      >
        {SOLUTIONS.map((s) => (
          <Link
            key={s.to}
            href={s.to}
            className={`pt-dd-item ${path === s.to ? "on" : ""}`}
            role="menuitem"
            tabIndex={open ? 0 : -1}
            aria-current={path === s.to ? "page" : undefined}
            onClick={() => setOpen(false)}
          >
            <b>{s.t}</b>
            <span>{s.d}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
