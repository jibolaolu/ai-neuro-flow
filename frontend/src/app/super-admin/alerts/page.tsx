import { RoleDashboardShell } from "../../../components/role-dashboard-shell";
import { getSuperAdminNav } from "../../../lib/super-admin-nav";
import { PLATFORM_ALERTS } from "../../../lib/super-admin-data";

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

export default function AlertsPage() {
  const open     = PLATFORM_ALERTS.filter((a) => !a.resolved);
  const resolved = PLATFORM_ALERTS.filter((a) => a.resolved);

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
                      {alert.service && <span className="platAlertTag">{alert.service}</span>}
                    </div>
                    <span className="platAlertTime">
                      {new Date(alert.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
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
                    <span className="platAlertTime">
                      {new Date(alert.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </span>
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
