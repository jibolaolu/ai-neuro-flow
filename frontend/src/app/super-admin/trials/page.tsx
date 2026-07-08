import { RoleDashboardShell } from "../../../components/role-dashboard-shell";
import { getSuperAdminNav } from "../../../lib/super-admin-nav";
import { serverAuthedGetJson } from "../../../lib/api-server";
import type { LiveSubscriber } from "../../../components/super-admin-dashboard";

function fmtGbp(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);
}

const PLAN_MRR: Record<string, number> = {
  enterprise: 1200, professional: 599, starter: 299,
};

export default async function TrialsPage() {
  const data = await serverAuthedGetJson<{ subscribers: LiveSubscriber[] }>("/api/v1/analytics/subscribers");
  const trials = (data?.subscribers ?? []).filter((s) => s.status === "trial");

  return (
    <RoleDashboardShell
      role="super-admin"
      roleLabel="Super Platform Admin"
      sectionLabel="Trials"
      title="Trial accounts"
      navGroups={getSuperAdminNav("/super-admin/trials")}
    >
      <div className="page-shell">
        <div className="platShell">
          <div className="platHeader">
            <div>
              <h2 className="platHeaderTitle">Trial Accounts</h2>
              <p className="platHeaderSub">
                {trials.length} clinic{trials.length !== 1 ? "s" : ""} currently in trial — track conversion readiness
              </p>
            </div>
          </div>

          <div className="platCard">
            <div className="platCardHeader">
              <h3>Active trials</h3>
              <span className="platCardCount">{trials.length}</span>
            </div>
            {trials.length === 0 ? (
              <p style={{ padding: "2rem", textAlign: "center", color: "var(--muted)", fontSize: "0.875rem" }}>No active trials.</p>
            ) : (
              <div className="platTableWrap">
                <table className="platTable">
                  <colgroup>
                    <col style={{ width: "28%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "18%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "12%" }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Clinic</th>
                      <th>Plan</th>
                      <th>Joined</th>
                      <th style={{ textAlign: "right" }}>Active users</th>
                      <th style={{ textAlign: "right" }}>Clients</th>
                      <th style={{ textAlign: "right" }}>Tickets</th>
                      <th style={{ textAlign: "right" }}>Potential MRR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trials.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <span className="platSubName">{s.name}</span>
                          <span className="platSubMeta">{s.contact_email}</span>
                        </td>
                        <td>
                          <span className="platBadge platBadgeGrey" style={{ textTransform: "capitalize" }}>{s.plan}</span>
                        </td>
                        <td style={{ fontSize: "0.78rem", color: "var(--muted)", whiteSpace: "nowrap" }}>
                          {s.joined_date ?? "—"}
                        </td>
                        <td className="platNumCell">{s.active_seats}</td>
                        <td className="platNumCell">{s.active_clients}</td>
                        <td className="platNumCell">{s.open_support_tickets || "—"}</td>
                        <td className="platNumCell" style={{ color: "#059669" }}>
                          {fmtGbp(PLAN_MRR[s.plan] ?? 299)}/mo
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </RoleDashboardShell>
  );
}
