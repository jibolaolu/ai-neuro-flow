import { RoleDashboardShell } from "../../../components/role-dashboard-shell";
import { getSuperAdminNav } from "../../../lib/super-admin-nav";
import { serverAuthedGetJson } from "../../../lib/api-server";

type SubscriberRow = {
  id: string;
  name: string;
  plan: string;
  status: string;
  active_seats: number;
  active_clients: number;
  mrr_gbp: number;
  open_support_tickets: number;
  joined_date: string | null;
  contact_email: string;
};

type SubscribersResponse = {
  subscribers: SubscriberRow[];
  totals: { total: number; active: number; trial: number; past_due: number; churned: number; total_mrr: number };
};

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

export default async function SubscribersPage() {
  const data = await serverAuthedGetJson<SubscribersResponse>("/api/v1/analytics/subscribers");
  const subscribers = data?.subscribers ?? [];
  const totals = data?.totals ?? { total: 0, active: 0, trial: 0, past_due: 0, churned: 0, total_mrr: 0 };

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
              <p className="platHeaderSub">
                {totals.total} total · {totals.active} active · {totals.trial} trial ·{" "}
                {totals.past_due} past due · {totals.churned} churned
              </p>
            </div>
          </div>

          <div className="platKpiGrid" style={{ gridTemplateColumns: "repeat(4, minmax(0,1fr))" }}>
            {[
              { label: "Active",    value: totals.active,          color: "#059669" },
              { label: "Trial",     value: totals.trial,           color: "#3b82f6" },
              { label: "Past due",  value: totals.past_due,        color: "#dc2626" },
              { label: "Total MRR", value: fmtGbp(totals.total_mrr), color: "#2a4db7" },
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
              <span className="platCardCount">{totals.total}</span>
            </div>
            <div className="platTableWrap">
              <table className="platTable">
                <colgroup>
                  <col style={{ width: "28%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "10%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>Clinic</th>
                    <th>Plan</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>MRR</th>
                    <th style={{ textAlign: "right" }}>Users</th>
                    <th style={{ textAlign: "right" }}>Clients</th>
                    <th style={{ textAlign: "right" }}>Tickets</th>
                    <th>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {subscribers.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: "center", color: "var(--muted)", padding: "2rem" }}>No clinics registered yet.</td></tr>
                  ) : subscribers.map((s) => (
                    <tr key={s.id} className={s.status === "past_due" ? "platRowUrgent" : s.status === "churned" ? "platRowDown" : ""}>
                      <td>
                        <span className="platSubName">{s.name}</span>
                        <span className="platSubMeta">{s.contact_email}</span>
                      </td>
                      <td><PlanBadge plan={s.plan} /></td>
                      <td><StatusBadge status={s.status} /></td>
                      <td className="platNumCell">{fmtGbp(s.mrr_gbp)}</td>
                      <td className="platNumCell">{s.active_seats}</td>
                      <td className="platNumCell">{s.active_clients}</td>
                      <td className="platNumCell">{s.open_support_tickets}</td>
                      <td style={{ fontSize: "0.78rem", color: "var(--muted)", whiteSpace: "nowrap" }}>{s.joined_date ?? "—"}</td>
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
