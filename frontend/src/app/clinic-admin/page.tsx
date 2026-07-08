import Link from "next/link";

import { ClinicSubscriptionPanelLazy } from "../../components/clinic-subscription-panel-lazy";
import { RoleDashboardShell } from "../../components/role-dashboard-shell";
import { RevenueWidget } from "../../components/revenue-widget";
import { getClinicAdminNav } from "../../lib/clinic-admin-nav";
import { getClientForms, getClients, type FormTokenRecord } from "../../lib/api";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formsProgressLabel(forms: FormTokenRecord[]): string {
  if (forms.length === 0) return "-";
  const done = forms.filter((f) => f.status === "submitted").length;
  const total = forms.length;
  return done === total ? "Complete" : `${done}/${total}`;
}

function clientAwaitingFormResponses(forms: FormTokenRecord[]): boolean {
  return forms.length > 0 && forms.some((f) => f.status !== "submitted");
}

function isReadyToSchedule(status: string): boolean {
  return status === "Forms Returned, Ready to Schedule" || status === "Forms Returned";
}

function statusChip(status: string): { label: string; cls: string } {
  const s = status.toLowerCase();
  if (s.includes("assessment booked") || s.includes("booked"))
    return { label: status, cls: "admin-status-booked" };
  if (s.includes("scheduled"))
    return { label: status, cls: "admin-status-booked" };
  if (s.includes("complete"))
    return { label: status, cls: "admin-status-complete" };
  if (s.includes("ready to schedule") || s === "forms returned")
    return { label: status, cls: "admin-status-ready" };
  if (s.includes("forms sent"))
    return { label: status, cls: "admin-status-forms-sent" };
  if (s.includes("forms returned"))
    return { label: status, cls: "admin-status-forms-done" };
  if (s === "new")
    return { label: status, cls: "admin-status-new" };
  return { label: status, cls: "admin-status-neutral" };
}

