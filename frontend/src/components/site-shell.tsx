import Link from "next/link";
import type { ReactNode } from "react";

import { BRAND } from "../lib/branding";

export function SiteShell({
  children,
  accent = "teal",
  hideNav = false,
  hideFooter = false,
}: {
  children: ReactNode;
  accent?: "teal" | "sand" | "slate";
  hideNav?: boolean;
  hideFooter?: boolean;
}) {
  return (
    <div className={`app-shell accent-${accent}`}>
      {!hideNav && <header className="topbar">
        <Link className="brandmark" href="/">
          <span className="brandmark-icon">N</span>
          <span>
            <strong>{BRAND.name}</strong>
            <small>{BRAND.tagline}</small>
          </span>
        </Link>

        <nav className="topnav" aria-label="Primary">
          <Link href="/">Home</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/signup">Start trial</Link>
        </nav>

        <div className="topbar-actions">
          <Link className="ghost-chip" href="/api/auth/login">
            Sign in
          </Link>
        </div>
      </header>}

      {children}

      {!hideFooter && <footer className="site-footer">
        <div>
          <strong>{BRAND.name}</strong>
          <p>
            Multi-tenant clinical platform for ADHD and autism assessment clinics.
            NICE-aligned, GDPR-compliant workflows. Clinics subscribe; patients are
            never charged by the platform.
          </p>
        </div>
        <div className="footer-links">
          <Link href="/">Home</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/signup">Start trial</Link>
          <Link href="/api/auth/login">Sign in</Link>
        </div>
      </footer>}
    </div>
  );
}
