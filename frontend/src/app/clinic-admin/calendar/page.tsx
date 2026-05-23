import Link from "next/link";

import { RoleDashboardShell } from "../../../components/role-dashboard-shell";
import { TeamAvailabilityPanel } from "../../../components/team-availability-panel";
import { getClinicAdminNav } from "../../../lib/clinic-admin-nav";
import { getClients } from "../../../lib/api";

export default async function ClinicAdminCalendarPage() {
  // Pull live booking counts from client data
  const clients = await getClients();
  const booked = clients.filter((c) => !!c.confirmed_session_at).length;
  const pendingSlot = clients.filter((c) => {
    const s = (c.status ?? "").toLowerCase();
    return s.includes("ready to schedule") || s === "forms returned";
  }).length;

  return (
    <RoleDashboardShell
      role="clinic-admin"
      roleLabel="Clinical Admin"
      sectionLabel="Clinic Admin Calendar"
      title="Booking calendar and clinician capacity"
      navGroups={getClinicAdminNav("/clinic-admin/calendar")}
    >
      <div className="page-shell dashboard-page-shell compact-shell" style={{ paddingTop: 0 }}>

        {/* ── Compact metric strip ─────────────────────────────────────────── */}
        <div className="pt-summary-strip" style={{ marginBottom: "var(--space-5)" }}>
          <div className="pt-summary-card pt-summary-card--accent">
            <strong className="pt-summary-value">{booked}</strong>
            <span className="pt-summary-label">Booked assessments</span>
          </div>
          <div className="pt-summary-card">
            <strong className="pt-summary-value">—</strong>
            <span className="pt-summary-label">Clinicians in rota</span>
          </div>
          <div className="pt-summary-card" style={{ borderColor: "#fcd34d", background: "#fffbeb" }}>
            <strong className="pt-summary-value" style={{ color: "var(--warning)" }}>{pendingSlot}</strong>
            <span className="pt-summary-label">Pending slot selection</span>
          </div>
        </div>

        {/* ── Clinician availability (full width, right at the top) ────────── */}
        <TeamAvailabilityPanel />

        {/* ── Client bookings table ────────────────────────────────────────── */}
        <article className="workspace-card" style={{ marginTop: "var(--space-5)" }}>
          <div className="workspace-card-header">
            <div>
              <span className="panel-label">Calendar</span>
              <h2>Client bookings</h2>
            </div>
            <div className="button-strip">
              <Link className="ghost-chip" href="/clinic-admin/clients">Open clients</Link>
              <Link className="ghost-chip" href="/clinic-admin/team/new">Add a clinician</Link>
            </div>
          </div>
          {booked === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: 14, padding: "1rem 0" }}>
              Bookings appear here after a client selects their preferred assessment slot.
              Clinician availability is listed above; use it when matching pathways and room capacity.
            </p>
          ) : (
            <div className="data-table-shell">
              <div className="data-table">
                <div className="data-table-head" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr" }}>
                  <span>Client</span>
                  <span>Pathway</span>
                  <span>Session date</span>
                  <span>Status</span>
                </div>
                {clients
                  .filter((c) => !!c.confirmed_session_at)
                  .map((c) => (
                    <Link
                      key={c.id}
                      className="data-table-row data-table-link-row"
                      href={`/clinic-admin/clients/${c.id}`}
                      style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr" }}
                    >
                      <strong style={{ fontSize: 13 }}>{c.full_name}</strong>
                      <span style={{ fontSize: 13 }}>{c.pathway ?? "—"}</span>
                      <strong style={{ fontSize: 12, color: "var(--brand)" }}>
                        {new Date(c.confirmed_session_at!).toLocaleString("en-GB", {
                          day: "2-digit", month: "short", year: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </strong>
                      <span>
                        <span className="admin-status-chip admin-status-booked">{c.status}</span>
                      </span>
                    </Link>
                  ))}
              </div>
            </div>
          )}
        </article>

      </div>
    </RoleDashboardShell>
  );
}
