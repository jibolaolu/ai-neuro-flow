import { RoleDashboardShell } from "../../../components/role-dashboard-shell";
import { getSuperAdminNav } from "../../../lib/super-admin-nav";

export default function SettingsPage() {
  return (
    <RoleDashboardShell
      role="super-admin"
      roleLabel="Super Platform Admin"
      sectionLabel="Settings"
      title="Platform settings"
      navGroups={getSuperAdminNav("/super-admin/settings")}
    >
      <div className="page-shell">
        <div className="platShell">
          <div className="platHeader">
            <div>
              <h2 className="platHeaderTitle">Platform Settings</h2>
              <p className="platHeaderSub">Global configuration for the Neuro Flow SaaS platform</p>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            {[
              {
                title: "Identity (Auth0)",
                items: [
                  ["Domain",       "neuroflow.eu.auth0.com"],
                  ["RBAC",         "Enabled"],
                  ["MFA",          "Required for all roles"],
                  ["Token expiry", "8 hours"],
                ],
              },
              {
                title: "Billing (Stripe)",
                items: [
                  ["Webhook",      "Configured"],
                  ["Currency",     "GBP"],
                  ["Trial period", "14 days"],
                  ["Tax",          "UK VAT — auto-calculated"],
                ],
              },
              {
                title: "Email (SendGrid)",
                items: [
                  ["From address", "no-reply@neuroflow.app"],
                  ["Webhook",      "Configured"],
                  ["Templates",    "Intake, report release, trial"],
                  ["DKIM",         "Verified"],
                ],
              },
              {
                title: "Platform",
                items: [
                  ["Environment",  process.env.NODE_ENV ?? "production"],
                  ["Version",      "1.0.0"],
                  ["Data region",  "UK / eu-west-2"],
                  ["GDPR mode",    "Enabled"],
                ],
              },
            ].map((section) => (
              <div key={section.title} className="platCard">
                <div className="platCardHeader"><h3>{section.title}</h3></div>
                <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                  {section.items.map(([k, v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", borderBottom: "1px solid var(--card-border)", paddingBottom: "0.5rem" }}>
                      <span style={{ color: "var(--muted)", fontWeight: 600 }}>{k}</span>
                      <span style={{ color: "var(--ink)", fontFamily: "monospace" }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </RoleDashboardShell>
  );
}
