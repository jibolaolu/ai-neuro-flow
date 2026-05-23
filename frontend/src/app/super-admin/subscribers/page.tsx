import { RoleDashboardShell } from "../../../components/role-dashboard-shell";
import { getSuperAdminNav } from "../../../lib/super-admin-nav";
import { SUBSCRIBERS } from "../../../lib/super-admin-data";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "platBadgeGreen", trial: "platBadgeBlue",
    past_due: "platBadgeRed", suspended: "platBadgeAmber", churned: "platBadgeGrey",
  };
  const labels: Record<string, string> = {
    active: "Active", trial: "Trial", past_due: "Past due",
    suspended: "Suspended", churned: "Churned",
  };
  return <span className={`platBadge ${map[status] ?? "platBadgeGrey"}`}>{labels[status] ?? status}</span>;
}

function PlanBadge({ plan }: { plan: string }) {
  const map: Record<string, string> = {
    enterprise: "platBadgePurple", professional: "platBadgeIndigo",
    starter: "platBadgeGrey", trial: "platBadgeBlue",
  };
  const labels: Record<string, string> = {
    enterprise: "Enterprise", professional: "Professional",
    starter: "Starter", trial: "Trial",
  };
  return <span className={`platBadge ${map[plan] ?? "platBadgeGrey"}`}>{labels[plan] ?? plan}</span>;
}

function fmtGbp(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);
}

export default function SubscribersPage() {
  const active   = SUBSCRIBERS.filter((s) => s.status === "active").length;
  const trial    = SUBSCRIBERS.filter((s) => s.status === "trial").length;
  const pastDue  = SUBSCRIBERS.filter((s) => s.status === "past_due").length;
  const churned  = SUBSCRIBERS.filter((s) => s.status === "churned").length;
  const totalMrr = SUBSCRIBERS.filter((s) => s.status === "active").reduce((acc, s) => acc + s.mrrGbp, 0);

  return (
    <RoleDashboardShell
      role="super-admin"
      roleLabel="Super Platform Admin"
      sectionLabel="Subscribers"
      title="All subscriber clinics"
      navGroups={getSuperAdminNav("/super-admin/subscribers")}
    >
      <div className="page-shell">
        <div className="platShell">
          <div className="platHeader">
            <div>
              <h2 className="platHeaderTitle">Subscriber Clinics</h2>
              <p className="platHeaderSub">{SUBSCRIBERS.length} total · {active} active · {trial} trial · {pastDue} past due · {churned} churned</p>
            </div>
          </div>

          <div className="platKpiGrid" style={{ gridTemplateColumns: "repeat(4, minmax(0,1fr))" }}>
            {[
              { label: "Active", value: active, color: "#059669" },
              { label: "Trial",  value: trial,  color: "#3b82f6" },
              { label: "Past due", value: pastDue, color: "#dc2626" },
              { label: "Total MRR", value: fmtGbp(totalMrr), color: "#2a4db7" },
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

          <div className="platCard">
            <div className="platCardHeader">
              <h3>All clinics</h3>
              <span className="platCardCount">{SUBSCRIBERS.length}</span>
            </div>
            <div className="platTableWrap">
              <table className="platTable">
                <colgroup>
                  <col style={{ width: "28%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "11%" }} />
                  <col style={{ width: "11%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>Clinic</th>
                    <th>Plan</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>MRR</th>
                    <th style={{ textAlign: "right" }}>Seats</th>
                    <th style={{ textAlign: "right" }}>Reports</th>
                    <th>Joined</th>
                    <th>Renewal</th>
                  </tr>
                </thead>
                <tbody>
                  {SUBSCRIBERS.map((s) => (
                    <tr key={s.id} className={s.status === "past_due" ? "platRowUrgent" : s.status === "churned" ? "platRowDown" : ""}>
                      <td>
                        <span className="platSubName">{s.name}</span>
                        <span className="platSubMeta">{s.contactEmail}</span>
                      </td>
                      <td><PlanBadge plan={s.plan} /></td>
                      <td><StatusBadge status={s.status} /></td>
                      <td className="platNumCell">{fmtGbp(s.mrrGbp)}</td>
                      <td className="platNumCell">{s.activeSeats}/{s.seats}</td>
                      <td className="platNumCell">{s.reportsThisMonth}</td>
                      <td style={{ fontSize: "0.78rem", color: "var(--muted)", whiteSpace: "nowrap" }}>{s.joinedDate}</td>
                      <td style={{ fontSize: "0.78rem", color: "var(--muted)", whiteSpace: "nowrap" }}>{s.nextRenewalDate}</td>
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
