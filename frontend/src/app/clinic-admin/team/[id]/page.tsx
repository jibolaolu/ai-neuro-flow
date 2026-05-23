import Link from "next/link";
import { notFound } from "next/navigation";

import { ClinicianAdminPanel } from "../../../../components/clinician-admin-panel";
import { RoleDashboardShell } from "../../../../components/role-dashboard-shell";
import { getClinicAdminNav } from "../../../../lib/clinic-admin-nav";
import { getClinicianSlotsForAdmin, getTeamClinician } from "../../../../lib/api-server";

function formatRoleLabel(role: string): string {
  if (role === "senior-clinician") return "Senior clinician";
  if (role === "clinician") return "Clinician";
  return role.replace(/-/g, " ");
}

export default async function ClinicAdminTeamMemberPage({ params }: { params: { id: string } }) {
  const [member, slots] = await Promise.all([getTeamClinician(params.id), getClinicianSlotsForAdmin(params.id)]);
  if (!member) notFound();

  return (
    <RoleDashboardShell
      role="clinic-admin"
      roleLabel="Clinic Admin"
      sectionLabel="Team Member"
      title={member.full_name || member.email}
      navGroups={getClinicAdminNav("/clinic-admin/team")}
    >
      <div className="page-shell dashboard-page-shell compact-shell">
        <section className="client-profile-header">
          <div>
            <Link className="client-breadcrumb" href="/clinic-admin/team">
              Your team
            </Link>
            <h2>{member.full_name || "-"}</h2>
            <div className="info-chip-row">
              <span className="info-chip info-chip-accent">{formatRoleLabel(member.role)}</span>
              <span className={`inline-badge ${member.is_active ? "status-good" : "status-neutral"}`}>
                {member.is_active ? "Active" : "Inactive"}
              </span>
            </div>
          </div>
          <div className="button-strip">
            <Link className="ghost-chip" href="/clinic-admin/calendar">
              Admin calendar &amp; capacity
            </Link>
            <Link className="primary-action" href="/clinic-admin/clients">
              Clients &amp; assignments
            </Link>
          </div>
        </section>

        <section className="workspace-grid">
          <ClinicianAdminPanel member={member} />

          <article className="workspace-card">
            <div className="workspace-card-header">
              <div>
                <span className="panel-label">Scheduling</span>
                <h2>Availability</h2>
              </div>
              <Link className="ghost-chip" href="/clinic-admin/calendar">
                Full calendar
              </Link>
            </div>
            <p style={{ margin: "0 0 1rem", color: "var(--text-muted)", lineHeight: 1.55 }}>
              Slots submitted by this clinician. <strong>Draft</strong> rows can be edited by the clinician until you confirm
              the ISO week; <strong>Confirmed</strong> rota can only be changed from the admin calendar (delete slot there).
            </p>
            <div className="data-table-shell">
              <div className="data-table">
                <div className="data-table-head data-table-documents">
                  <span>Date</span>
                  <span>Window</span>
                  <span>Week</span>
                  <span>Rota</span>
                </div>
                {slots.length === 0 ? (
                  <div className="data-table-row data-table-documents" style={{ padding: "1.25rem", color: "var(--muted)" }}>
                    No availability submitted yet.
                  </div>
                ) : (
                  slots.map((s) => (
                    <div className="data-table-row data-table-documents" key={s.id}>
                      <span>{s.date_iso}</span>
                      <span>
                        {s.start_time} – {s.end_time}
                      </span>
                      <span>{s.week_id ?? "-"}</span>
                      <span>
                        {(s.rota_status ?? "draft") === "confirmed" ? (
                          <span className="inline-badge status-neutral">Confirmed</span>
                        ) : (
                          <span className="inline-badge status-good">Draft</span>
                        )}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </article>

          <article className="workspace-card">
            <div className="workspace-card-header">
              <div>
                <span className="panel-label">Caseload</span>
                <h2>Client assignments</h2>
              </div>
            </div>
            <p style={{ margin: "0 0 1rem", color: "var(--text-muted)", lineHeight: 1.55 }}>
              Choose or change the assigned clinician from each client&apos;s profile.
            </p>
            <Link className="secondary-action" href="/clinic-admin/clients">
              Go to clients
            </Link>
          </article>
        </section>
      </div>
    </RoleDashboardShell>
  );
}
