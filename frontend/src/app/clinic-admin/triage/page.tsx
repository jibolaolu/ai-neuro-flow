"use client";
import { useEffect, useState } from "react";
import { browserApiUrl } from "../../../lib/get-api-base";

type TriageItem = {
  referral_id: string; patient_name: string; pathway: string;
  priority: string; status: string; wait_days: number;
  triage_score: number; risk_level: "high"|"medium"|"low";
  flags: string[]; gp_practice: string|null; icb_name: string|null;
};
type Summary = { total_waiting: number; high_risk_count: number; breach_risk_count: number; avg_wait_days: number; longest_wait_days: number; };

const RISK_COLOR = { high: "#ef4444", medium: "#f59e0b", low: "#22c55e" };
const RISK_BG   = { high: "#fef2f2", medium: "#fffbeb", low: "#f0fdf4" };

export default function TriagePage() {
  const [items, setItems] = useState<TriageItem[]>([]);
  const [summary, setSummary] = useState<Summary|null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all"|"high"|"medium"|"low">("all");

  useEffect(() => {
    void Promise.all([
      fetch(browserApiUrl("/api/v1/triage/"), { credentials: "include" }).then(r => r.ok ? r.json() : null),
      fetch(browserApiUrl("/api/v1/triage/summary"), { credentials: "include" }).then(r => r.ok ? r.json() : null),
    ]).then(([list, sum]) => {
      if (list) setItems(list.items as TriageItem[]);
      if (sum) setSummary(sum as Summary);
      setLoading(false);
    });
  }, []);

  const filtered = filter === "all" ? items : items.filter(i => i.risk_level === filter);

  const card: React.CSSProperties = { background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 20, marginBottom: 14 };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--ink)", margin: 0 }}>Waiting List Triage</h1>
        <p style={{ color: "var(--muted)", fontSize: "0.85rem", margin: "4px 0 0" }}>Auto-scored by clinical urgency, wait time, and presenting concerns</p>
      </div>

      {/* KPI strip */}
      {summary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 24 }}>
          {[
            { label: "Waiting", value: String(summary.total_waiting), color: "var(--ink)" },
            { label: "High risk", value: String(summary.high_risk_count), color: "#ef4444" },
            { label: "Breach risk", value: String(summary.breach_risk_count), color: "#f59e0b" },
            { label: "Avg wait", value: `${summary.avg_wait_days}d`, color: "var(--ink)" },
            { label: "Longest wait", value: `${summary.longest_wait_days}d`, color: summary.longest_wait_days >= 42 ? "#ef4444" : "var(--ink)" },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ ...card, marginBottom: 0, textAlign: "center" }}>
              <div style={{ fontSize: "1.3rem", fontWeight: 800, color }}>{value}</div>
              <div style={{ fontSize: "0.7rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Risk filter */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {(["all","high","medium","low"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: "6px 14px", borderRadius: 20, border: "1px solid var(--card-border)",
            background: filter === f ? "var(--brand)" : "transparent",
            color: filter === f ? "#fff" : "var(--ink)",
            fontWeight: 600, cursor: "pointer", fontSize: "0.8rem", textTransform: "capitalize"
          }}>{f === "all" ? "All" : `${f.charAt(0).toUpperCase()+f.slice(1)} risk`}</button>
        ))}
      </div>

      {loading ? <div style={{ textAlign: "center", color: "var(--muted)", padding: 40 }}>Loading…</div>
      : filtered.length === 0 ? <div style={{ ...card, textAlign: "center", color: "var(--muted)", padding: 40 }}>No referrals in triage queue.</div>
      : filtered.map((item, idx) => (
        <div key={item.referral_id} style={{ ...card, borderLeft: `4px solid ${RISK_COLOR[item.risk_level]}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8, background: RISK_BG[item.risk_level],
                border: `2px solid ${RISK_COLOR[item.risk_level]}`, display: "grid", placeItems: "center",
                fontWeight: 900, fontSize: "0.75rem", color: RISK_COLOR[item.risk_level], flexShrink: 0,
              }}>#{idx+1}</div>
              <div>
                <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "var(--ink)" }}>{item.patient_name}</div>
                <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
                  {item.pathway} · {item.gp_practice ?? "Unknown GP"} {item.icb_name ? `· ICB: ${item.icb_name}` : ""}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{
                background: RISK_BG[item.risk_level], color: RISK_COLOR[item.risk_level],
                border: `1px solid ${RISK_COLOR[item.risk_level]}44`,
                borderRadius: 6, padding: "2px 10px", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase"
              }}>{item.risk_level} risk</span>
              <span style={{ fontWeight: 800, fontSize: "1rem", color: "var(--ink)" }}>Score: {item.triage_score}</span>
            </div>
          </div>
          <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
            <span style={{ fontSize: "0.72rem", background: "var(--muted-100)", borderRadius: 4, padding: "2px 8px", color: "var(--muted)" }}>
              Wait: {item.wait_days}d
            </span>
            <span style={{ fontSize: "0.72rem", background: item.priority === "urgent" ? "#fef2f2" : "var(--muted-100)", borderRadius: 4, padding: "2px 8px", color: item.priority === "urgent" ? "#dc2626" : "var(--muted)", fontWeight: 700 }}>
              {item.priority}
            </span>
            {item.flags.map((f, i) => (
              <span key={i} style={{ fontSize: "0.72rem", background: "#fef9c3", borderRadius: 4, padding: "2px 8px", color: "#92400e" }}>⚠ {f}</span>
            ))}
          </div>
          <div style={{ marginTop: 10 }}>
            <a href={`/clinic-admin/referrals`} style={{ fontSize: "0.78rem", color: "var(--brand)", fontWeight: 600, textDecoration: "none" }}>
              View referral {item.referral_id} →
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}
