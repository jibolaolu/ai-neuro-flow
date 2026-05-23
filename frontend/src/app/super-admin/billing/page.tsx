import { RoleDashboardShell } from "../../../components/role-dashboard-shell";
import { getSuperAdminNav } from "../../../lib/super-admin-nav";
import { SUBSCRIBERS, REVENUE_MONTHS } from "../../../lib/super-admin-data";

function fmtGbp(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);
}

export default function BillingPage() {
  const pastDue = SUBSCRIBERS.filter((s) => s.status === "past_due");
  const totalMrr = SUBSCRIBERS.filter((s) => s.status === "active").reduce((acc, s) => acc + s.mrrGbp, 0);
  const latestMonth = REVENUE_MONTHS[REVENUE_MONTHS.length - 1];
  const prevMonth   = REVENUE_MONTHS[REVENUE_MONTHS.length - 2];
  const mrrChange   = latestMonth.mrrGbp - prevMonth.mrrGbp;

  return (
    <RoleDashboardShell
      role="super-admin"
      roleLabel="Super Platform Admin"
      sectionLabel="Billing"
      title="Billing &amp; revenue"
      navGroups={getSuperAdminNav("/super-admin/billing")}
    >
      <div className="page-shell">
        <div className="platShell">
          <div className="platHeader">
            <div>
              <h2 className="platHeaderTitle">Billing &amp; Revenue</h2>
              <p className="platHeaderSub">MRR, invoices, and past-due accounts</p>
            </div>
          </div>

          <div className="platKpiGrid" style={{ gridTemplateColumns: "repeat(4, minmax(0,1fr))" }}>
            {[
              { label: "Current MRR",   value: fmtGbp(totalMrr),            color: "#2a4db7" },
              { label: "MoM change",    value: `${mrrChange >= 0 ? "+" : ""}${fmtGbp(mrrChange)}`, color: mrrChange >= 0 ? "#059669" : "#dc2626" },
              { label: "New MRR",       value: fmtGbp(latestMonth.newMrr),   color: "#059669" },
              { label: "Churn",         value: `−${fmtGbp(latestMonth.churnedMrr)}`, color: "#dc2626" },
            ].map((k) => (
              <div key={k.label} className="platKpiCard" style={{ "--plat-accent": k.color } as React.CSSProperties}>
                <div className="platKpiAccent" />
                <div className="platKpiBody">
                  <p className="platKpiLabel">{k.label}</p>
                  <p className="platKpiValue">{k.value}</p>
                </div>
              </div>
            ))}
          </div>

          {pastDue.length > 0 && (
            <div className="platCard">
              <div className="platCardHeader">
                <h3>Past-due accounts</h3>
                <span className="platCardCountRed">{pastDue.length}</span>
              </div>
              <div className="platTableWrap">
                <table className="platTable">
                  <colgroup>
                    <col style={{ width: "25%" }} />
                    <col style={{ width: "30%" }} />
                    <col style={{ width: "15%" }} />
                    <col style={{ width: "15%" }} />
                    <col style={{ width: "15%" }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Clinic</th>
                      <th>Contact</th>
                      <th>Plan</th>
                      <th style={{ textAlign: "right" }}>Expected MRR</th>
                      <th style={{ textAlign: "right" }}>Last active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pastDue.map((s) => (
                      <tr key={s.id} className="platRowUrgent">
                        <td><span className="platSubName">{s.name}</span></td>
                        <td><span className="platSubMeta">{s.contactEmail}</span></td>
                        <td><span className="platBadge platBadgeGrey" style={{ textTransform: "capitalize" }}>{s.plan}</span></td>
                        <td className="platNumCell">{fmtGbp(s.mrrGbp || 599)}</td>
                        <td style={{ fontSize: "0.78rem", color: "var(--muted)", textAlign: "right" }}>{s.lastActiveDate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="platCard">
            <div className="platCardHeader"><h3>MRR history</h3></div>
            <div className="platTableWrap">
              <table className="platTable">
                <colgroup>
                  <col style={{ width: "20%" }} />
                  <col style={{ width: "20%" }} />
                  <col style={{ width: "20%" }} />
                  <col style={{ width: "20%" }} />
                  <col style={{ width: "20%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>Month</th>
                    <th style={{ textAlign: "right" }}>MRR</th>
                    <th style={{ textAlign: "right" }}>New MRR</th>
                    <th style={{ textAlign: "right" }}>Churn</th>
                    <th style={{ textAlign: "right" }}>Expansion</th>
                  </tr>
                </thead>
                <tbody>
                  {[...REVENUE_MONTHS].reverse().map((m) => (
                    <tr key={m.month}>
                      <td style={{ fontSize: "0.8rem", fontWeight: 600 }}>{m.month}</td>
                      <td className="platNumCell">{fmtGbp(m.mrrGbp)}</td>
                      <td className="platNumCell" style={{ color: "#059669" }}>{m.newMrr > 0 ? `+${fmtGbp(m.newMrr)}` : "—"}</td>
                      <td className="platNumCell" style={{ color: "#dc2626" }}>{m.churnedMrr > 0 ? `−${fmtGbp(m.churnedMrr)}` : "—"}</td>
                      <td className="platNumCell" style={{ color: "#2a4db7" }}>{m.expansionMrr > 0 ? `+${fmtGbp(m.expansionMrr)}` : "—"}</td>
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
