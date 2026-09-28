"use client";

import { useCallback, useEffect, useState } from "react";

type AnalyticsData = {
  total_clients: number;
  total_assessments: number;
  reports_issued: number;
  avg_report_turnaround_days: number | null;
  active_clinicians: number;
  nps_avg: number | null;
  satisfaction_avg: number | null;
  assessments_by_type: Record<string, number>;
  clinician_workloads: { name: string; active_count: number }[];
};

function getApiBase() { return process.env.NEXT_PUBLIC_API_BASE ?? ""; }

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "18px 20px" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: "1.7rem", fontWeight: 800, color: "#0f172a", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export function AnalyticsContent() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [clientsR, assessR, surveyR, usersR] = await Promise.all([
        fetch(`${getApiBase()}/api/v1/clients/`, { credentials: "include" }),
        fetch(`${getApiBase()}/api/v1/assessments/`, { credentials: "include" }),
        fetch(`${getApiBase()}/api/v1/surveys/results`, { credentials: "include" }),
        fetch(`${getApiBase()}/api/v1/users/`, { credentials: "include" }),
      ]);
      const clients = await clientsR.json().catch(() => ({ items: [] }));
      const assessments = await assessR.json().catch(() => ({ items: [] }));
      const survey = await surveyR.json().catch(() => ({}));
      const users = await usersR.json().catch(() => ({ items: [] }));

      const clientList = clients.items ?? [];
      const assessList = assessments.items ?? [];
      const userList = users.items ?? [];

      const byType: Record<string, number> = {};
      for (const a of assessList) {
        const t = a.pathway ?? a.assessment_type ?? "unknown";
        byType[t] = (byType[t] ?? 0) + 1;
      }

      const clinicians = userList.filter((u: { role: string }) => u.role === "clinician" || u.role === "senior-clinician");
      const workloads = clinicians.map((c: { full_name: string; id: string }) => ({
        name: c.full_name ?? "—",
        active_count: assessList.filter((a: { assigned_clinician_id: string; status: string }) => a.assigned_clinician_id === c.id && a.status === "in_progress").length,
      })).sort((a: { active_count: number }, b: { active_count: number }) => b.active_count - a.active_count).slice(0, 8);

      setData({
        total_clients: clientList.length,
        total_assessments: assessList.length,
        reports_issued: assessList.filter((a: { status: string }) => a.status === "completed").length,
        avg_report_turnaround_days: null,
        active_clinicians: clinicians.length,
        nps_avg: survey.avg_nps ?? null,
        satisfaction_avg: survey.avg_satisfaction ?? null,
        assessments_by_type: byType,
        clinician_workloads: workloads,
      });
    } catch { setError("Failed to load analytics data"); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (error) return <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: 12, color: "#dc2626", fontSize: 13 }}>{error}</div>;
  if (!data) return <div style={{ color: "#94a3b8", fontSize: 13, padding: 32 }}>Loading analytics…</div>;

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
        <StatCard label="Total clients" value={data.total_clients} />
        <StatCard label="Total assessments" value={data.total_assessments} />
        <StatCard label="Reports issued" value={data.reports_issued} />
        <StatCard label="Active clinicians" value={data.active_clinicians} />
        {data.nps_avg != null && <StatCard label="Avg NPS score" value={data.nps_avg.toFixed(1)} sub="/ 10" />}
        {data.satisfaction_avg != null && <StatCard label="Avg satisfaction" value={data.satisfaction_avg.toFixed(1)} sub="/ 5" />}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: "0.95rem", fontWeight: 800, color: "#0f172a" }}>Assessments by type</h3>
          {Object.keys(data.assessments_by_type).length === 0 ? (
            <p style={{ color: "#94a3b8", fontSize: 13 }}>No data yet</p>
          ) : Object.entries(data.assessments_by_type).map(([type, count]) => {
            const max = Math.max(...Object.values(data.assessments_by_type));
            const pct = max > 0 ? (count / max) * 100 : 0;
            return (
              <div key={type} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 600, marginBottom: 3 }}>
                  <span style={{ textTransform: "capitalize" }}>{type.replace(/_/g, " ")}</span>
                  <span style={{ color: "#64748b" }}>{count}</span>
                </div>
                <div style={{ height: 8, background: "#f1f5f9", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: "#1e40af", borderRadius: 4 }} />
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: "0.95rem", fontWeight: 800, color: "#0f172a" }}>Clinician workloads</h3>
          {data.clinician_workloads.length === 0 ? (
            <p style={{ color: "#94a3b8", fontSize: 13 }}>No active assessments</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ fontSize: 11, fontWeight: 800, color: "#94a3b8", textAlign: "left", paddingBottom: 8, textTransform: "uppercase", letterSpacing: ".06em" }}>Clinician</th>
                  <th style={{ fontSize: 11, fontWeight: 800, color: "#94a3b8", textAlign: "right", paddingBottom: 8, textTransform: "uppercase", letterSpacing: ".06em" }}>Active</th>
                </tr>
              </thead>
              <tbody>
                {data.clinician_workloads.map((c) => (
                  <tr key={c.name}>
                    <td style={{ fontSize: 13, padding: "6px 0", fontWeight: 600 }}>{c.name}</td>
                    <td style={{ fontSize: 13, padding: "6px 0", textAlign: "right" }}>
                      <span style={{ background: c.active_count > 5 ? "#fce7f3" : "#dcfce7", color: c.active_count > 5 ? "#be185d" : "#15803d", fontWeight: 700, fontSize: 12, padding: "2px 8px", borderRadius: 6 }}>
                        {c.active_count}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
