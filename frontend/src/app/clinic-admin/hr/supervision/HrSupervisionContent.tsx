"use client";

import { useCallback, useEffect, useState } from "react";

type SupervisionRecord = {
  id: string;
  supervisee_id: string;
  supervisee_name: string | null;
  supervisor_id: string | null;
  supervisor_name: string | null;
  session_date: string;
  duration_minutes: number | null;
  session_type: string;
  notes: string | null;
  next_session_date: string | null;
  created_at: string | null;
};

function getApiBase() { return process.env.NEXT_PUBLIC_API_BASE ?? ""; }

export function HrSupervisionContent({ isAdmin = false }: { isAdmin?: boolean }) {
  const [records, setRecords] = useState<SupervisionRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ session_date: "", duration_minutes: "", session_type: "individual", notes: "", next_session_date: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${getApiBase()}/api/v1/hr/supervision`, { credentials: "include" });
      const j = await r.json().catch(() => []);
      setRecords(Array.isArray(j) ? j : []);
    } catch { setError("Failed to load supervision records"); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function submit() {
    if (!form.session_date) return;
    setSaving(true);
    try {
      const body: Record<string, string | number> = { session_date: form.session_date, session_type: form.session_type };
      if (form.duration_minutes) body.duration_minutes = parseInt(form.duration_minutes);
      if (form.notes) body.notes = form.notes;
      if (form.next_session_date) body.next_session_date = form.next_session_date;
      await fetch(`${getApiBase()}/api/v1/hr/supervision`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setShowNew(false); void load();
    } catch { setError("Failed to save"); }
    finally { setSaving(false); }
  }

  return (
    <>
      <style>{`
        .sv-table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden}
        .sv-table th{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#94a3b8;padding:10px 14px;text-align:left;border-bottom:1px solid #e2e8f0}
        .sv-table td{padding:11px 14px;border-bottom:1px solid #f1f5f9;font-size:13px}
        .sv-table tr:last-child td{border-bottom:none}
        .sv-badge{font-size:11px;font-weight:700;padding:2px 8px;border-radius:6px;background:#dbeafe;color:#1e40af;text-transform:capitalize}
        .sv-new-btn{padding:8px 16px;background:#eff6ff;color:#1e40af;border:1.5px solid #1e40af;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;margin-bottom:16px}
        .sv-input{border:1.5px solid #e2e8f0;border-radius:7px;padding:7px 10px;font-size:13px;font-family:inherit;outline:none;width:100%;box-sizing:border-box}
        .sv-input:focus{border-color:#1e40af}
        .sv-save-btn{padding:7px 16px;background:#1e40af;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit}
      `}</style>

      {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: 10, color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</div>}

      <button className="sv-new-btn" onClick={() => setShowNew(!showNew)}>
        {showNew ? "✕ Cancel" : "+ Log Session"}
      </button>

      {showNew && (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 18, marginBottom: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 3 }}>Session date</label>
              <input className="sv-input" type="date" value={form.session_date} onChange={(e) => setForm({ ...form, session_date: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 3 }}>Duration (min)</label>
              <input className="sv-input" type="number" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} placeholder="60" />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 3 }}>Type</label>
              <select className="sv-input" value={form.session_type} onChange={(e) => setForm({ ...form, session_type: e.target.value })}>
                <option value="individual">Individual</option>
                <option value="group">Group</option>
                <option value="peer">Peer</option>
              </select>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 3 }}>Notes</label>
              <input className="sv-input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Session notes…" />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 3 }}>Next session</label>
              <input className="sv-input" type="date" value={form.next_session_date} onChange={(e) => setForm({ ...form, next_session_date: e.target.value })} />
            </div>
          </div>
          <button className="sv-save-btn" disabled={saving || !form.session_date} onClick={submit}>{saving ? "Saving…" : "Log Session"}</button>
        </div>
      )}

      <table className="sv-table">
        <thead>
          <tr>
            <th>Supervisee</th>
            <th>Supervisor</th>
            <th>Date</th>
            <th>Duration</th>
            <th>Type</th>
            <th>Next session</th>
          </tr>
        </thead>
        <tbody>
          {records.length === 0 ? (
            <tr><td colSpan={6} style={{ textAlign: "center", color: "#94a3b8", padding: 32 }}>No supervision records</td></tr>
          ) : records.map((r) => (
            <tr key={r.id}>
              <td style={{ fontWeight: 600 }}>{r.supervisee_name ?? "—"}</td>
              <td>{r.supervisor_name ?? "—"}</td>
              <td>{r.session_date}</td>
              <td>{r.duration_minutes ? `${r.duration_minutes} min` : "—"}</td>
              <td><span className="sv-badge">{r.session_type}</span></td>
              <td>{r.next_session_date ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
