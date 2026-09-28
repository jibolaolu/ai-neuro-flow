"use client";

import { useEffect, useState } from "react";

type SurveyItem = {
  id: string;
  client_id: string;
  nps_score: number | null;
  satisfaction_score: number | null;
  communication_score: number | null;
  report_quality_score: number | null;
  free_text: string | null;
  submitted_at: string | null;
  created_at: string;
};

type NpsData = {
  total: number;
  avg_nps: number | null;
  avg_satisfaction: number | null;
  avg_communication: number | null;
  avg_report_quality: number | null;
  items: SurveyItem[];
};

function getApiBase() {
  return process.env.NEXT_PUBLIC_API_BASE ?? "";
}

function ScorePill({ val, max }: { val: number | null; max: number }) {
  if (val === null) return <span style={{ color: "#94a3b8" }}>—</span>;
  const pct = (val / max) * 100;
  const color = pct >= 70 ? "#16a34a" : pct >= 40 ? "#d97706" : "#dc2626";
  return (
    <span style={{ fontWeight: 700, color }}>
      {val}/{max}
    </span>
  );
}

export function NpsContent() {
  const [data, setData] = useState<NpsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${getApiBase()}/api/v1/surveys/results`, { credentials: "include" })
      .then((r) => r.json())
      .then((j) => setData(j as NpsData))
      .catch(() => setError("Failed to load survey data"));
  }, []);

  if (error) return <p style={{ color: "#dc2626", fontSize: 13 }}>{error}</p>;
  if (!data) return <p style={{ color: "#94a3b8", fontSize: 13 }}>Loading…</p>;
  if (data.total === 0) {
    return (
      <div style={{ textAlign: "center", padding: "48px 24px", color: "#94a3b8" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
        <p style={{ fontWeight: 600, color: "#374151", margin: "0 0 4px" }}>No surveys completed yet</p>
        <p style={{ fontSize: 12, margin: 0 }}>Surveys are sent automatically when a report is issued</p>
      </div>
    );
  }

  const npsLabel = (score: number | null) => {
    if (score === null) return "—";
    if (score >= 9) return "Promoter";
    if (score >= 7) return "Passive";
    return "Detractor";
  };

  return (
    <>
      <style>{`
        .nps-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:14px;margin-bottom:28px}
        .nps-card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px 18px}
        .nps-card-val{font-size:32px;font-weight:900;margin:0 0 4px}
        .nps-card-lbl{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8}
        .nps-table{width:100%;border-collapse:collapse}
        .nps-table th{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#94a3b8;padding:0 14px 10px;text-align:left;border-bottom:1px solid #e2e8f0}
        .nps-table td{padding:12px 14px;border-bottom:1px solid #f1f5f9;font-size:13px;vertical-align:middle}
        .nps-table tr:last-child td{border-bottom:none}
        .nps-table tr:hover td{background:#f8fafc}
        .nps-promoter{color:#16a34a;font-weight:700}
        .nps-passive{color:#d97706;font-weight:700}
        .nps-detractor{color:#dc2626;font-weight:700}
      `}</style>

      <div className="nps-grid">
        <div className="nps-card" style={{ borderTop: "3px solid #6366f1" }}>
          <div className="nps-card-val" style={{ color: "#6366f1" }}>{data.total}</div>
          <div className="nps-card-lbl">Surveys completed</div>
        </div>
        <div className="nps-card" style={{ borderTop: "3px solid #0ea5e9" }}>
          <div className="nps-card-val" style={{ color: "#0ea5e9" }}>{data.avg_nps ?? "—"}<span style={{ fontSize: 16, color: "#94a3b8" }}>/10</span></div>
          <div className="nps-card-lbl">Avg NPS score</div>
        </div>
        <div className="nps-card" style={{ borderTop: "3px solid #10b981" }}>
          <div className="nps-card-val" style={{ color: "#10b981" }}>{data.avg_satisfaction ?? "—"}<span style={{ fontSize: 16, color: "#94a3b8" }}>/5</span></div>
          <div className="nps-card-lbl">Avg satisfaction</div>
        </div>
        <div className="nps-card" style={{ borderTop: "3px solid #f59e0b" }}>
          <div className="nps-card-val" style={{ color: "#f59e0b" }}>{data.avg_communication ?? "—"}<span style={{ fontSize: 16, color: "#94a3b8" }}>/5</span></div>
          <div className="nps-card-lbl">Avg communication</div>
        </div>
        <div className="nps-card" style={{ borderTop: "3px solid #8b5cf6" }}>
          <div className="nps-card-val" style={{ color: "#8b5cf6" }}>{data.avg_report_quality ?? "—"}<span style={{ fontSize: 16, color: "#94a3b8" }}>/5</span></div>
          <div className="nps-card-lbl">Avg report quality</div>
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden" }}>
        <table className="nps-table">
          <thead>
            <tr>
              <th>NPS</th>
              <th>Type</th>
              <th>Satisfaction</th>
              <th>Communication</th>
              <th>Report quality</th>
              <th>Feedback</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((s) => {
              const label = npsLabel(s.nps_score);
              return (
                <tr key={s.id}>
                  <td style={{ fontWeight: 800 }}>{s.nps_score ?? "—"}</td>
                  <td>
                    <span className={label === "Promoter" ? "nps-promoter" : label === "Passive" ? "nps-passive" : "nps-detractor"}>
                      {label}
                    </span>
                  </td>
                  <td><ScorePill val={s.satisfaction_score} max={5} /></td>
                  <td><ScorePill val={s.communication_score} max={5} /></td>
                  <td><ScorePill val={s.report_quality_score} max={5} /></td>
                  <td style={{ maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#64748b", fontSize: 12 }}>
                    {s.free_text || <span style={{ color: "#cbd5e1" }}>—</span>}
                  </td>
                  <td style={{ color: "#64748b", fontSize: 12 }}>
                    {s.submitted_at ? new Date(s.submitted_at).toLocaleDateString("en-GB") : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
