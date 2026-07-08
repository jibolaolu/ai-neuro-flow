"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { haptic } from "../lib/haptics";

type BottomNavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  matchPrefix?: string;
};

// ── SVG icon helpers ──────────────────────────────────────────────────────────
function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  );
}
function UsersIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
    </svg>
  );
}
function CalIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  );
}
function DocIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  );
}
function RefIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 1 21 5 17 9"/>
      <path d="M3 11V9a4 4 0 014-4h14"/>
      <polyline points="7 23 3 19 7 15"/>
      <path d="M21 13v2a4 4 0 01-4 4H3"/>
    </svg>
  );
}
function InvIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23"/>
      <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
    </svg>
  );
}

// ── Role-based nav configs ────────────────────────────────────────────────────

type RoleKey = "clinician" | "senior-clinician" | "clinic-admin" | "super-platform-admin";

const NAV_CONFIGS: Record<RoleKey, (active: (href: string, prefix?: string) => boolean) => BottomNavItem[]> = {
  "clinician": (a) => [
    { href: "/clinician",          label: "Home",     icon: <HomeIcon  active={a("/clinician", "/clinician")} />,        matchPrefix: "/clinician" },
    { href: "/clinician/clients",  label: "Clients",  icon: <UsersIcon active={a("/clinician/clients")} />,               matchPrefix: "/clinician/clients" },
    { href: "/clinician/calendar", label: "Calendar", icon: <CalIcon   active={a("/clinician/calendar")} />,              matchPrefix: "/clinician/calendar" },
    { href: "/clinician/reports",  label: "Reports",  icon: <DocIcon   active={a("/clinician/reports")} />,               matchPrefix: "/clinician/reports" },
  ],
  "senior-clinician": (a) => [
    { href: "/senior-clinician",         label: "Home",    icon: <HomeIcon  active={a("/senior-clinician")} /> },
    { href: "/clinician/clients",        label: "Clients", icon: <UsersIcon active={a("/clinician/clients")} /> },
    { href: "/senior-clinician/reports", label: "Reports", icon: <DocIcon   active={a("/senior-clinician/reports")} /> },
  ],
  "clinic-admin": (a) => [
    { href: "/clinic-admin",            label: "Home",      icon: <HomeIcon active={a("/clinic-admin")} /> },
    { href: "/clinic-admin/clients",    label: "Clients",   icon: <UsersIcon active={a("/clinic-admin/clients")} />,   matchPrefix: "/clinic-admin/clients" },
    { href: "/clinic-admin/referrals",  label: "Referrals", icon: <RefIcon   active={a("/clinic-admin/referrals")} />, matchPrefix: "/clinic-admin/referrals" },
    { href: "/clinic-admin/invoices",   label: "Invoices",  icon: <InvIcon   active={a("/clinic-admin/invoices")} />,  matchPrefix: "/clinic-admin/invoices" },
    { href: "/clinic-admin/calendar",   label: "Calendar",  icon: <CalIcon   active={a("/clinic-admin/calendar")} />,  matchPrefix: "/clinic-admin/calendar" },
  ],
  "super-platform-admin": (a) => [
    { href: "/super-admin",         label: "Home",     icon: <HomeIcon  active={a("/super-admin")} /> },
    { href: "/super-admin/clinics", label: "Clinics",  icon: <UsersIcon active={a("/super-admin/clinics")} />, matchPrefix: "/super-admin/clinics" },
    { href: "/super-admin/tickets", label: "Tickets",  icon: <DocIcon   active={a("/super-admin/tickets")} />, matchPrefix: "/super-admin/tickets" },
  ],
};

// ── Component ──────────────────────────────────────────────────────────────────

export function MobileBottomNav({ role }: { role: RoleKey }) {
  const pathname = usePathname() ?? "";

  function isActive(href: string, prefix?: string): boolean {
    if (prefix && prefix !== href) return pathname.startsWith(prefix);
    return pathname === href || pathname.startsWith(href + "/");
  }

  const config = NAV_CONFIGS[role];
  if (!config) return null;
  const items = config(isActive);

  return (
    <nav className="mobile-bottom-nav" aria-label="Main navigation">
      {items.map((item) => {
        const active = isActive(item.href, item.matchPrefix);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`mbn-item ${active ? "mbn-item--active" : ""}`}
            aria-current={active ? "page" : undefined}
            onClick={() => haptic("selection")}
          >
            <span className="mbn-icon">{item.icon}</span>
            <span className="mbn-label">{item.label}</span>
            {active && <span className="mbn-indicator" aria-hidden />}
          </Link>
        );
      })}
    </nav>
  );
}
