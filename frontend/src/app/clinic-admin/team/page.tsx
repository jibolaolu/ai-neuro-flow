import Link from "next/link";

import { RoleDashboardShell } from "../../../components/role-dashboard-shell";
import { getClinicAdminNav } from "../../../lib/clinic-admin-nav";
import { getTeamClinicians } from "../../../lib/api-server";

function formatRoleLabel(role: string): string {
  if (role === "senior-clinician") return "Senior Clinician";
  if (role === "clinician")        return "Clinician";
  return role.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function roleChip(role: string): string {
  if (role === "senior-clinician") return "team-role-chip team-role-senior";
  if (role === "clinician")        return "team-role-chip team-role-clinician";
  return "team-role-chip team-role-other";
}

export default async function ClinicAdminTeamPage() {
  const items = await getTeamClinicians({ includeInactive: true });

  const active   = items.filter((m) => m.is_active).length;
  const inactive = items.filter((m) => !m.is_active).length;
  const seniors  = items.filter((m) => m.role === "senior-clinician").length;

  return (
    <RoleDashboardShell
      role="clinic-admin"
      roleLabel="Clinical Admin"
      sectionLabel="Your Team"
      title="Clinicians, psychologists, and operations team"
      navGroups={getClinicAdminNav("/clinic-admin/team")}
    >
      <div className="page-shell dashboard-page-shell compact-shell" style={{ paddingTop: 0 }}>

        {/* ── Summary strip ───────────────────────────────────────────────── */}
        <div className="pt-summary-strip" style={{ marginBottom: "var(--space-5)" }}>
          <div className="pt-summary-card pt-summary-card--accent">
            <strong className="pt-summary-value">{active}</strong>
            <span className="pt-summary-label">Active members</span>
          </div>
          <div className="pt-summary-card">
            <strong className="pt-summary-value" style={{ color: "#5b21b6" }}>{seniors}</strong>
            <span className="pt-summary-label">Senior clinicians</span>
          </div>
          <div className="pt-summary-card">
            <strong className="pt-summary-value" style={{ color: "var(--muted)" }}>{inactive}</strong>
            <span className="pt-summary-label">Inactive</span>
          </div>
        </div>

        {/* ── Team table ──────────────────────────────────────────────────── */}
        <section className="workspace-card">
          <div className="workspace-card-header">
            <div>
              <span className="panel-label">Your team</span>
              <h2>Team members</h2>
            </div>
            <div className="button-strip">
              <Link className="ghost-chip" href="/clinic-admin/calendar">View availability</Link>
              <Link className="primary-action" href="/clinic-admin/team/new">Add team member</Link>
            </div>
          </div>

          <div className="data-table-shell">
            <div className="data-table">
              <div className="data-table-head team-table-cols">
                <span>Name</span>
                <span>Role</span>
                <span>Email</span>
                <span>Status</span>
              </div>

              {items.length === 0 ? (
                <div style={{ padding: "2rem", textAlign: "center", color: "var(--muted)" }}>
                  No clinicians listed yet. Users must have the{" "}
                  <strong>clinician</strong> or <strong>senior-clinician</strong> role and be active to appear here.
                  Use <strong>Add team member</strong> or your user directory to create accounts with those roles.
                </div>
              ) : (
                items.map((row) => (
                  <Link
                    key={row.id}
                    className={`data-table-row team-table-cols data-table-link-row${row.is_active ? "" : " team-member-row-inactive"}`}
                    href={`/clinic-admin/team/${row.id}`}
                  >
                    {/* Name + email */}
                    <span className="team-name-cell">
                      <strong className="team-member-name">{row.full_name || row.email}</strong>
                      <small className="team-member-email">{row.email}</small>
                    </span>

                    {/* Role chip */}
                    <span>
                      <span className={roleChip(row.role)}>{formatRoleLabel(row.role)}</span>
                    </span>

                    {/* Email (secondary — hidden on mobile) */}
                    <span className="team-email-col">{row.email}</span>

                    {/* Status */}
                    <span>
                      <span className={`inline-badge ${row.is_active ? "status-good" : "status-neutral"}`}>
                        {row.is_active ? "Active" : "Inactive"}
                      </span>
                    </span>
                  </Link>
                ))
              )}
            </div>
          </div>
        </section>

      </div>
    </RoleDashboardShell>
  );
}
