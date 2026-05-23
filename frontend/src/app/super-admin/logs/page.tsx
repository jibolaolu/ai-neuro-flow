import { RoleDashboardShell } from "../../../components/role-dashboard-shell";
import { getSuperAdminNav } from "../../../lib/super-admin-nav";

const MOCK_LOG: { ts: string; actor: string; action: string; target: string; ip: string }[] = [
  { ts: "2026-05-17T09:52:14Z", actor: "platform@neuroflow.app",      action: "LOGIN",            target: "super-admin portal",         ip: "82.9.12.44" },
  { ts: "2026-05-17T09:48:01Z", actor: "platform@neuroflow.app",      action: "VIEW_SUBSCRIBERS", target: "/super-admin/subscribers",    ip: "82.9.12.44" },
  { ts: "2026-05-17T08:31:22Z", actor: "system",                      action: "ALERT_RAISED",     target: "org-004 — PDF latency",      ip: "internal" },
  { ts: "2026-05-17T07:00:05Z", actor: "system",                      action: "ALERT_RAISED",     target: "org-006 — payment past due", ip: "internal" },
  { ts: "2026-05-17T06:00:01Z", actor: "system",                      action: "TRIAL_REMINDER",   target: "org-005 — trial ending",     ip: "internal" },
  { ts: "2026-05-16T16:14:33Z", actor: "platform@neuroflow.app",      action: "UPDATE_SETTINGS",  target: "platform config",            ip: "82.9.12.44" },
  { ts: "2026-05-16T15:02:19Z", actor: "admin@clinic-001.example",    action: "INVITE_USER",      target: "org-001 — new clinician",    ip: "195.8.77.2" },
  { ts: "2026-05-16T14:00:00Z", actor: "system",                      action: "RETENTION_NOTICE", target: "org-012 — data retention",   ip: "internal" },
  { ts: "2026-05-16T09:18:41Z", actor: "system",                      action: "ALERT_RESOLVED",   target: "Auth0 token refresh spike",  ip: "internal" },
  { ts: "2026-05-15T11:30:00Z", actor: "platform@neuroflow.app",      action: "SUSPEND_ORG",      target: "org-006 — payment overdue",  ip: "82.9.12.44" },
];

export default function LogsPage() {
  return (
    <RoleDashboardShell
      role="super-admin"
      roleLabel="Super Platform Admin"
      sectionLabel="Audit log"
      title="Audit log"
      navGroups={getSuperAdminNav("/super-admin/logs")}
    >
      <div className="page-shell">
        <div className="platShell">
          <div className="platHeader">
            <div>
              <h2 className="platHeaderTitle">Audit Log</h2>
              <p className="platHeaderSub">Platform-level event trail — operator and system actions</p>
            </div>
          </div>

          <div className="platCard">
            <div className="platCardHeader">
              <h3>Recent events</h3>
              <span className="platCardCount">{MOCK_LOG.length} shown</span>
            </div>
            <div className="platTableWrap">
              <table className="platTable">
                <thead>
                  <tr><th>Time (UTC)</th><th>Actor</th><th>Action</th><th>Target</th><th>IP</th></tr>
                </thead>
                <tbody>
                  {MOCK_LOG.map((row, i) => (
                    <tr key={i}>
                      <td style={{ fontSize: "0.72rem", fontFamily: "monospace", whiteSpace: "nowrap", color: "var(--muted)" }}>
                        {row.ts.replace("T", " ").replace("Z", "")}
                      </td>
                      <td><span className="platSubMeta" style={{ display: "inline" }}>{row.actor}</span></td>
                      <td>
                        <span className="platBadge platBadgeGrey" style={{ fontFamily: "monospace", letterSpacing: 0 }}>{row.action}</span>
                      </td>
                      <td style={{ fontSize: "0.78rem", color: "var(--ink)" }}>{row.target}</td>
                      <td style={{ fontSize: "0.72rem", fontFamily: "monospace", color: "var(--muted)" }}>{row.ip}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </RoleDashboardShell>
  );
}
