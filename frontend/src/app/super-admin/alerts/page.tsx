import { RoleDashboardShell } from "../../../components/role-dashboard-shell";
import { getSuperAdminNav } from "../../../lib/super-admin-nav";
import { serverAuthedGetJson } from "../../../lib/api-server";
import type { SupportTicket, SupportTicketList } from "../../../lib/support-ticket-api";
import type { LiveKpis, LiveSubscriber } from "../../../components/super-admin-dashboard";

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    critical: "platBadgeRed", warning: "platBadgeAmber", info: "platBadgeBlue",
  };
  return (
    <span className={`platBadge ${map[severity] ?? "platBadgeGrey"}`} style={{ textTransform: "capitalize" }}>
      {severity}
    </span>
  );
}

type Alert = { id: string; severity: "critical" | "warning" | "info"; title: string; detail: string; tag: string; time: string; resolved: boolean };

function buildAlerts(tickets: SupportTicket[], subs: LiveSubscriber[], kpis: LiveKpis | null): Alert[] {
  const alerts: Alert[] = [];

  // High-priority open tickets → critical/warning
  tickets.filter((t) => ["open", "in_progress"].includes(t.status)).forEach((t) => {
    const severity: Alert["severity"] = t.priority === "urgent" ? "critical" : t.priority === "high" ? "warning" : "info";
    alerts.push({
      id:       `ticket-${t.id}`,
      severity,
      title:    t.title,
      detail:   `Raised by ${t.raised_by_name} (${t.clinic_name ?? "Platform"}) · ${t.category}`,
      tag:      "Support ticket",
      time:     t.created_at ?? "",
      resolved: false,
    });
  });

  // Past-due billing
  subs.filter((s) => s.status === "past_due").forEach((s) => {
    alerts.push({
      id:       `billing-${s.id}`,
      severity: "critical",
      title:    `Past-due billing — ${s.name}`,
      detail:   `Contact: ${s.contact_email}. Expected MRR: £${s.mrr_gbp ?? 0}/mo`,
      tag:      "Billing",
      time:     "",
      resolved: false,
    });
  });

  // Resolved tickets (awaiting_info → resolved → closed)
  tickets.filter((t) => ["resolved", "closed"].includes(t.status)).slice(0, 10).forEach((t) => {
    alerts.push({
      id:       `resolved-${t.id}`,
      severity: "info",
      title:    t.title,
      detail:   `Resolved · ${t.clinic_name ?? "Platform"}`,
      tag:      "Support ticket",
      time:     t.resolved_at ?? t.updated_at ?? "",
      resolved: true,
    });
  });

  return alerts;
}

export default async function AlertsPage() {
  const [ticketData, subData, kpisData] = await Promise.all([
    serverAuthedGetJson<SupportTicketList>("/api/v1/support-tickets"),
    serverAuthedGetJson<{ subscribers: LiveSubscriber[] }>("/api/v1/analytics/subscribers"),
    serverAuthedGetJson<LiveKpis>("/api/v1/analytics/platform-kpis"),
  ]);

  const tickets = ticketData?.items ?? [];
  const subs    = subData?.subscribers ?? [];
  const all     = buildAlerts(tickets, subs, kpisData ?? null);
  const open    = all.filter((a) => !a.resolved);
  const resolved = all.filter((a) => a.resolved);

  return (
    <RoleDashboardShell
      role="super-admin"
      roleLabel="Super Platform Admin"
      sectionLabel="Alerts"
      title="Platform alerts"
      navGroups={getSuperAdminNav("/super-admin/alerts")}
    >
      <div className="page-shell">
        <div className="platShell">
          <div className="platHeader">
            <div>
              <h2 className="platHeaderTitle">Platform Alerts</h2>
              <p className="platHeaderSub">{open.length} active · {resolved.length} resolved</p>
            </div>
          </div>

          <div className="platCard">
            <div className="platCardHeader">
              <h3>Active alerts</h3>
              {open.length > 0 && <span className="platCardCountRed">{open.length}</span>}
            </div>
            {open.length === 0 ? (
              <p style={{ padding: "2rem", textAlign: "center", color: "var(--muted)", fontSize: "0.875rem" }}>
                All clear — no active alerts.
              </p>
            ) : (
              <div className="platAlertList">
                {open.map((alert) => (
                  <div key={alert.id} className={`platAlertItem platAlertItem--${alert.severity}`}>
                    <div className="platAlertContent">
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <SeverityBadge severity={alert.severity} />
                        <p className="platAlertTitle" style={{ margin: 0 }}>{alert.title}</p>
                      </div>
                      <p className="platAlertDetail">{alert.detail}</p>
                      <span className="platAlertTag">{alert.tag}</span>
                    </div>
                    {alert.time && (
                      <span className="platAlertTime">
                        {new Date(alert.time).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {resolved.length > 0 && (
            <div className="platCard">
              <div className="platCardHeader"><h3>Resolved</h3><span className="platCardCount">{resolved.length}</span></div>
              <div className="platAlertList">
                {resolved.map((alert) => (
                  <div key={alert.id} className="platAlertItem platAlertItem--resolved">
                    <div className="platAlertContent">
                      <p className="platAlertTitle">{alert.title}</p>
                      <p className="platAlertDetail">{alert.detail}</p>
                    </div>
                    {alert.time && (
                      <span className="platAlertTime">
                        {new Date(alert.time).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </RoleDashboardShell>
  );
}
