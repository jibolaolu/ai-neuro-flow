import { cookies } from "next/headers";
import Link from "next/link";
import type { ReactNode } from "react";

import { ClinicalSidebarIcon } from "./clinical-sidebar-icons";
import { InactivityGuard } from "./inactivity-guard";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { MobileNavDrawer } from "./mobile-nav-drawer";
import { PushNotificationManager } from "./push-notification-manager";
import { PwaInstallPrompt } from "./pwa-install-prompt";
import { SwUpdateBanner } from "./sw-update-banner";
import { SESSION_START_COOKIE, type MockRoleKey } from "../lib/mock-auth";
import { BRAND } from "../lib/branding";

type NavItem = {
  href: string;
  label: string;
  icon: string;
  count?: string;
  active?: boolean;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

export async function RoleDashboardShell({
  role,
  roleLabel,
  sectionLabel,
  title,
  navGroups,
  children,
}: {
  role: MockRoleKey;
  roleLabel: string;
  sectionLabel: string;
  title: string;
  navGroups: NavGroup[];
  children: ReactNode;
}) {
  const cookieStore = await cookies();
  const userName =
    cookieStore.get("neuroflow_user")?.value ??
    cookieStore.get("neuroaccess_user")?.value ??
    roleLabel;
  const hasToken = !!(
    cookieStore.get("neuroflow_token")?.value ?? cookieStore.get("neuroaccess_token")?.value
  );
  const sessionStartedAt = Number(cookieStore.get(SESSION_START_COOKIE)?.value);

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const clinicalPortal = role === "clinician" || role === "senior-clinician";

  return (
    <main className={`dashboard-app-shell${clinicalPortal ? " dashboard-app-shell--clinical" : ""}`}>
      <InactivityGuard
        role={role}
        sessionStartedAt={Number.isFinite(sessionStartedAt) ? sessionStartedAt : undefined}
      />
      <section className="dashboard-shell">
        <aside className="dashboard-sidebar">
          <div className="dashboard-sidebar-brand">
            <span className="dashboard-sidebar-mark">N</span>
            <div>
              <strong>{BRAND.name}</strong>
              <small>Clinical Platform</small>
            </div>
          </div>

          {navGroups.map((group) => (
            <div className="dashboard-sidebar-group" key={group.label}>
              <span className="dashboard-sidebar-label">{group.label}</span>
              <nav
                className="dashboard-sidebar-nav"
                aria-label={`${roleLabel} navigation ${group.label}`}
              >
                {group.items.map((item) => (
                  <Link
                    className={`dashboard-nav-link ${item.active ? "dashboard-nav-link-active" : ""}`}
                    href={item.href}
                    key={`${item.label}-${item.href}`}
                  >
                    <span className="dashboard-nav-link-main">
                      <span className={`dashboard-nav-icon${clinicalPortal ? " dashboard-nav-icon--clinical" : ""}`}>
                        {clinicalPortal ? <ClinicalSidebarIcon label={item.label} /> : item.icon}
                      </span>
                      <span>{item.label}</span>
                    </span>
                    {item.count && (
                      <span className="dashboard-nav-count">{item.count}</span>
                    )}
                  </Link>
                ))}
              </nav>
            </div>
          ))}

          <div className="dashboard-sidebar-foot">
            <span className="dashboard-sidebar-label">Account</span>
            <p>
              Signed in as <strong>{userName}</strong>
            </p>
            <Link className="dashboard-sidebar-cta" href="/api/auth/logout">
              Sign Out
            </Link>
          </div>
        </aside>

        <section className="dashboard-main">
          <SwUpdateBanner />
          <PwaInstallPrompt />
          <header className={`dashboard-topbar ${clinicalPortal ? "dashboard-topbar--clinical" : ""}`}>
            <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 10 }}>
              <MobileNavDrawer
                navGroups={navGroups}
                brandName={BRAND.name}
                userName={userName}
                logoutHref="/api/auth/logout"
              />
              <div>
                <span className="dashboard-breadcrumb">
                  {BRAND.name} / {sectionLabel}
                </span>
                <span className="dashboard-date">{today}</span>
                {title && <h1>{title}</h1>}
              </div>
            </div>
            <div className="dashboard-topbar-side">
              {clinicalPortal ? (
                <div className="dashboard-topbar-clinical-actions" aria-label="Quick actions">
                  <button type="button" className="dashboard-icon-btn" aria-label="Notifications (coming soon)">
                    <span className="dashboard-icon-bell" aria-hidden />
                  </button>
                  <span className="dashboard-avatar-chip" title={userName}>
                    <span className="dashboard-avatar-silhouette" aria-hidden />
                  </span>
                </div>
              ) : (
                <div className="dashboard-operator-card">
                  <span
                    className="dashboard-operator-tag"
                    style={{ marginBottom: 4 }}
                  >
                    {roleLabel}
                  </span>
                  <strong>{userName}</strong>
                  <small>{today}</small>
                </div>
              )}
            </div>
          </header>

          {/* Session warning — shown when JWT cookie is missing */}
          {!hasToken && (
            <div className="session-warning-banner">
              <span className="session-warning-icon" aria-hidden>⚠️</span>
              <div>
                <strong>Session not authenticated</strong>
                <p>Your session token is missing. Some data may not load correctly.</p>
              </div>
              <Link
                href={`/auth/mock?role=${role}&next=${encodeURIComponent("/" + role.replace("clinic-admin", "clinic-admin"))}`}
                className="session-warning-btn"
              >
                Re-authenticate as {roleLabel}
              </Link>
            </div>
          )}

          <div className="dashboard-content">
            <PushNotificationManager />
            {children}
          </div>
          <MobileBottomNav role={role as "clinician" | "senior-clinician" | "clinic-admin" | "super-platform-admin"} />
        </section>
      </section>
    </main>
  );
}
