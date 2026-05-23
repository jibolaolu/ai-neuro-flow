import Link from "next/link";

import { RoleDashboardShell } from "../../../components/role-dashboard-shell";
import { getClinicAdminNav } from "../../../lib/clinic-admin-nav";
import { getClientForms, getClients, type FormTokenRecord } from "../../../lib/api";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formsProgressLabel(forms: FormTokenRecord[]): string {
  if (forms.length === 0) return "-";
  const done = forms.filter((f) => f.status === "submitted").length;
  const total = forms.length;
  return done === total ? "Complete" : `${done}/${total}`;
}

function formsChip(label: string): string {
  if (label === "Complete") return "admin-forms-chip admin-forms-complete";
  if (label === "-") return "admin-forms-chip admin-forms-none";
  return "admin-forms-chip admin-forms-partial";
}

function statusChip(status: string): { label: string; cls: string } {
  const s = (status ?? "new").toLowerCase();
  if (s.includes("assessment booked") || s.includes("booked") || s.includes("scheduled"))
    return { label: status, cls: "admin-status-chip admin-status-booked" };
  if (s.includes("complete"))
    return { label: status, cls: "admin-status-chip admin-status-complete" };
  if (s.includes("ready to schedule") || s === "forms returned")
    return { label: status, cls: "admin-status-chip admin-status-ready" };
  if (s.includes("forms returned"))
    return { label: status, cls: "admin-status-chip admin-status-forms-done" };
  if (s.includes("forms sent"))
    return { label: status, cls: "admin-status-chip admin-status-forms-sent" };
  if (s === "new")
    return { label: status, cls: "admin-status-chip admin-status-new" };
  return { label: status, cls: "admin-status-chip admin-status-neutral" };
}

function pathwayChip(pathway: string | null): { label: string; cls: string } {
  if (!pathway) return { label: "—", cls: "pt-pathway-chip pt-pathway-chip--unknown" };
  const p = pathway.toLowerCase();
  if (p.includes("adhd") && (p.includes("autis") || p.includes("asd")))
    return { label: pathway, cls: "pt-pathway-chip pt-pathway-chip--combined" };
  if (p.includes("adhd"))
    return { label: pathway, cls: "pt-pathway-chip pt-pathway-chip--adhd" };
  if (p.includes("autis") || p.includes("asd"))
    return { label: pathway, cls: "pt-pathway-chip pt-pathway-chip--autism" };
  return { label: pathway, cls: "pt-pathway-chip pt-pathway-chip--other" };
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return "—"; }
}

// ── Summary counts ─────────────────────────────────────────────────────────────

function getSummary(clients: Awaited<ReturnType<typeof getClients>>, allForms: FormTokenRecord[][]) {
  const active = clients.length;
  const readyToSchedule = clients.filter((c) => {
    const s = (c.status ?? "").toLowerCase();
    return s.includes("ready to schedule") || s === "forms returned";
  }).length;
  const awaitingForms = allForms.filter((forms) =>
    forms.length > 0 && forms.some((f) => f.status !== "submitted")
  ).length;
  const booked = clients.filter((c) => {
    const s = (c.status ?? "").toLowerCase();
    return s.includes("booked") || s.includes("scheduled");
  }).length;
  return { active, readyToSchedule, awaitingForms, booked };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ClinicAdminClientsPage() {
  const clients = await getClients();

  const enriched = await Promise.all(
    clients.map(async (client) => ({
      client,
      forms: await getClientForms(client.id),
    }))
  );

  const allForms = enriched.map((e) => e.forms);
  const summary = getSummary(clients, allForms);

  return (
    <RoleDashboardShell
      role="clinic-admin"
      roleLabel="Clinical Admin"
      sectionLabel="Clinic Clients"
      title="Client directory and case status"
      navGroups={getClinicAdminNav("/clinic-admin/clients")}
    >
      <div className="page-shell dashboard-page-shell compact-shell" style={{ paddingTop: 0 }}>

        {/* ── Summary strip ───────────────────────────────────────────────── */}
        <div className="pt-summary-strip" style={{ marginBottom: "var(--space-5)" }}>
          <div className="pt-summary-card">
            <strong className="pt-summary-value">{summary.active}</strong>
            <span className="pt-summary-label">Active cases</span>
          </div>
          <div className="pt-summary-card pt-summary-card--warn">
            <strong className="pt-summary-value">{summary.awaitingForms}</strong>
            <span className="pt-summary-label">Awaiting forms</span>
          </div>
          <div className="pt-summary-card pt-summary-card--accent" style={{ borderColor: "#fcd34d", background: "#fffbeb" }}>
            <strong className="pt-summary-value" style={{ color: "var(--warning)" }}>{summary.readyToSchedule}</strong>
            <span className="pt-summary-label">Ready to schedule</span>
          </div>
          <div className="pt-summary-card pt-summary-card--accent">
            <strong className="pt-summary-value">{summary.booked}</strong>
            <span className="pt-summary-label">Sessions booked</span>
          </div>
        </div>

        {/* ── Pipeline table ──────────────────────────────────────────────── */}
        <section className="workspace-card">
          <div className="workspace-card-header">
            <div>
              <span className="panel-label">Pipeline</span>
              <h2>All assessments</h2>
            </div>
            <div className="button-strip">
              <Link className="ghost-chip" href="/clinic-admin/calendar">View calendar</Link>
              <Link className="primary-action" href="/clinic-admin/clients/new">Add client</Link>
            </div>
          </div>

          <div className="data-table-shell">
            <div className="data-table">

              {/* Head */}
              <div className="data-table-head cadmin-pipeline-cols">
                <span>Client</span>
                <span>Pathway</span>
                <span>Forms</span>
                <span>Session</span>
                <span>Status</span>
              </div>

              {enriched.length === 0 ? (
                <div style={{ padding: "2rem", textAlign: "center", color: "var(--muted)" }}>
                  No clients yet. Clients are created after payment or added manually.
                </div>
              ) : (
                enriched.map(({ client, forms }) => {
                  const fl = formsProgressLabel(forms);
                  const sc = statusChip(client.status ?? "New");
                  const pc = pathwayChip(client.pathway);
                  return (
                    <Link
                      key={client.id}
                      className="data-table-row cadmin-pipeline-cols data-table-link-row"
                      href={`/clinic-admin/clients/${client.id}`}
                    >
                      {/* Client name + email */}
                      <span className="cadmin-client-cell">
                        <strong className="cadmin-client-name">{client.full_name}</strong>
                        <small className="cadmin-client-email">{client.email}</small>
                      </span>

                      {/* Pathway chip */}
                      <span>
                        <span className={pc.cls}>{pc.label}</span>
                      </span>

                      {/* Forms progress */}
                      <span>
                        <span className={formsChip(fl)}>{fl}</span>
                      </span>

                      {/* Session date */}
                      <span className="cadmin-session">
                        {client.confirmed_session_at
                          ? <strong style={{ fontSize: 12, color: "var(--brand)" }}>{formatDate(client.confirmed_session_at)}</strong>
                          : <span style={{ fontSize: 12, color: "var(--muted)" }}>—</span>
                        }
                      </span>

                      {/* Status chip */}
                      <span>
                        <span className={sc.cls}>{sc.label}</span>
                      </span>
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        </section>
      </div>
    </RoleDashboardShell>
  );
}
