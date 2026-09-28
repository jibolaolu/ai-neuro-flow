"use client";

import { useCallback, useEffect, useState } from "react";

type IncidentRecord = {
  id: string;
  reported_by_id: string;
  reported_by_name: string | null;
  incident_date: string;
  incident_type: string;
  severity: string;
  description: string;
  location: string | null;
  persons_involved: string | null;
  immediate_action: string | null;
  status: string;
  resolution: string | null;
  created_at: string | null;
};

function getApiBase() { return process.env.NEXT_PUBLIC_API_BASE ?? ""; }

const SEVERITY_COLORS: Record<string, string> = {
  low: "#dcfce7",
  medium: "#fef3c7",
  high: "#fed7aa",
  critical: "#fce7f3",
};

export function HrIncidentsContent({ isAdmin = false }: { isAdmin?: boolean }) {
  const [records, setRecords] = useState<IncidentRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ incident_date: "", incident_type: "near_miss", severity: "low", description: "", location: "", persons_involved: "", immediate_action: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${getApiBase()}/api/v1/hr/incidents`, { credentials: "include" });
      const j = await r.json().catch(() => []);
      setRecords(Array.isArray(j) ? j : []);
    } catch { setError("Failed to load incidents"); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function submit() {
    if (!form.incident_date || !form.description) return;
    setSaving(true);
    try {
      await fetch(`${getApiBase()}/api/v1/hr/incidents`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setShowNew(false); void load();
    } catch { setError("Failed to submit"); }
    finally { setSaving(false); }
  }

  return (
    <>
      <style>{`
        .inc-table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden}
        .inc-table th{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#94a3b8;padding:10px 14px;text-align:left;border-bottom:1px solid #e2e8f0}
        .inc-table td{padding:11px 14px;border-bottom:1px solid #f1f5f9;font-size:13px}
        .inc-table tr:last-child td{border-bottom:none}
        .inc-badge{font-size:11px;font-weight:700;padding:3px 9px;border-radius:99px;text-transform:capitalize}
        .inc-new-btn{padding:8px 16px;background:#fef2f2;color:#dc2626;border:1.5px solid #dc2626;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;margin-bottom:16px}
        .inc-input{border:1.5px solid #e2e8f0;border-radius:7px;padding:7px 10px;font-size:13px;font-family:inherit;outline:none;width:100%;box-sizing:border-box}
        .inc-input:focus{border-color:#dc2626}
        .inc-save-btn{padding:7px 16px;background:#dc2626;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit}
        .inc-save-btn:disabled{opacity:.5}
        .inc-textarea{border:1.5px solid #e2e8f0;border-radius:7px;padding:7px 10px;font-size:13px;font-family:inherit;outline:none;width:100%;box-sizing:border-box;resize:vertical;min-height:70px}
      `}</style>

      {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: 10, color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</div>}

      <button className="inc-new-btn" onClick={() => setShowNew(!showNew)}>
        {showNew ? "✕ Cancel" : "+ Report Incident"}
      </button>

      {showNew && (
        <div style={{ background: "#fff", border: "1px solid #fee2e2", borderRadius: 12, padding: 18, marginBottom: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 3 }}>Date *</label>
              <input className="inc-input" type="date" value={form.incident_date} onChange={(e) => setForm({ ...form, incident_date: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 3 }}>Type</label>
              <select className="inc-input" value={form.incident_type} onChange={(e) => setForm({ ...form, incident_type: e.target.value })}>
                <option value="near_miss">Near Miss</option>
                <option value="injury">Injury</option>
                <option value="property_damage">Property Damage</option>
                <option value="data_breach">Data Breach</option>
                <option value="complaint">Complaint</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 3 }}>Severity</label>
              <select className="inc-input" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 3 }}>Description *</label>
            <textarea className="inc-textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe what happened…" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 3 }}>Location</label>
              <input className="inc-input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Where did it occur?" />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 3 }}>Persons involved</label>
              <input className="inc-input" value={form.persons_involved} onChange={(e) => setForm({ ...form, persons_involved: e.target.value })} placeholder="Names of those involved" />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 3 }}>Immediate action taken</label>
            <input className="inc-input" value={form.immediate_action} onChange={(e) => setForm({ ...form, immediate_action: e.target.value })} placeholder="What was done immediately?" />
          </div>
          <button className="inc-save-btn" disabled={saving || !form.incident_date || !form.description} onClick={submit}>{saving ? "Submitting…" : "Submit Report"}</button>
        </div>
      )}

      <table className="inc-table">
        <thead>
          <tr>
            <th>Reported by</th>
            <th>Date</th>
            <th>Type</th>
            <th>Severity</th>
            <th>Description</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {records.length === 0 ? (
            <tr><td colSpan={6} style={{ textAlign: "center", color: "#94a3b8", padding: 32 }}>No incidents reported</td></tr>
          ) : records.map((r) => (
            <tr key={r.id}>
              <td style={{ fontWeight: 600 }}>{r.reported_by_name ?? "—"}</td>
              <td>{r.incident_date}</td>
              <td style={{ textTransform: "capitalize" }}>{r.incident_type.replace(/_/g, " ")}</td>
              <td><span className="inc-badge" style={{ background: SEVERITY_COLORS[r.severity] ?? "#f1f5f9" }}>{r.severity}</span></td>
              <td style={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.description}</td>
              <td style={{ textTransform: "capitalize", color: "#64748b", fontSize: 12 }}>{r.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