function formsChip(label: string): string {
  if (label === "Complete") return "admin-forms-complete";
  if (label === "-") return "admin-forms-none";
  return "admin-forms-partial";
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ClinicAdminPage() {
  const clients = await getClients();

  const enriched = await Promise.all(
    clients.map(async (client) => ({
      client,
      forms: await getClientForms(client.id),
    })),
  );

  const awaitingFormsCount = enriched.filter(({ forms }) => clientAwaitingFormResponses(forms)).length;
  const readyToScheduleCount = enriched.filter(({ client }) => isReadyToSchedule(client.status)).length;
  const awaitingReviewCount = 0;
  const reportsSentCount = 0;

  const priorityClients = enriched.filter(({ client }) => isReadyToSchedule(client.status));

  // Show at most 10 in the table; total count for badge
  const tableRows = enriched.slice(0, 10);
  const totalClients = enriched.length;

  return (
    <RoleDashboardShell
      role="clinic-admin"
      roleLabel="Clinical Admin"
      sectionLabel="Clinic Admin"
      title="Manage intake, scheduling, and report release"
      navGroups={getClinicAdminNav("/clinic-admin")}
    >
      <div className="page-shell dashboard-page-shell compact-shell">
        <ClinicSubscriptionPanelLazy compact />
        <RevenueWidget />
        <section className="admin-dashboard-grid" style={{ marginTop: "1rem" }}>

          {/* ── Metric strip ──────────────────────────────────────────────── */}
          <div className="metrics-strip admin-control-metrics">
            <Link href="/clinic-admin/clients?filter=ready" className="snapshot-card snapshot-card-link">
              <span>Current priority</span>
              <strong className={readyToScheduleCount > 0 ? "metric-value-warn" : ""}>{readyToScheduleCount}</strong>
              <small className={readyToScheduleCount > 0 ? "metric-status-warn" : "metric-status-neutral"}>
                {readyToScheduleCount === 0 ? "No cases ready to book" : "Ready for scheduling"}
              </small>
            </Link>
            <Link href="/clinic-admin/clients?filter=forms" className="snapshot-card snapshot-card-link">
              <span>Awaiting forms</span>
              <strong className={awaitingFormsCount > 0 ? "metric-value-blue" : ""}>{awaitingFormsCount}</strong>
              <small className={awaitingFormsCount > 0 ? "metric-status-neutral" : "metric-status-neutral"}>
                {awaitingFormsCount === 0 ? "All forms returned" : "Forms still outstanding"}
              </small>
            </Link>
            <Link href="/senior-clinician/report-review" className="snapshot-card snapshot-card-link">
              <span>Awaiting review</span>
              <strong>{awaitingReviewCount}</strong>
              <small className="metric-status-neutral">
                {awaitingReviewCount === 0 ? "Sign-off queue empty" : "Pending sign-off"}
              </small>
            </Link>
            <Link href="/clinic-admin/clients" className="snapshot-card snapshot-card-link">
              <span>Reports sent</span>
              <strong className={reportsSentCount > 0 ? "metric-value-green" : ""}>{reportsSentCount}</strong>
              <small className={reportsSentCount > 0 ? "metric-status-good" : "metric-status-neutral"}>
                {reportsSentCount === 0 ? "None released yet" : "Issued to clients"}
              </small>
            </Link>
          </div>

          <div className="admin-dashboard-main">

            {/* ── Case portfolio table ──────────────────────────────────────── */}
            <article className="workspace-card admin-portfolio-card">
              <div className="workspace-card-header">
                <div>
                  <span className="panel-label">Case portfolio</span>
                  <h2>Clinic workflow overview</h2>
                </div>
                {totalClients > 10 && (
                  <Link className="ghost-chip" href="/clinic-admin/clients">
                    View all {totalClients} cases
                  </Link>
                )}
              </div>
              <div className="data-table-shell">
                <div className="data-table">
                  <div className="data-table-head admin-case-table">
                    <span>Client</span>
                    <span>Pathway</span>
                    <span>Clinician</span>
                    <span>Forms</span>
                    <span>Status</span>
                  </div>
                  {tableRows.length === 0 ? (
                    <div style={{ padding: "2rem", textAlign: "center", color: "var(--muted)" }}>
                      No cases in the system yet. Cases appear after a client payment is received.
                    </div>
                  ) : (
                    tableRows.map(({ client, forms }) => {
                      const fl = formsProgressLabel(forms);
                      const sc = statusChip(client.status ?? "New");
                      return (
                        <Link
                          className="data-table-row admin-case-table data-table-link-row"
                          href={`/clinic-admin/clients/${client.id}`}
                          key={client.id}
                        >
                          <strong style={{ fontSize: 13 }}>{client.full_name}</strong>
                          <span style={{ fontSize: 13 }}>{client.pathway ?? "-"}</span>
                          <span style={{ fontSize: 13, color: "var(--muted)" }}>
                            {client.assigned_clinician_name ?? "—"}
                          </span>
                          <span>
                            <span className={`admin-forms-chip ${formsChip(fl)}`}>{fl}</span>
                          </span>
                          <span>
                            <span className={`admin-status-chip ${sc.cls}`}>{sc.label}</span>
                          </span>
                        </Link>
                      );
                    })
                  )}
                </div>
              </div>
              {totalClients > 10 && (
                <div style={{ padding: "12px 0 0", textAlign: "center" }}>
                  <Link
                    href="/clinic-admin/clients"
                    style={{ fontSize: 13, color: "var(--brand)", fontWeight: 700 }}
                  >
                    + {totalClients - 10} more cases — View full list →
                  </Link>
                </div>
              )}
            </article>

            {/* ── Priority watchlist ────────────────────────────────────────── */}
            <div className="admin-dashboard-side">
              <article className="workspace-card mini-card admin-side-card">
                <h3>Priority watchlist</h3>
                <div className="admin-watchlist">
                  <Link href="/clinic-admin/clients" className="admin-watch-item admin-watch-good admin-watch-link">
                    <span>Reports sent</span>
                    <strong>{reportsSentCount}</strong>
                  </Link>
                  <Link href="/clinic-admin/clients?filter=forms" className="admin-watch-item admin-watch-warn admin-watch-link">
                    <span>Awaiting forms</span>
                    <strong>{awaitingFormsCount}</strong>
                  </Link>
                  <Link href="/clinic-admin/clients?filter=ready" className="admin-watch-item admin-watch-risk admin-watch-link">
                    <span>Ready to schedule</span>
                    <strong>{readyToScheduleCount}</strong>
                  </Link>
                </div>
              </article>
            </div>
          </div>

          {/* ── Lower row ─────────────────────────────────────────────────── */}
          <div className="admin-dashboard-lower">
            <article className="workspace-card mini-card">
              <h3>Operational status</h3>
              <div className="admin-ops-grid">
                <div className="admin-ops-row">
                  <span className="admin-ops-label">Clinicians available</span>
                  <strong className="admin-ops-value">—</strong>
                </div>
                <div className="admin-ops-row">
                  <span className="admin-ops-label">Cases ready for next step</span>
                  <strong className={`admin-ops-value ${readyToScheduleCount > 0 ? "admin-ops-value-warn" : ""}`}>
                    {readyToScheduleCount}
                  </strong>
                </div>
                <div className="admin-ops-row">
                  <span className="admin-ops-label">Total active cases</span>
                  <strong className="admin-ops-value">{totalClients}</strong>
                </div>
              </div>
            </article>

            {/* Current priority — clickable cards */}
            <article className="workspace-card mini-card">
              <div className="workspace-card-header" style={{ marginBottom: 12 }}>
                <div>
                  <span className="panel-label">Action required</span>
                  <h3 style={{ margin: 0 }}>Current priority</h3>
                </div>
                {priorityClients.length > 0 && (
                  <Link href="/clinic-admin/clients?filter=ready" className="ghost-chip" style={{ fontSize: 12 }}>
                    View all
                  </Link>
                )}
              </div>
              {priorityClients.length === 0 ? (
                <div className="admin-priority-empty">
                  <span aria-hidden style={{ fontSize: 20 }}>✅</span>
                  <p>No cases currently require action.</p>
                </div>
              ) : (
                <div className="admin-priority-list">
                  {priorityClients.slice(0, 5).map(({ client, forms }) => {
                    const fl = formsProgressLabel(forms);
                    return (
                      <Link
                        key={client.id}
                        href={`/clinic-admin/clients/${client.id}`}
                        className="admin-priority-card"
                      >
                        <div className="admin-priority-card-main">
                          <strong className="admin-priority-name">{client.full_name}</strong>
                          <span className="admin-priority-pathway">{client.pathway ?? "Assessment"}</span>
                        </div>
                        <div className="admin-priority-card-meta">
                          <span className="admin-status-chip admin-status-ready">{client.status}</span>
                          {client.confirmed_session_at && (
                            <span className="admin-priority-date">
                              {new Date(client.confirmed_session_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                            </span>
                          )}
                        </div>
                        <span className="admin-priority-arrow" aria-hidden>→</span>
                      </Link>
                    );
                  })}
                  {priorityClients.length > 5 && (
                    <Link href="/clinic-admin/clients?filter=ready" className="admin-priority-more">
                      + {priorityClients.length - 5} more cases →
                    </Link>
                  )}
                </div>
              )}
            </article>
          </div>

        </section>
      </div>
    </RoleDashboardShell>
  );
}
