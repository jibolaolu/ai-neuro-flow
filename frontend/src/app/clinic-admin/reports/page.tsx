import { RoleDashboardShell } from "../../../components/role-dashboard-shell";
import { getClinicAdminNav } from "../../../lib/clinic-admin-nav";
import { getOperationalOverview } from "../../../lib/api-server";

function formatRole(role: string): string {
  if (role === "senior-clinician") return "Senior clinician";
  if (role === "clinician") return "Clinician";
  return role;
}

export default async function ClinicAdminReportsPage() {
  const overview = await getOperationalOverview();

  const pathways = overview?.pathway_counts ?? [];
  const clinicians = overview?.clinicians ?? [];
  const totals = overview?.totals;

  return (
    <RoleDashboardShell
      role="clinic-admin"
      roleLabel="Clinical Admin"
      sectionLabel="Reports"
      title="Operational reports"
      navGroups={getClinicAdminNav("/clinic-admin/reports")}
    >
      <div className="page-shell dashboard-page-shell compact-shell">
        <section className="page-hero compact-hero">
          <div className="page-hero-copy">
            <span className="eyebrow">Insights</span>
            <h1 className="page-lead-heading">Weekly timesheets and utilisation</h1>
            <p className="page-lead">
              Live counts from Neuro Flow clients and clinician assignments. Completed assessments use status/stage text
              containing &quot;complete&quot;; booked sessions count clients with a confirmed assessment datetime.
            </p>
          </div>
        </section>

        <div className="metrics-strip admin-control-metrics">
          <article className="snapshot-card">
            <span>Clients on platform</span>
            <strong>{totals?.clients ?? "-"}</strong>
            <small className="metric-status-neutral">All pathways</small>
          </article>
          <article className="snapshot-card">
            <span>Active clinicians</span>
            <strong>{totals?.active_clinicians ?? "-"}</strong>
            <small className="metric-status-good">Portal accounts (active)</small>
          </article>
          <article className="snapshot-card">
            <span>Open assessments</span>
            <strong>{totals?.open_assessments ?? "-"}</strong>
            <small className="metric-status-warn">Status does not read “complete”</small>
          </article>
        </div>

        <article className="workspace-card admin-portfolio-card">
          <div className="workspace-card-header">
            <div>
              <span className="panel-label">By pathway</span>
              <h2>Clients per service</h2>
            </div>
          </div>
          <div className="data-table-shell">
            <div className="data-table">
              <div
                className="data-table-head"
                style={{ gridTemplateColumns: "minmax(200px, 1.6fr) minmax(80px, 0.5fr) minmax(220px, 1.6fr)" }}
              >
                <span>Service</span>
                <span>Clients</span>
                <span>Notes</span>
              </div>
              {!overview ? (
                <div className="data-table-row" style={{ padding: "1.25rem", color: "var(--muted)" }}>
                  Sign in as clinical admin to load report data.
                </div>
              ) : pathways.length === 0 ? (
                <div className="data-table-row" style={{ padding: "1.25rem", color: "var(--muted)" }}>
                  No pathway data yet.
                </div>
              ) : (
                pathways.map((p) => (
                  <div
                    className="data-table-row"
                    key={p.pathway}
                    style={{ gridTemplateColumns: "minmax(200px, 1.6fr) minmax(80px, 0.5fr) minmax(220px, 1.6fr)" }}
                  >
                    <span>{p.pathway}</span>
                    <span>{p.clients}</span>
                    <span style={{ color: "var(--muted)" }}>Live client count</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </article>

        <article className="workspace-card admin-portfolio-card">
          <div className="workspace-card-header">
            <div>
              <span className="panel-label">Team</span>
              <h2>Clinician productivity</h2>
            </div>
          </div>
          <div className="data-table-shell">
            <div className="data-table">
              <div
                className="data-table-head"
                style={{
                  gridTemplateColumns:
                    "minmax(160px, 1fr) minmax(140px, 0.9fr) minmax(72px, 0.45fr) minmax(72px, 0.45fr) minmax(88px, 0.55fr) minmax(72px, 0.45fr)",
                }}
              >
                <span>Name</span>
                <span>Role</span>
                <span>Active</span>
                <span>Booked</span>
                <span>Completed</span>
                <span>Total</span>
              </div>
              {!overview ? (
                <div className="data-table-row" style={{ padding: "1.25rem", color: "var(--muted)" }}>
                  Could not load clinician metrics.
                </div>
              ) : clinicians.length === 0 ? (
                <div className="data-table-row" style={{ padding: "1.25rem", color: "var(--muted)" }}>
                  No active clinicians in directory.
                </div>
              ) : (
                clinicians.map((m) => (
                  <div
                    className="data-table-row"
                    key={m.id}
                    style={{
                      gridTemplateColumns:
                        "minmax(160px, 1fr) minmax(140px, 0.9fr) minmax(72px, 0.45fr) minmax(72px, 0.45fr) minmax(88px, 0.55fr) minmax(72px, 0.45fr)",
                    }}
                  >
                    <span>
                      <strong>{m.full_name}</strong>
                      <small style={{ display: "block", color: "var(--muted)" }}>{m.email}</small>
                    </span>
                    <span>{formatRole(m.role)}</span>
                    <span>{m.active_cases}</span>
                    <span>{m.booked_sessions}</span>
                    <span>{m.completed_assessments}</span>
                    <span>{m.total_assigned}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </article>
      </div>
    </RoleDashboardShell>
  );
}
