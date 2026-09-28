"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type WaitlistClient = {
  id: string;
  full_name: string;
  email: string;
  pathway: string | null;
  status: string;
  forms_sent?: boolean;
  forms_completed?: number;
  forms_total?: number;
  days_waiting?: number | null;
  clinician_name?: string | null;
  booking_access_token?: string | null;
};

type WaitlistData = {
  awaiting_forms: WaitlistClient[];
  awaiting_clinician: WaitlistClient[];
  awaiting_booking: WaitlistClient[];
  total: number;
};

const TABS = [
  { id: "awaiting_forms", label: "Awaiting Forms", icon: "📋", color: "#f59e0b" },
  { id: "awaiting_clinician", label: "Needs Clinician", icon: "👤", color: "#8b5cf6" },
  { id: "awaiting_booking", label: "Ready to Book", icon: "📅", color: "#10b981" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function getApiBase() {
  return process.env.NEXT_PUBLIC_API_BASE ?? "";
}

export function WaitlistContent() {
  const [data, setData] = useState<WaitlistData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("awaiting_forms");
  const [sending, setSending] = useState<Record<string, boolean>>({});
  const [sent, setSent] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${getApiBase()}/api/v1/waitlist`, { credentials: "include" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.detail ?? "Failed to load waitlist");
      setData(j as WaitlistData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function sendInvite(clientId: string) {
    setSending((s) => ({ ...s, [clientId]: true }));
    try {
      const r = await fetch(`${getApiBase()}/api/v1/waitlist/send-booking-invite/${clientId}`, {
        method: "POST",
        credentials: "include",
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.detail ?? "Send failed");
      setSent((s) => ({ ...s, [clientId]: true }));
    } catch {
      alert("Failed to send invite. Please try again.");
    } finally {
      setSending((s) => ({ ...s, [clientId]: false }));
    }
  }

  const clients: WaitlistClient[] = data ? data[tab] : [];

  return (
    <>
      <style>{`
        .wl-stats{display:flex;gap:14px;flex-wrap:wrap;margin-bottom:24px}
        .wl-stat{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:14px 18px;min-width:140px}
        .wl-stat-n{font-size:28px;font-weight:900;color:#0f172a;display:block}
        .wl-stat-l{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8}
        .wl-tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px}
        .wl-tab{display:flex;align-items:center;gap:6px;padding:8px 16px;border-radius:8px;border:1.5px solid #e2e8f0;background:#fff;font-size:13px;font-weight:600;color:#374151;cursor:pointer;transition:all .15s;font-family:inherit}
        .wl-tab:hover{border-color:#1e40af;color:#1e40af}
        .wl-tab.active{background:#1e40af;border-color:#1e40af;color:#fff}
        .wl-tab-count{background:rgba(0,0,0,.12);border-radius:99px;padding:1px 7px;font-size:11px;font-weight:800}
        .wl-tab.active .wl-tab-count{background:rgba(255,255,255,.25)}
        .wl-table{width:100%;border-collapse:collapse}
        .wl-table th{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#94a3b8;padding:0 14px 10px;text-align:left;border-bottom:1px solid #e2e8f0}
        .wl-table td{padding:14px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#374151;vertical-align:middle}
        .wl-table tr:last-child td{border-bottom:none}
        .wl-table tr:hover td{background:#f8fafc}
        .wl-name{font-weight:700;color:#0f172a;display:block}
        .wl-email{color:#64748b;font-size:12px}
        .wl-badge{font-size:11px;font-weight:700;padding:3px 9px;border-radius:99px}
        .wl-badge-warn{background:#fef3c7;color:#92400e}
        .wl-badge-ok{background:#dcfce7;color:#15803d}
        .wl-badge-purple{background:#f3e8ff;color:#7c3aed}
        .wl-send-btn{font-size:12px;font-weight:700;padding:6px 14px;border-radius:7px;border:1.5px solid #1e40af;background:#eff6ff;color:#1e40af;cursor:pointer;font-family:inherit;transition:all .15s}
        .wl-send-btn:hover:not(:disabled){background:#1e40af;color:#fff}
        .wl-send-btn:disabled{opacity:.5;cursor:not-allowed}
        .wl-send-btn.sent{background:#dcfce7;border-color:#86efac;color:#15803d}
        .wl-empty{text-align:center;padding:48px 24px;color:#94a3b8}
        .wl-empty-icon{font-size:48px;display:block;margin-bottom:12px}
      `}</style>

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: 14, color: "#dc2626", fontSize: 13, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {data && (
        <>
          <div className="wl-stats">
            <div className="wl-stat">
              <strong className="wl-stat-n">{data.total}</strong>
              <span className="wl-stat-l">Total on waitlist</span>
            </div>
            {TABS.map((t) => (
              <div key={t.id} className="wl-stat" style={{ borderTop: `3px solid ${t.color}` }}>
                <strong className="wl-stat-n" style={{ color: t.color }}>{data[t.id].length}</strong>
                <span className="wl-stat-l">{t.label}</span>
              </div>
            ))}
          </div>

          <div className="wl-tabs">
            {TABS.map((t) => (
              <button key={t.id} className={`wl-tab${tab === t.id ? " active" : ""}`} onClick={() => setTab(t.id)}>
                {t.icon} {t.label}
                <span className="wl-tab-count">{data[t.id].length}</span>
              </button>
            ))}
          </div>

          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden" }}>
            {clients.length === 0 ? (
              <div className="wl-empty">
                <span className="wl-empty-icon">✅</span>
                <p style={{ fontWeight: 600, color: "#374151", margin: "0 0 4px" }}>No clients in this queue</p>
                <p style={{ fontSize: 12, margin: 0 }}>All clear in this category</p>
              </div>
            ) : (
              <table className="wl-table">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Pathway</th>
                    {tab === "awaiting_forms" && <><th>Forms</th><th>Days waiting</th></>}
                    {tab === "awaiting_clinician" && <th>Status</th>}
                    {tab === "awaiting_booking" && <th>Clinician</th>}
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <span className="wl-name">{c.full_name}</span>
                        <span className="wl-email">{c.email}</span>
                      </td>
                      <td><span className="wl-badge wl-badge-purple">{c.pathway || "—"}</span></td>
                      {tab === "awaiting_forms" && (
                        <>
                          <td>
                            {c.forms_total ? (
                              <span className={`wl-badge ${c.forms_completed === c.forms_total ? "wl-badge-ok" : "wl-badge-warn"}`}>
                                {c.forms_completed}/{c.forms_total}
                              </span>
                            ) : (
                              <span className="wl-badge wl-badge-warn">Not sent</span>
                            )}
                          </td>
                          <td>
                            {c.days_waiting != null ? (
                              <span style={{ fontWeight: 600, color: (c.days_waiting ?? 0) > 7 ? "#b91c1c" : "#374151" }}>
                                {c.days_waiting}d
                              </span>
                            ) : "—"}
                          </td>
                        </>
                      )}
                      {tab === "awaiting_clinician" && <td><span className="wl-badge wl-badge-warn">{c.status}</span></td>}
                      {tab === "awaiting_booking" && <td>{c.clinician_name || <span style={{ color: "#94a3b8" }}>—</span>}</td>}
                      <td>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <Link href={`/clinic-admin/clients/${c.id}`} style={{ fontSize: 12, fontWeight: 600, color: "#1e40af", textDecoration: "none" }}>View →</Link>
                          {tab === "awaiting_booking" && c.booking_access_token && (
                            <button
                              className={`wl-send-btn${sent[c.id] ? " sent" : ""}`}
                              disabled={sending[c.id] || sent[c.id]}
                              onClick={() => void sendInvite(c.id)}
                            >
                              {sent[c.id] ? "✓ Sent" : sending[c.id] ? "Sending…" : "Send booking invite"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {!data && !error && <p style={{ color: "#94a3b8", fontSize: 13 }}>Loading waitlist…</p>}
    </>
  );
}
