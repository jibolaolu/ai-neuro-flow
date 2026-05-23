import Link from "next/link";

import { RoleDashboardShell } from "../../../components/role-dashboard-shell";
import { getClinicAdminNav } from "../../../lib/clinic-admin-nav";

const SETTINGS_SECTIONS: { title: string; description: string; slug: string }[] = [
  {
    slug: "profile",
    title: "My profile",
    description: "Display name and contact details for clinical admin notifications.",
  },
  {
    slug: "workspace",
    title: "Workspace settings",
    description: "Clinic preferences and operational defaults (extended settings API TBD).",
  },
  {
    slug: "billing",
    title: "Billing",
    description: "Financial integrations and contractor payouts reference the Finance area.",
  },
  {
    slug: "insurance",
    title: "Insurance",
    description: "Insurer-facing exports and coding when billing integrations are enabled.",
  },
  {
    slug: "scheduling",
    title: "Scheduling",
    description: "Availability and rota confirmation tie to the Admin calendar and clinician calendars.",
  },
  {
    slug: "trash",
    title: "Trash",
    description: "Retention and archived artefacts when document lifecycle APIs are connected.",
  },
];

export default function ClinicAdminSettingsPage({
  searchParams,
}: {
  searchParams?: { section?: string };
}) {
  const settings = SETTINGS_SECTIONS;

  const activeSection = settings.find((item) => item.slug === searchParams?.section) ?? settings[0]!;

  return (
    <RoleDashboardShell
      role="clinic-admin"
      roleLabel="Clinic Admin"
      sectionLabel="Clinic Settings"
      title="Workspace settings"
      navGroups={getClinicAdminNav("/clinic-admin/settings")}
    >
      <div className="page-shell dashboard-page-shell compact-shell">
        <section className="workspace-card settings-shell settings-shell-wide">
          <div className="workspace-card-header">
            <div>
              <span className="panel-label">Settings</span>
              <h2>Clinic admin configuration</h2>
            </div>
          </div>

          <div className="settings-layout">
            <div className="settings-grid">
              {settings.map((item) => (
                <Link
                  className={`settings-card settings-link-card ${activeSection.slug === item.slug ? "settings-card-active" : ""}`}
                  href={`/clinic-admin/settings?section=${item.slug}`}
                  key={item.slug}
                >
                  <strong>{item.title}</strong>
                  <p>{item.description}</p>
                </Link>
              ))}
            </div>

            <article className="mini-card settings-detail-card">
              <h3>{activeSection.title}</h3>
              <p>{activeSection.description}</p>
              <div className="button-strip">
                <Link className="ghost-chip" href="/clinic-admin">
                  Back to dashboard
                </Link>
                <Link className="ghost-chip" href="/clinic-admin/calendar">
                  Open scheduling
                </Link>
              </div>
            </article>
          </div>
        </section>
      </div>
    </RoleDashboardShell>
  );
}
