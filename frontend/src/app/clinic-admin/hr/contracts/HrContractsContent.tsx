"use client";

import { useCallback, useEffect, useState } from "react";

type ContractRecord = {
  id: string;
  user_id: string;
  user_name: string | null;
  contract_type: string;
  start_date: string;
  end_date: string | null;
  hours_per_week: number | null;
  job_title: string | null;
  salary: number | null;
  pay_type: string | null;
  document_url: string | null;
  status: string;
  notes: string | null;
  created_at: string | null;
};

function getApiBase() { return process.env.NEXT_PUBLIC_API_BASE ?? ""; }

const STATUS_COLORS: Record<string, string> = {
  active: "#dcfce7",
  expired: "#fce7f3",
  terminated: "#f1f5f9",
  pending: "#fef3c7",
};

export function HrContractsContent({ isAdmin = false }: { isAdmin?: boolean }) {
  const [records, setRecords] = useState<ContractRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ contract_type: "permanent", start_date: "", end_date: "", hours_per_week: "", job_title: "", salary: "", pay_type: "annual", notes: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${getApiBase()}/api/v1/hr/contracts`, { credentials: "include" });
      const j = await r.json().catch(() => []);
      setRecords(Array.isArray(j) ? j : []);
    } catch { setError("Failed to load contracts"); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function submit() {
    if (!form.start_date || !form.job_title) return;
    setSaving(true);
    try {
      const body: Record<string, string | number> = { contract_type: form.contract_type, start_date: form.start_date, pay_type: form.pay_type };
      if (form.job_title) body.job_title = form.job_title;
      if (form.end_date) body.end_date = form.end_date;
      if (form.hours_per_week) body.hours_per_week = parseFloat(form.hours_per_week);
      if (form.salary) body.salary = parseFloat(form.salary);
      if (form.notes) body.notes = form.notes;
      await fetch(`${getApiBase()}/api/v1/hr/contracts`, {
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
        .ct-table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden}
        .ct-table th{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#94a3b8;padding:10px 14px;text-align:left;border-bottom:1px solid #e2e8f0}
        .ct-table td{padding:11px 14px;border-bottom:1px solid #f1f5f9;font-size:13px}
        .ct-table tr:last-child td{border-bottom:none}
        .ct-badge{font-size:11px;font-weight:700;padding:3px 9px;border-radius:99px;text-transform:capitalize}
        .ct-new-btn{padding:8px 16px;background:#eff6ff;color:#1e40af;border:1.5px solid #1e40af;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;margin-bottom:16px}
        .ct-input{border:1.5px solid #e2e8f0;border-radius:7px;padding:7px 10px;font-size:13px;font-family:inherit;outline:none;width:100%;box-sizing:border-box}
        .ct-input:focus{border-color:#1e40af}
        .ct-save-btn{padding:7px 16px;background:#1e40af;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit}
        .ct-save-btn:disabled{opacity:.5}
      `}</style>

      {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: 10, color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</div>}

      {isAdmin && (
        <button className="ct-new-btn" onClick={() => setShowNew(!showNew)}>
          {showNew ? "✕ Cancel" : "+ Add Contract"}
        </button>
      )}

      {showNew && isAdmin && (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 18, marginBottom: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 3 }}>Contract type</label>
              <select className="ct-input" value={form.contract_type} onChange={(e) => setForm({ ...form, contract_type: e.target.value })}>
                <option value="permanent">Permanent</option>
                <option value="fixed_term">Fixed Term</option>
                <option value="zero_hours">Zero Hours</option>
                <option value="self_employed">Self Employed</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 3 }}>Job title *</label>
              <input className="ct-input" value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} placeholder="e.g. Consultant Psychologist" />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 3 }}>Start date *</label>
              <input className="ct-input" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 3 }}>End date</label>
              <input className="ct-input" type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 3 }}>Hours / week</label>
              <input className="ct-input" type="number" value={form.hours_per_week} onChange={(e) => setForm({ ...form, hours_per_week: e.target.value })} placeholder="37.5" />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 3 }}>Salary / rate</label>
              <input className="ct-input" type="number" value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} placeholder="0.00" />
            </div>
          </div>
          <button className="ct-save-btn" disabled={saving || !form.start_date || !form.job_title} onClick={submit}>{saving ? "Saving…" : "Save Contract"}</button>
        </div>
      )}

      <table className="ct-table">
        <thead>
          <tr>
            <th>Staff</th>
            <th>Job title</th>
            <th>Type</th>
            <th>Start</th>
            <th>End</th>
            <th>Hours/wk</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {records.length === 0 ? (
            <tr><td colSpan={7} style={{ textAlign: "center", color: "#94a3b8", padding: 32 }}>No contracts on file</td></tr>
          ) : records.map((r) => (
            <tr key={r.id}>
              <td style={{ fontWeight: 600 }}>{r.user_name ?? "—"}</td>
              <td>{r.job_title ?? "—"}</td>
              <td style={{ textTransform: "capitalize" }}>{r.contract_type.replace(/_/g, " ")}</td>
              <td>{r.start_date}</td>
              <td>{r.end_date ?? "Ongoing"}</td>
              <td>{r.hours_per_week ?? "—"}</td>
              <td><span className="ct-badge" style={{ background: STATUS_COLORS[r.status] ?? "#f1f5f9" }}>{r.status}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
