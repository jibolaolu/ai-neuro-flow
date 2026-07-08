import { RoleDashboardShell } from "../../../components/role-dashboard-shell";
import { getSuperAdminNav } from "../../../lib/super-admin-nav";
import { serverAuthedGetJson } from "../../../lib/api-server";

type RevenueMonth = {
  month: string;
  mrr_gbp: number;
  new_mrr: number;
  churned_mrr: number;
  expansion_mrr: number;
};

type SubscriberRow = {
  id: string; name: string; plan: string; status: string;
  mrr_gbp: number; contact_email: string; joined_date: string | null;
};

type RevenueResponse = { months: RevenueMonth[] };
type SubscribersResponse = {
  subscribers: SubscriberRow[];
  totals: { total_mrr: number };
};

function fmtGbp(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);
}

export default async function BillingPage() {
  const [subData, revData] = await Promise.all([
    serverAuthedGetJson<SubscribersResponse>("/api/v1/analytics/subscribers"),
    serverAuthedGetJson<RevenueResponse>("/api/v1/analytics/revenue"),
  ]);

  const subscribers = subData?.subscribers ?? [];
  const totalMrr    = subData?.totals?.total_mrr ?? 0;
  const months      = revData?.months ?? [];

  const pastDue = subscribers.filter((s) => s.status === "past_due");

  const latestMonth = months[months.length - 1];
  const prevMonth   = months[months.length - 2];
  const mrrChange   = latestMonth && prevMonth ? latestMonth.mrr_gbp - prevMonth.mrr_gbp : 0;

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
              <p className="platHeaderSub">Live MRR from registered organizations</p>
            </div>
          </div>

          <div className="platKpiGrid" style={{ gridTemplateColumns: "repeat(4, minmax(0,1fr))" }}>
            {[
              { label: "Current MRR",  value: fmtGbp(totalMrr),            color: "#2a4db7" },
              { label: "MoM change",   value: `${mrrChange >= 0 ? "+" : ""}${fmtGbp(mrrChange)}`, color: mrrChange >= 0 ? "#059669" : "#dc2626" },
              { label: "New MRR",      value: latestMonth ? fmtGbp(latestMonth.new_mrr) : "—",   color: "#059669" },
              { label: "Churn",        value: latestMonth ? `−${fmtGbp(latestMonth.churned_mrr)}` : "—", color: "#dc2626" },
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
                    <col style={{ width: "30%" }} />
                    <col style={{ width: "30%" }} />
                    <col style={{ width: "15%" }} />
                    <col style={{ width: "15%" }} />
                    <col style={{ width: "10%" }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Clinic</th>
                      <th>Contact</th>
                      <th>Plan</th>
                      <th style={{ textAlign: "right" }}>Expected MRR</th>
                      <th>Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pastDue.map((s) => (
                      <tr key={s.id} className="platRowUrgent">
                        <td><span className="platSubName">{s.name}</span></td>
                        <td><span className="platSubMeta">{s.contact_email}</span></td>
                        <td><span className="platBadge platBadgeGrey" style={{ textTransform: "capitalize" }}>{s.plan}</span></td>
                        <td className="platNumCell">{fmtGbp(s.mrr_gbp || 599)}</td>
                        <td style={{ fontSize: "0.78rem", color: "var(--muted)" }}>{s.joined_date ?? "—"}</td>
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
                  {months.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--muted)", padding: "1.5rem" }}>No revenue data yet.</td></tr>
                  ) : [...months].reverse().map((m) => (
                    <tr key={m.month}>
                      <td style={{ fontSize: "0.8rem", fontWeight: 600 }}>{m.month}</td>
                      <td className="platNumCell">{fmtGbp(m.mrr_gbp)}</td>
                      <td className="platNumCell" style={{ color: "#059669" }}>{m.new_mrr > 0 ? `+${fmtGbp(m.new_mrr)}` : "—"}</td>
                      <td className="platNumCell" style={{ color: "#dc2626" }}>{m.churned_mrr > 0 ? `−${fmtGbp(m.churned_mrr)}` : "—"}</td>
                      <td className="platNumCell" style={{ color: "#2a4db7" }}>{m.expansion_mrr > 0 ? `+${fmtGbp(m.expansion_mrr)}` : "—"}</td>
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
