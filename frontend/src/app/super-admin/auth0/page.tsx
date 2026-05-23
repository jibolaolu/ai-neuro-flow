import { RoleDashboardShell } from "../../../components/role-dashboard-shell";
import { getSuperAdminNav } from "../../../lib/super-admin-nav";
import { AUTH0_METRICS } from "../../../lib/super-admin-data";

export default function Auth0Page() {
  return (
    <RoleDashboardShell
      role="super-admin"
      roleLabel="Super Platform Admin"
      sectionLabel="Auth0"
      title="Auth0 tenant metrics"
      navGroups={getSuperAdminNav("/super-admin/auth0")}
    >
      <div className="page-shell">
        <div className="platShell">
          <div className="platHeader">
            <div>
              <h2 className="platHeaderTitle">Auth0 Tenant</h2>
              <p className="platHeaderSub">Identity provider metrics — Neuro Flow production tenant</p>
            </div>
          </div>

          <div className="platCard">
            <div className="platCardHeader"><h3>Tenant metrics</h3></div>
            <div className="platAuth0Grid">
              {AUTH0_METRICS.map((m) => (
                <div key={m.label} className="platAuth0Card">
                  <p className="platAuth0Label">{m.label}</p>
                  <div className="platAuth0Value">
                    <strong>{typeof m.value === "number" ? m.value.toLocaleString() : m.value}</strong>
                  </div>
                  {m.trendLabel && <p className="platAuth0Trend">{m.trendLabel}</p>}
                </div>
              ))}
            </div>
          </div>

          <div className="platCard">
            <div className="platCardHeader"><h3>Configuration</h3></div>
            <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {[
                ["Domain",         "neuroflow.eu.auth0.com"],
                ["Client ID",      "Connected (production)"],
                ["Callback URLs",  "https://neuroflow.localtest.me:8443/auth/callback"],
                ["Logout URL",     "https://neuroflow.localtest.me:8443"],
                ["MFA",            "Enabled — TOTP + SMS"],
                ["Social logins",  "Disabled"],
                ["RBAC",           "Enabled — roles sync on token refresh"],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", borderBottom: "1px solid var(--card-border)", paddingBottom: "0.5rem" }}>
                  <span style={{ color: "var(--muted)", fontWeight: 600 }}>{k}</span>
                  <span style={{ color: "var(--ink)", fontFamily: "monospace" }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </RoleDashboardShell>
  );
}
