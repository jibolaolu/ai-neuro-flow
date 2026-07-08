"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { haptic } from "../lib/haptics";

type NavItem = { href: string; label: string; icon: string; active?: boolean };
type NavGroup = { label: string; items: NavItem[] };

export function MobileNavDrawer({
  navGroups,
  brandName,
  userName,
  logoutHref,
}: {
  navGroups: NavGroup[];
  brandName: string;
  userName: string;
  logoutHref: string;
}) {
  const [open, setOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const swipeStartX = useRef<number | null>(null);
  const swipeStartY = useRef<number | null>(null);

  // Close on Escape + body scroll lock
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  // Swipe right from left edge to open; swipe left to close
  useEffect(() => {
    function onTouchStart(e: TouchEvent) {
      swipeStartX.current = e.touches[0].clientX;
      swipeStartY.current = e.touches[0].clientY;
    }
    function onTouchEnd(e: TouchEvent) {
      if (swipeStartX.current === null || swipeStartY.current === null) return;
      const dx = e.changedTouches[0].clientX - swipeStartX.current;
      const dy = Math.abs(e.changedTouches[0].clientY - swipeStartY.current);
      swipeStartX.current = null;
      swipeStartY.current = null;
      // Ignore diagonal swipes
      if (dy > 60) return;
      if (!open && dx > 60 && (e.changedTouches[0].clientX - dx) < 40) {
        haptic("selection");
        setOpen(true);
      } else if (open && dx < -60) {
        setOpen(false);
      }
    }
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [open]);

  return (
    <>
      {/* Hamburger button — only visible on mobile */}
      <button
        className="mobile-hamburger"
        aria-label={open ? "Close navigation" : "Open navigation"}
        aria-expanded={open}
        onClick={() => { haptic("tap"); setOpen((o) => !o); }}
      >
        <span className={`hamburger-bar ${open ? "hamburger-bar--top-open" : ""}`} />
        <span className={`hamburger-bar ${open ? "hamburger-bar--mid-open" : ""}`} />
        <span className={`hamburger-bar ${open ? "hamburger-bar--bot-open" : ""}`} />
      </button>

      {/* Overlay backdrop */}
      {open && (
        <div
          className="mobile-nav-overlay"
          aria-hidden
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        ref={drawerRef}
        className={`mobile-nav-drawer ${open ? "mobile-nav-drawer--open" : ""}`}
        aria-hidden={!open}
      >
        {/* Brand header */}
        <div className="mobile-nav-brand">
          <span className="mobile-nav-mark">N</span>
          <div>
            <strong>{brandName}</strong>
            <small>Clinical Platform</small>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="mobile-nav-close"
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        {/* Nav groups */}
        <div className="mobile-nav-body">
          {navGroups.map((group) => (
            <div key={group.label} className="mobile-nav-group">
              <span className="mobile-nav-group-label">{group.label}</span>
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`mobile-nav-link ${item.active ? "mobile-nav-link--active" : ""}`}
                >
                  <span className="mobile-nav-icon">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mobile-nav-foot">
          <span style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.55)" }}>
            Signed in as <strong style={{ color: "rgba(255,255,255,0.85)" }}>{userName}</strong>
          </span>
          <Link href={logoutHref} className="mobile-nav-signout" onClick={() => setOpen(false)}>
            Sign out
          </Link>
        </div>
      </div>
    </>
  );
}
