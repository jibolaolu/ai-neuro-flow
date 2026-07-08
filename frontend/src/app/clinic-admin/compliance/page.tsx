"use client";
import { useEffect, useState } from "react";
import { browserApiUrl } from "../../../lib/get-api-base";

type DashboardData = {
  generated_at: string;
  total_clients: number;
  consent_rate_pct: number;
  forms_outstanding: number;
  avg_report_turnaround_days: number;
  max_report_turnaround_days: number;
  total_reports_issued: number;
  safeguarding_flags_total: number;
  notes_total: number;
  notes_last_30d: number;
  clients_unassigned: number;
  overdue_consent_forms: number;
  recent_activity: { timestamp: string|null; event: string; actor: string; client_id: string }[];
};

function kpiColor(value: number, good: number, warn: number, invert = false): string {
  if (invert) {
    if (value <= good) return "#22c55e";
    if (value <= warn) return "#f59e0b";
    return "#ef4444";
  }
  if (value >= good) return "#22c55e";
  if (value >= warn) return "#f59e0b";
  return "#ef4444";
}

export default function CompliancePage() {
  const [data, setData] = useState<DashboardData|null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview"|"audit">("overview");
  const [auditEvents, setAuditEvents] = useState<{ timestamp: string|null; event_type: string; description: string; actor: string; client_id: string }[]>([]);

  useEffect(() => {
    void fetch(browserApiUrl("/api/v1/compliance/dashboard"), { credentials: "include" })
      .then(r => r.ok ? r.json() : null).then(d => { setData(d as DashboardData); setLoading(false); });
  }, []);

  async function loadAudit() {
    const r = await fetch(browserApiUrl("/api/v1/compliance/audit-trail?limit=50"), { credentials: "include" });
    if (r.ok) { const d = await r.json() as { events: typeof auditEvents }; setAuditEvents(d.events); }
  }

  useEffect(() => { if (tab === "audit") void loadAudit(); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const card: React.CSSProperties = { background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 20, marginBottom: 14 };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Loading compliance data…</div>;
  if (!data) return <div style={{ padding: 40, textAlign: "center", color: "var(--danger)" }}>Failed to load dashboard.</div>;

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px" }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
          <div>
            <h1 style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--ink)", margin: 0 }}>CQC Compliance Dashboard</h1>
            <p style={{ color: "var(--muted)", fontSize: "0.82rem", margin: "4px 0 0" }}>
              Governance metrics for CQC inspection readiness · Updated {new Date(data.generated_at).toLocaleTimeString("en-GB")}
            </p>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {(["overview","audit"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: "7px 16px", borderRadius: 8, border: "1px solid var(--card-border)",
                background: tab === t ? "var(--brand)" : "transparent",
                color: tab === t ? "#fff" : "var(--ink)", fontWeight: 600, cursor: "pointer", fontSize: "0.82rem", textTransform: "capitalize"
              }}>{t === "audit" ? "Audit Trail" : "Overview"}</button>
            ))}
          </div>
        </div>
      </div>

      {tab === "overview" && (
        <>
          {/* Governance KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
            {[
              { label: "Consent rate", value: `${data.consent_rate_pct}%`, color: kpiColor(data.consent_rate_pct, 90, 70), good: "≥90% = pass" },
              { label: "Avg report turnaround", value: `${data.avg_report_turnaround_days}d`, color: kpiColor(data.avg_report_turnaround_days, 0, 14, true), good: "<14d target" },
              { label: "Reports issued", value: String(data.total_reports_issued), color: "var(--ink)", good: "" },
              { label: "Overdue consent forms", value: String(data.overdue_consent_forms), color: kpiColor(data.overdue_consent_forms, 0, 3, true), good: "0 = ideal" },
              { label: "Clients unassigned", value: String(data.clients_unassigned), color: kpiColor(data.clients_unassigned, 0, 2, true), good: "0 = ideal" },
              { label: "Safeguarding flags", value: String(data.safeguarding_flags_total), color: data.safeguarding_flags_total > 0 ? "#f59e0b" : "#22c55e", good: "reviewed?" },
            ].map(({ label, value, color, good }) => (
              <div key={label} style={{ ...card, marginBottom: 0, textAlign: "center" }}>
                <div style={{ fontSize: "1.5rem", fontWeight: 800, color }}>{value}</div>
                <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)", marginTop: 2 }}>{label}</div>
                {good && <div style={{ fontSize: "0.65rem", color: "#94a3b8", marginTop: 2 }}>{good}</div>}
              </div>
            ))}
          </div>

          {/* CQC readiness checklist */}
          <div style={card}>
            <h3 style={{ margin: "0 0 14px", fontSize: "0.95rem", fontWeight: 800 }}>CQC Readiness Checklist</h3>
            {[
              { label: "Consent forms completed by all clients", pass: data.consent_rate_pct >= 90 },
              { label: "No clients waiting >6 weeks for report", pass: data.max_report_turnaround_days < 42 },
              { label: "All clients assigned to a clinician", pass: data.clients_unassigned === 0 },
              { label: "No overdue consent forms (>14 days)", pass: data.overdue_consent_forms === 0 },
              { label: "Safeguarding log reviewed", pass: data.safeguarding_flags_total === 0 },
              { label: "Reports issued to completed clients", pass: data.total_reports_issued > 0 },
              { label: "Case notes activity in last 30 days", pass: data.notes_last_30d > 0 },
            ].map(({ label, pass }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--card-border)" }}>
                <span style={{ fontSize: "1rem", flexShrink: 0 }}>{pass ? "✅" : "⚠️"}</span>
                <span style={{ fontSize: "0.85rem", color: pass ? "var(--ink)" : "#92400e", flex: 1 }}>{label}</span>
                <span style={{ fontSize: "0.72rem", fontWeight: 700, color: pass ? "#22c55e" : "#f59e0b" }}>{pass ? "PASS" : "REVIEW"}</span>
              </div>
            ))}
          </div>

          {/* Recent activity */}
          <div style={card}>
            <h3 style={{ margin: "0 0 14px", fontSize: "0.95rem", fontWeight: 800 }}>Recent Activity</h3>
            {data.recent_activity.length === 0 ? (
              <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>No recent activity.</div>
            ) : data.recent_activity.map((ev, i) => (
              <div key={i} style={{ display: "flex", gap: 12, padding: "7px 0", borderBottom: "1px solid var(--card-border)", alignItems: "flex-start" }}>
                <div style={{ fontSize: "0.72rem", color: "var(--muted)", minWidth: 120, flexShrink: 0 }}>
                  {ev.timestamp ? new Date(ev.timestamp).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                </div>
                <div style={{ fontSize: "0.82rem", color: "var(--ink)", flex: 1 }}>{ev.event}</div>
                <div style={{ fontSize: "0.72rem", color: "var(--muted)" }}>{ev.actor}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "audit" && (
        <div style={card}>
          <h3 style={{ margin: "0 0 14px", fontSize: "0.95rem", fontWeight: 800 }}>Full Audit Trail</h3>
          {auditEvents.length === 0 ? <div style={{ color: "var(--muted)" }}>No audit events found.</div>
          : auditEvents.map((ev, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "140px 1fr 100px 80px", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--card-border)", alignItems: "start", fontSize: "0.8rem" }}>
              <span style={{ color: "var(--muted)" }}>{ev.timestamp ? new Date(ev.timestamp).toLocaleString("en-GB") : "—"}</span>
              <span style={{ color: "var(--ink)" }}>{ev.description}</span>
              <span style={{ color: "var(--muted)" }}>{ev.actor}</span>
              <span style={{ color: "var(--muted)", fontSize: "0.7rem" }}>{ev.client_id}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
