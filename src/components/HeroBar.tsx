"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type MouseEvent } from "react";
import { SolutionsMenu } from "@/components/SolutionsMenu";

export const VIDEO =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260912_104303_0c6d60b2-9353-408e-9449-585108a22fb5.mp4";
export const POSTER =
  "https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/130837c4-0244-4f37-9c61-8d801d93fd29.jpg";

let refocusAfterNav = false;

/** The site-wide top bar (same on the home page and every other page). */
export function HeroBar() {
  const pathname = usePathname();
  const toggle = useRef<HTMLInputElement>(null);
  const closeMenu = (navigating = false) => {
    const t = toggle.current;
    if (!t?.checked) return;
    t.checked = false;
    if (navigating) refocusAfterNav = true;
    t.focus({ preventScroll: true });
  };
  // Close the phone menu after a page link is chosen and hand focus back to the menu button.
  const onPanelClick = (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest("a")) closeMenu(true);
  };
  useEffect(() => {
    if (refocusAfterNav) {
      refocusAfterNav = false;
      toggle.current?.focus({ preventScroll: true });
    }
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  return (
    <header className="bar">
      <Link className="brand" href="/">
        <svg viewBox="0 0 23 17" aria-hidden="true">
          <path d="M8.15 0.9 L4.55 0.9 L0.5 9.3 L4.1 9.3 Z" />
          <path d="M17.0 0 L13.4 0 L6.15 16.4 L9.75 16.4 Z" />
          <path d="M22.9 0 L19.3 0 L15.0 7.6 L18.6 7.6 Z" />
          <path d="M22.6 6.9 L19.0 6.9 L14.05 16.4 L17.65 16.4 Z" />
        </svg>
        <span id="word">PATELLA</span>
      </Link>
      <input
        ref={toggle}
        className="navtoggle"
        type="checkbox"
        id="nav-open"
        aria-label="Open menu"
      />
      <label className="scrim" htmlFor="nav-open" aria-hidden="true" />
      <label className="burger" htmlFor="nav-open" aria-label="Menu">
        <svg viewBox="0 0 22 14">
          <path className="b1" d="M1 1 H21" />
          <path className="b2" d="M1 7 H21" />
          <path className="b3" d="M1 13 H21" />
        </svg>
      </label>
      <div className="navpanel" onClick={onPanelClick}>
        <nav className="menu">
          <Link href="/how-it-works" className={pathname === "/how-it-works" ? "on" : ""}>
            <span>How it works</span>
          </Link>
          <Link href="/buyer" className={pathname === "/buyer" ? "on" : ""}>
            <span>Orders &amp; Custody</span>
          </Link>
          <SolutionsMenu />
        </nav>
        <Link className={`login ${pathname === "/signin" ? "on" : ""}`} href="/signin">
          <span>Sign In</span>
        </Link>
        <Link className="login" href="/buyer">
          <span>Workspace</span>
          <svg className="navarrow" viewBox="0 0 10 9" aria-hidden="true">
            <path d="M0 4.5 H9.1 M5.4 0.9 L9.2 4.5 L5.4 8.1" />
          </svg>
        </Link>
        <Link
          className={`pill ${pathname === "/signup" ? "on" : ""}`}
          href="/signup"
          style={{ borderColor: "rgba(255, 228, 182, 0.6)", color: "#ffe2b2" }}
        >
          <span>Sign Up</span>
        </Link>
      </div>
    </header>
  );
}
