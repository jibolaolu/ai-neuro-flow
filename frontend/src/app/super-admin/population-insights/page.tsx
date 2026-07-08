import { RoleDashboardShell } from "../../../components/role-dashboard-shell";
import { getSuperAdminNav } from "../../../lib/super-admin-nav";
import { serverAuthedGetJson } from "../../../lib/api-server";

type ScoreBenchmark = { n: number; mean: number; min: number; max: number };

type PopulationInsights = {
  scope: string;
  total_clients: number;
  pathway_distribution: Record<string, number>;
  status_distribution: Record<string, number>;
  score_benchmarks: Record<string, ScoreBenchmark>;
  avg_days_to_completion: number | null;
  completion_rate: number | null;
};

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <article style={{ padding: "18px 20px", border: "1px solid var(--card-border)", borderRadius: 10, background: "var(--card-bg)" }}>
      <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--muted)", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--brand)", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: 4 }}>{sub}</div>}
    </article>
  );
}

function BarChart({ data, label }: { data: Record<string, number>; label: string }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(...entries.map(([, v]) => v), 1);
  return (
    <div style={{ marginBottom: 24 }}>
      <h4 style={{ fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)", marginBottom: 12 }}>{label}</h4>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {entries.map(([key, val]) => (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 140, fontSize: "0.78rem", color: "var(--ink)", textAlign: "right", flexShrink: 0, textTransform: "capitalize" }}>{key.replace(/_/g, " ")}</div>
            <div style={{ flex: 1, background: "var(--muted-100)", borderRadius: 4, height: 14, overflow: "hidden" }}>
              <div style={{ width: `${(val / max) * 100}%`, background: "var(--brand)", height: "100%", borderRadius: 4, transition: "width 0.5s" }} />
            </div>
            <div style={{ width: 36, fontSize: "0.78rem", fontWeight: 700, color: "var(--brand)", textAlign: "right" }}>{val}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScoreTable({ benchmarks }: { benchmarks: Record<string, ScoreBenchmark> }) {
  const rows = Object.entries(benchmarks);
  if (rows.length === 0) return <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>No score data yet.</p>;
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid var(--muted-200)" }}>
            {["Instrument", "N", "Mean", "Min", "Max"].map((h) => (
              <th key={h} style={{ padding: "6px 10px", textAlign: h === "Instrument" ? "left" : "right", fontWeight: 700, color: "var(--muted)", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([instr, bm]) => (
            <tr key={instr} style={{ borderBottom: "1px solid var(--muted-100)" }}>
              <td style={{ padding: "8px 10px", fontWeight: 600, color: "var(--ink)" }}>{instr}</td>
              <td style={{ padding: "8px 10px", textAlign: "right", color: "var(--muted)" }}>{bm.n}</td>
              <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: "var(--brand)" }}>{bm.mean.toFixed(1)}</td>
              <td style={{ padding: "8px 10px", textAlign: "right", color: "var(--muted)" }}>{bm.min.toFixed(1)}</td>
              <td style={{ padding: "8px 10px", textAlign: "right", color: "var(--muted)" }}>{bm.max.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function PopulationInsightsPage() {
  const data = await serverAuthedGetJson<PopulationInsights>("/api/v1/analytics/population-insights");

  return (
    <RoleDashboardShell
      role="super-admin"
      roleLabel="Super Platform Admin"
      sectionLabel="Analytics"
      title="Population-level insights"
      navGroups={getSuperAdminNav("/super-admin/population-insights")}
    >
      <div className="page-shell">
        <div className="platShell">
          <div className="platHeader">
            <div>
              <h2 className="platHeaderTitle">Population Insights</h2>
              <p className="platHeaderSub">
                {data ? `${data.scope === "platform" ? "Cross-clinic platform aggregate" : "Clinic aggregate"} · ${data.total_clients} total clients` : "Loading…"}
              </p>
            </div>
          </div>

          {!data ? (
            <p style={{ color: "var(--muted)", padding: "2rem" }}>Could not load insights data.</p>
          ) : (
            <>
              {/* KPI row */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14, marginBottom: 24 }}>
                <Stat label="Total clients" value={data.total_clients} />
                <Stat
                  label="Completion rate"
                  value={data.completion_rate != null ? `${Math.round(data.completion_rate * 100)}%` : "—"}
                  sub="Assessment forms completed"
                />
                <Stat
                  label="Avg. days to completion"
                  value={data.avg_days_to_completion != null ? `${Math.round(data.avg_days_to_completion)}d` : "—"}
                  sub="From referral to assessment"
                />
                <Stat label="Pathways" value={Object.keys(data.pathway_distribution).length} sub="Active assessment types" />
              </div>

              {/* Charts row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
                <div className="platCard">
                  <div className="platCardHeader"><h3>Pathway distribution</h3></div>
                  <div style={{ padding: "0 16px 16px" }}>
                    <BarChart data={data.pathway_distribution} label="Clients per pathway" />
                  </div>
                </div>
                <div className="platCard">
                  <div className="platCardHeader"><h3>Status distribution</h3></div>
                  <div style={{ padding: "0 16px 16px" }}>
                    <BarChart data={data.status_distribution} label="Clients per status" />
                  </div>
                </div>
              </div>

              {/* Score benchmarks */}
              <div className="platCard">
                <div className="platCardHeader"><h3>Score benchmarks by instrument</h3></div>
                <div style={{ padding: "8px 16px 16px" }}>
                  <ScoreTable benchmarks={data.score_benchmarks} />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </RoleDashboardShell>
  );
}
