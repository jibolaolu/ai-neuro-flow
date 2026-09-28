"use client";

import { useCallback, useEffect, useState } from "react";

type Timesheet = {
  id: string;
  user_id: string;
  user_name: string | null;
  week_start: string;
  mon_hours: number | null;
  tue_hours: number | null;
  wed_hours: number | null;
  thu_hours: number | null;
  fri_hours: number | null;
  sat_hours: number | null;
  sun_hours: number | null;
  total_hours: number | null;
  notes: string | null;
  status: string;
};

function getApiBase() { return process.env.NEXT_PUBLIC_API_BASE ?? ""; }

const STATUS_COLORS: Record<string, string> = {
  draft: "#f1f5f9",
  submitted: "#fef3c7",
  approved: "#dcfce7",
  rejected: "#fce7f3",
};

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

export function HrTimesheetsContent({ isAdmin = false }: { isAdmin?: boolean }) {
  const [records, setRecords] = useState<Timesheet[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ week_start: "", mon_hours: "", tue_hours: "", wed_hours: "", thu_hours: "", fri_hours: "", sat_hours: "", sun_hours: "", notes: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${getApiBase()}/api/v1/hr/timesheets`, { credentials: "include" });
      const j = await r.json().catch(() => []);
      setRecords(Array.isArray(j) ? j : []);
    } catch { setError("Failed to load timesheets"); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function submit() {
    if (!form.week_start) return;
    setSaving(true);
    try {
      const body: Record<string, string | number> = { week_start: form.week_start };
      DAYS.forEach((d) => { const v = form[`${d}_hours` as keyof typeof form]; if (v) body[`${d}_hours`] = parseFloat(v); });
      if (form.notes) body.notes = form.notes;
      const r = await fetch(`${getApiBase()}/api/v1/hr/timesheets`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error("Failed");
      setShowNew(false); void load();
    } catch { setError("Failed to save timesheet"); }
    finally { setSaving(false); }
  }

  async function review(id: string, status: "approved" | "rejected") {
    await fetch(`${getApiBase()}/api/v1/hr/timesheets/${id}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    void load();
  }

  return (
    <>
      <style>{`
        .ts-table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden}
        .ts-table th{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#94a3b8;padding:10px 14px;text-align:left;border-bottom:1px solid #e2e8f0}
        .ts-table td{padding:11px 14px;border-bottom:1px solid #f1f5f9;font-size:13px;vertical-align:middle}
        .ts-table tr:last-child td{border-bottom:none}
        .ts-badge{font-size:11px;font-weight:700;padding:3px 9px;border-radius:99px;text-transform:capitalize}
        .ts-btn{padding:5px 11px;border-radius:7px;font-size:11px;font-weight:700;border:none;cursor:pointer;font-family:inherit;margin-right:4px}
        .ts-new-btn{padding:8px 16px;background:#eff6ff;color:#1e40af;border:1.5px solid #1e40af;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;margin-bottom:16px}
        .ts-input{border:1.5px solid #e2e8f0;border-radius:7px;padding:6px 10px;font-size:13px;font-family:inherit;outline:none;width:100%;box-sizing:border-box}
        .ts-input:focus{border-color:#1e40af}
        .ts-save-btn{padding:7px 16px;background:#1e40af;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit}
        .ts-save-btn:disabled{opacity:.5}
      `}</style>

      {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: 10, color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</div>}

      {!isAdmin && (
        <button className="ts-new-btn" onClick={() => setShowNew(!showNew)}>
          {showNew ? "✕ Cancel" : "+ Submit Timesheet"}
        </button>
      )}

      {showNew && !isAdmin && (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 18, marginBottom: 18 }}>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 3 }}>Week starting</label>
            <input className="ts-input" type="date" value={form.week_start} onChange={(e) => setForm({ ...form, week_start: e.target.value })} style={{ maxWidth: 200 }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 8, marginBottom: 12 }}>
            {DAYS.map((d) => (
              <div key={d}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 3, textTransform: "capitalize" }}>{d}</label>
                <input className="ts-input" type="number" min="0" max="24" step="0.5" value={form[`${d}_hours` as keyof typeof form]} onChange={(e) => setForm({ ...form, [`${d}_hours`]: e.target.value })} placeholder="0" />
              </div>
            ))}
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 3 }}>Notes</label>
            <input className="ts-input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes…" />
          </div>
          <button className="ts-save-btn" disabled={saving || !form.week_start} onClick={submit}>{saving ? "Saving…" : "Submit"}</button>
        </div>
      )}

      <table className="ts-table">
        <thead>
          <tr>
            <th>Staff</th>
            <th>Week</th>
            <th>Total hrs</th>
            <th>Status</th>
            {isAdmin && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {records.length === 0 ? (
            <tr><td colSpan={isAdmin ? 5 : 4} style={{ textAlign: "center", color: "#94a3b8", padding: 32 }}>No timesheets submitted</td></tr>
          ) : records.map((r) => (
            <tr key={r.id}>
              <td style={{ fontWeight: 600 }}>{r.user_name ?? "—"}</td>
              <td>{r.week_start}</td>
              <td>{r.total_hours ?? "—"}</td>
              <td><span className="ts-badge" style={{ background: STATUS_COLORS[r.status] ?? "#f1f5f9" }}>{r.status}</span></td>
              {isAdmin && r.status === "submitted" && (
                <td>
                  <button className="ts-btn" style={{ background: "#dcfce7", color: "#15803d" }} onClick={() => void review(r.id, "approved")}>Approve</button>
                  <button className="ts-btn" style={{ background: "#fce7f3", color: "#be185d" }} onClick={() => void review(r.id, "rejected")}>Reject</button>
                </td>
              )}
              {isAdmin && r.status !== "submitted" && <td style={{ color: "#94a3b8", fontSize: 12 }}>—</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
