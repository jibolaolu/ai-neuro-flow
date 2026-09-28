"use client";

import { useCallback, useEffect, useState } from "react";

type LeaveRecord = {
  id: string;
  user_id: string;
  user_name: string | null;
  leave_type: string;
  start_date: string;
  end_date: string;
  days: number | null;
  reason: string | null;
  status: string;
  reviewed_by_name: string | null;
  review_note: string | null;
  created_at: string | null;
};

function getApiBase() {
  return process.env.NEXT_PUBLIC_API_BASE ?? "";
}

const STATUS_COLORS: Record<string, string> = {
  pending: "#fef3c7",
  approved: "#dcfce7",
  declined: "#fce7f3",
};

export function HrLeaveContent({ isAdmin = false }: { isAdmin?: boolean }) {
  const [records, setRecords] = useState<LeaveRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ leave_type: "annual", start_date: "", end_date: "", reason: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${getApiBase()}/api/v1/hr/leave`, { credentials: "include" });
      const j = await r.json().catch(() => []);
      setRecords(Array.isArray(j) ? j : []);
    } catch { setError("Failed to load leave requests"); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function submit() {
    if (!form.start_date || !form.end_date) return;
    setSaving(true);
    try {
      const r = await fetch(`${getApiBase()}/api/v1/hr/leave`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error("Failed");
      setShowNew(false); setForm({ leave_type: "annual", start_date: "", end_date: "", reason: "" });
      void load();
    } catch { setError("Failed to submit request"); }
    finally { setSaving(false); }
  }

  async function review(id: string, status: "approved" | "declined") {
    await fetch(`${getApiBase()}/api/v1/hr/leave/${id}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    void load();
  }

  return (
    <>
      <style>{`
        .hr-table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden}
        .hr-table th{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#94a3b8;padding:10px 14px;text-align:left;border-bottom:1px solid #e2e8f0}
        .hr-table td{padding:12px 14px;border-bottom:1px solid #f1f5f9;font-size:13px;vertical-align:middle}
        .hr-table tr:last-child td{border-bottom:none}
        .hr-badge{font-size:11px;font-weight:700;padding:3px 9px;border-radius:99px}
        .hr-btn{padding:6px 12px;border-radius:7px;font-size:11px;font-weight:700;border:none;cursor:pointer;font-family:inherit;margin-right:4px}
        .hr-btn-approve{background:#dcfce7;color:#15803d}
        .hr-btn-approve:hover{background:#16a34a;color:#fff}
        .hr-btn-decline{background:#fce7f3;color:#be185d}
        .hr-btn-decline:hover{background:#be185d;color:#fff}
        .hr-new-btn{padding:8px 16px;background:#eff6ff;color:#1e40af;border:1.5px solid #1e40af;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;margin-bottom:16px}
        .hr-input{width:100%;border:1.5px solid #e2e8f0;border-radius:8px;padding:7px 11px;font-size:13px;font-family:inherit;box-sizing:border-box;outline:none}
        .hr-input:focus{border-color:#1e40af}
        .hr-save-btn{padding:8px 18px;background:#1e40af;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit}
        .hr-save-btn:disabled{opacity:.5}
      `}</style>

      {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: 10, color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</div>}

      {!isAdmin && (
        <button className="hr-new-btn" onClick={() => setShowNew(!showNew)}>
          {showNew ? "✕ Cancel" : "+ Request Leave"}
        </button>
      )}

      {showNew && !isAdmin && (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 18, marginBottom: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 3 }}>Type</label>
              <select className="hr-input" value={form.leave_type} onChange={(e) => setForm({ ...form, leave_type: e.target.value })}>
                <option value="annual">Annual Leave</option>
                <option value="sick">Sick Leave</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 3 }}>Start date</label>
              <input className="hr-input" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 3 }}>End date</label>
              <input className="hr-input" type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 3 }}>Reason (optional)</label>
            <input className="hr-input" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Brief reason…" />
          </div>
          <button className="hr-save-btn" disabled={saving || !form.start_date || !form.end_date} onClick={submit}>
            {saving ? "Submitting…" : "Submit Request"}
          </button>
        </div>
      )}

      <table className="hr-table">
        <thead>
          <tr>
            <th>Staff</th>
            <th>Type</th>
            <th>Dates</th>
            <th>Days</th>
            <th>Status</th>
            {isAdmin && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {records.length === 0 ? (
            <tr><td colSpan={isAdmin ? 6 : 5} style={{ textAlign: "center", color: "#94a3b8", padding: 32 }}>No leave requests</td></tr>
          ) : records.map((r) => (
            <tr key={r.id}>
              <td style={{ fontWeight: 600 }}>{r.user_name ?? "—"}</td>
              <td style={{ textTransform: "capitalize" }}>{r.leave_type}</td>
              <td>{r.start_date} → {r.end_date}</td>
              <td>{r.days ?? "—"}</td>
              <td>
                <span className="hr-badge" style={{ background: STATUS_COLORS[r.status] ?? "#f1f5f9" }}>
                  {r.status}
                </span>
              </td>
              {isAdmin && r.status === "pending" && (
                <td>
                  <button className="hr-btn hr-btn-approve" onClick={() => void review(r.id, "approved")}>Approve</button>
                  <button className="hr-btn hr-btn-decline" onClick={() => void review(r.id, "declined")}>Decline</button>
                </td>
              )}
              {isAdmin && r.status !== "pending" && <td style={{ color: "#94a3b8", fontSize: 12 }}>Reviewed by {r.reviewed_by_name ?? "—"}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
