"use client";

import { useCallback, useEffect, useState } from "react";

type TrainingRecord = {
  id: string;
  user_id: string;
  user_name: string | null;
  training_name: string;
  provider: string | null;
  completed_date: string | null;
  expiry_date: string | null;
  is_mandatory: boolean;
  certificate_url: string | null;
  notes: string | null;
  status: string;
};

function getApiBase() { return process.env.NEXT_PUBLIC_API_BASE ?? ""; }

const STATUS_COLORS: Record<string, string> = {
  completed: "#dcfce7",
  expired: "#fce7f3",
  due_soon: "#fef3c7",
  not_started: "#f1f5f9",
};

export function HrTrainingContent({ isAdmin = false }: { isAdmin?: boolean }) {
  const [records, setRecords] = useState<TrainingRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ training_name: "", provider: "", completed_date: "", expiry_date: "", is_mandatory: false, notes: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${getApiBase()}/api/v1/hr/training`, { credentials: "include" });
      const j = await r.json().catch(() => []);
      setRecords(Array.isArray(j) ? j : []);
    } catch { setError("Failed to load training records"); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function submit() {
    if (!form.training_name) return;
    setSaving(true);
    try {
      await fetch(`${getApiBase()}/api/v1/hr/training`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form }),
      });
      setShowNew(false); void load();
    } catch { setError("Failed to save"); }
    finally { setSaving(false); }
  }

  return (
    <>
      <style>{`
        .tr-table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden}
        .tr-table th{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#94a3b8;padding:10px 14px;text-align:left;border-bottom:1px solid #e2e8f0}
        .tr-table td{padding:11px 14px;border-bottom:1px solid #f1f5f9;font-size:13px}
        .tr-table tr:last-child td{border-bottom:none}
        .tr-badge{font-size:11px;font-weight:700;padding:3px 9px;border-radius:99px;text-transform:capitalize}
        .tr-new-btn{padding:8px 16px;background:#eff6ff;color:#1e40af;border:1.5px solid #1e40af;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;margin-bottom:16px}
        .tr-input{border:1.5px solid #e2e8f0;border-radius:7px;padding:7px 10px;font-size:13px;font-family:inherit;outline:none;width:100%;box-sizing:border-box}
        .tr-input:focus{border-color:#1e40af}
        .tr-save-btn{padding:7px 16px;background:#1e40af;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit}
      `}</style>

      {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: 10, color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</div>}

      <button className="tr-new-btn" onClick={() => setShowNew(!showNew)}>
        {showNew ? "✕ Cancel" : "+ Log Training"}
      </button>

      {showNew && (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 18, marginBottom: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 3 }}>Training name *</label>
              <input className="tr-input" value={form.training_name} onChange={(e) => setForm({ ...form, training_name: e.target.value })} placeholder="e.g. Safeguarding Level 2" />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 3 }}>Provider</label>
              <input className="tr-input" value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} placeholder="Provider name" />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 3 }}>Completed date</label>
              <input className="tr-input" type="date" value={form.completed_date} onChange={(e) => setForm({ ...form, completed_date: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 3 }}>Expiry date</label>
              <input className="tr-input" type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <input type="checkbox" id="mandatory" checked={form.is_mandatory} onChange={(e) => setForm({ ...form, is_mandatory: e.target.checked })} />
            <label htmlFor="mandatory" style={{ fontSize: 13, color: "#374151" }}>Mandatory training</label>
          </div>
          <button className="tr-save-btn" disabled={saving || !form.training_name} onClick={submit}>{saving ? "Saving…" : "Save"}</button>
        </div>
      )}

      <table className="tr-table">
        <thead>
          <tr>
            <th>Staff</th>
            <th>Training</th>
            <th>Provider</th>
            <th>Completed</th>
            <th>Expires</th>
            <th>Mandatory</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {records.length === 0 ? (
            <tr><td colSpan={7} style={{ textAlign: "center", color: "#94a3b8", padding: 32 }}>No training records</td></tr>
          ) : records.map((r) => (
            <tr key={r.id}>
              <td style={{ fontWeight: 600 }}>{r.user_name ?? "—"}</td>
              <td>{r.training_name}</td>
              <td>{r.provider ?? "—"}</td>
              <td>{r.completed_date ?? "—"}</td>
              <td>{r.expiry_date ?? "—"}</td>
              <td>{r.is_mandatory ? "Yes" : "No"}</td>
              <td><span className="tr-badge" style={{ background: STATUS_COLORS[r.status] ?? "#f1f5f9" }}>{r.status.replace(/_/g, " ")}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
