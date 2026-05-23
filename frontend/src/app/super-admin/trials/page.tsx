import { RoleDashboardShell } from "../../../components/role-dashboard-shell";
import { getSuperAdminNav } from "../../../lib/super-admin-nav";
import { SUBSCRIBERS } from "../../../lib/super-admin-data";

function fmtGbp(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);
}

export default function TrialsPage() {
  const trials = SUBSCRIBERS.filter((s) => s.status === "trial");

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
              <p className="platHeaderSub">{trials.length} clinic{trials.length !== 1 ? "s" : ""} currently in trial — track conversion readiness</p>
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
                    <col style={{ width: "30%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "18%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "10%" }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Clinic</th>
                      <th>Plan</th>
                      <th>Trial ends</th>
                      <th style={{ textAlign: "right" }}>Seats used</th>
                      <th style={{ textAlign: "right" }}>Reports</th>
                      <th style={{ textAlign: "right" }}>Support tickets</th>
                      <th style={{ textAlign: "right" }}>Potential MRR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trials.map((s) => {
                      const daysLeft = s.trialEndsDate
                        ? Math.ceil((new Date(s.trialEndsDate).getTime() - Date.now()) / 86400000)
                        : null;
                      return (
                        <tr key={s.id} className={daysLeft !== null && daysLeft <= 7 ? "platRowUrgent" : ""}>
                          <td>
                            <span className="platSubName">{s.name}</span>
                            <span className="platSubMeta">{s.contactEmail}</span>
                          </td>
                          <td>
                            <span className="platBadge platBadgeGrey" style={{ textTransform: "capitalize" }}>{s.plan}</span>
                          </td>
                          <td style={{ fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                            {s.trialEndsDate ?? "—"}
                            {daysLeft !== null && (
                              <span style={{ marginLeft: 6, color: daysLeft <= 7 ? "#dc2626" : "var(--muted)", fontSize: "0.72rem", fontWeight: 700 }}>
                                {daysLeft}d left
                              </span>
                            )}
                          </td>
                          <td className="platNumCell">{s.activeSeats}/{s.seats}</td>
                          <td className="platNumCell">{s.reportsThisMonth}</td>
                          <td className="platNumCell">{s.openSupportTickets}</td>
                          <td className="platNumCell" style={{ color: "#059669" }}>{fmtGbp(s.mrrGbp || 299)}/mo</td>
                        </tr>
                      );
                    })}
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
