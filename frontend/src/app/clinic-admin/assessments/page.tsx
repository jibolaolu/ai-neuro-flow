import Link from "next/link";

import { RoleDashboardShell } from "../../../components/role-dashboard-shell";
import { getClinicAdminNav } from "../../../lib/clinic-admin-nav";
import { getClientForms, getClients, type FormTokenRecord } from "../../../lib/api";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formsProgressLabel(forms: FormTokenRecord[]): string {
  if (forms.length === 0) return "-";
  const done = forms.filter((f) => f.status === "submitted").length;
  return done === forms.length ? "Complete" : `${done}/${forms.length}`;
}

function formsChip(label: string): string {
  if (label === "Complete") return "admin-forms-chip admin-forms-complete";
  if (label === "-")        return "admin-forms-chip admin-forms-none";
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

function formatSession(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return "—"; }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ClinicAdminAssessmentsPipelinePage() {
  const clients = await getClients();

  const enriched = await Promise.all(
    clients.map(async (client) => ({
      client,
      forms: await getClientForms(client.id),
    })),
  );

  const awaitingFormsCount = enriched.filter(({ forms }) =>
    forms.length > 0 && forms.some((f) => f.status !== "submitted"),
  ).length;
  const readyToScheduleCount = enriched.filter(({ client }) => {
    const s = (client.status ?? "").toLowerCase();
    return s.includes("ready to schedule") || s === "forms returned";
  }).length;
  const bookedCount = enriched.filter(({ client }) => !!client.confirmed_session_at).length;

  return (
    <RoleDashboardShell
      role="clinic-admin"
      roleLabel="Clinical Admin"
      sectionLabel="Assessments"
      title="Assessment pipeline and caseload"
      navGroups={getClinicAdminNav("/clinic-admin/assessments")}
    >
      <div className="page-shell dashboard-page-shell compact-shell" style={{ paddingTop: 0 }}>

        {/* ── Metric strip ──────────────────────────────────────────────────── */}
        <div className="pt-summary-strip" style={{ marginBottom: "var(--space-5)" }}>
          <div className="pt-summary-card">
            <strong className="pt-summary-value">{enriched.length}</strong>
            <span className="pt-summary-label">Active cases</span>
          </div>
          <div className="pt-summary-card" style={{ borderColor: "#fcd34d", background: "#fffbeb" }}>
            <strong className="pt-summary-value" style={{ color: "var(--warning)" }}>{readyToScheduleCount}</strong>
            <span className="pt-summary-label">Ready to schedule</span>
          </div>
          <div className="pt-summary-card pt-summary-card--warn">
            <strong className="pt-summary-value">{awaitingFormsCount}</strong>
            <span className="pt-summary-label">Awaiting forms</span>
          </div>
          <div className="pt-summary-card pt-summary-card--accent">
            <strong className="pt-summary-value">{bookedCount}</strong>
            <span className="pt-summary-label">Slot confirmed</span>
          </div>
        </div>

        {/* ── Pipeline table ────────────────────────────────────────────────── */}
        <article className="workspace-card">
          <div className="workspace-card-header">
            <div>
              <span className="panel-label">Pipeline</span>
              <h2>All assessments</h2>
            </div>
            <Link className="ghost-chip" href="/clinic-admin/calendar">Open calendar</Link>
          </div>

          <div className="data-table-shell">
            <div className="data-table">
              <div className="data-table-head cadmin-pipeline-cols">
                <span>Client</span>
                <span>Pathway</span>
                <span>Forms</span>
                <span>Session</span>
                <span>Status</span>
              </div>

              {enriched.length === 0 ? (
                <div style={{ padding: "2rem", textAlign: "center", color: "var(--muted)" }}>
                  No cases yet. Cases appear after payment or manual registration.
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
                      <span className="cadmin-client-cell">
                        <strong className="cadmin-client-name">{client.full_name}</strong>
                        <small className="cadmin-client-email">{client.email}</small>
                      </span>
                      <span><span className={pc.cls}>{pc.label}</span></span>
                      <span><span className={formsChip(fl)}>{fl}</span></span>
                      <span className="cadmin-session">
                        {client.confirmed_session_at
                          ? <strong style={{ fontSize: 12, color: "var(--brand)" }}>{formatSession(client.confirmed_session_at)}</strong>
                          : <span style={{ fontSize: 12, color: "var(--muted)" }}>—</span>
                        }
                      </span>
                      <span><span className={sc.cls}>{sc.label}</span></span>
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        </article>

      </div>
    </RoleDashboardShell>
  );
}
