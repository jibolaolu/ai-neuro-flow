"use client";

import { useCallback, useEffect, useState } from "react";

type AuditEntry = {
  id: string;
  event_type: string;
  actor_name: string | null;
  actor_email: string | null;
  target_type: string | null;
  target_name: string | null;
  detail: string | null;
  created_at: string | null;
};

function getApiBase() {
  return process.env.NEXT_PUBLIC_API_BASE ?? "";
}

const EVENT_COLORS: Record<string, string> = {
  incident_reported: "#fef3c7",
  policy_created: "#dbeafe",
  policy_deleted: "#fce7f3",
  user_created: "#dcfce7",
  user_deactivated: "#fce7f3",
  report_issued: "#dcfce7",
};

export function AuditLogContent() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${getApiBase()}/api/v1/audit-log/`, { credentials: "include" });
      const j = await r.json().catch(() => ({ items: [] }));
      setEntries(j.items ?? []);
    } catch { setError("Failed to load audit log"); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = filter
    ? entries.filter((e) =>
        e.event_type.includes(filter) ||
        (e.actor_name ?? "").toLowerCase().includes(filter.toLowerCase()) ||
        (e.target_name ?? "").toLowerCase().includes(filter.toLowerCase())
      )
    : entries;

  return (
    <>
      <style>{`
        .al-input{border:1.5px solid #e2e8f0;border-radius:8px;padding:8px 12px;font-size:13px;font-family:inherit;outline:none;min-width:260px}
        .al-input:focus{border-color:#1e40af}
        .al-table{width:100%;border-collapse:collapse}
        .al-table th{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#94a3b8;padding:0 14px 10px;text-align:left;border-bottom:1px solid #e2e8f0}
        .al-table td{padding:12px 14px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#374151;vertical-align:top}
        .al-table tr:last-child td{border-bottom:none}
        .al-table tr:hover td{background:#f8fafc}
        .al-event{font-weight:700;font-size:11px;padding:2px 8px;border-radius:6px;background:#f1f5f9;color:#475569}
        .al-detail{color:#64748b;font-size:11px;margin-top:2px}
      `}</style>

      {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: 10, color: "#dc2626", fontSize: 13, marginBottom: 14 }}>{error}</div>}

      <div style={{ marginBottom: 16 }}>
        <input className="al-input" placeholder="Filter by event, actor or target…" value={filter} onChange={(e) => setFilter(e.target.value)} />
      </div>

      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden" }}>
        {filtered.length === 0 ? (
          <div style={{ padding: "40px 24px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
            {filter ? "No matching audit entries" : "No audit events recorded yet"}
          </div>
        ) : (
          <table className="al-table">
            <thead>
              <tr>
                <th>Event</th>
                <th>Actor</th>
                <th>Target</th>
                <th>Detail</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id}>
                  <td>
                    <span className="al-event" style={{ background: EVENT_COLORS[e.event_type] ?? "#f1f5f9" }}>
                      {e.event_type.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{e.actor_name ?? "System"}</div>
                    {e.actor_email && <div style={{ color: "#94a3b8", fontSize: 11 }}>{e.actor_email}</div>}
                  </td>
                  <td>
                    {e.target_type && <div style={{ color: "#94a3b8", fontSize: 11, textTransform: "capitalize" }}>{e.target_type}</div>}
                    {e.target_name && <div style={{ fontWeight: 600 }}>{e.target_name}</div>}
                  </td>
                  <td><span className="al-detail">{e.detail ?? "—"}</span></td>
                  <td style={{ color: "#64748b", whiteSpace: "nowrap" }}>
                    {e.created_at ? new Date(e.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
