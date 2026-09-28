"use client";

import { useCallback, useEffect, useState } from "react";

type EmailLog = {
  id: string;
  from_email: string;
  from_name: string | null;
  subject: string;
  received_at: string | null;
  category: string | null;
  urgency: number | null;
  requires_clinician: boolean;
  ai_summary: string | null;
  ai_suggested_reply: string | null;
  status: string;
  body_snippet: string | null;
};

function getApiBase() { return process.env.NEXT_PUBLIC_API_BASE ?? ""; }

const URGENCY_COLORS = ["#f1f5f9", "#dcfce7", "#fef3c7", "#fed7aa", "#fce7f3"];

const CATEGORY_COLORS: Record<string, string> = {
  new_referral: "#dbeafe",
  booking: "#dcfce7",
  report_query: "#fef3c7",
  complaint: "#fce7f3",
  general: "#f1f5f9",
};

export function EmailTriageContent() {
  const [emails, setEmails] = useState<EmailLog[]>([]);
  const [selected, setSelected] = useState<EmailLog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dismissing, setDismissing] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${getApiBase()}/api/v1/email-triage/`, { credentials: "include" });
      const j = await r.json().catch(() => []);
      setEmails(Array.isArray(j) ? j : []);
    } catch { setError("Failed to load email triage"); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function dismiss(id: string) {
    setDismissing(id);
    try {
      await fetch(`${getApiBase()}/api/v1/email-triage/${id}/dismiss`, { method: "POST", credentials: "include" });
      if (selected?.id === id) setSelected(null);
      void load();
    } catch { setError("Failed to dismiss"); }
    finally { setDismissing(null); }
  }

  return (
    <>
      <style>{`
        .et-layout{display:grid;grid-template-columns:360px 1fr;gap:16px;min-height:520px}
        .et-list{background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden}
        .et-item{padding:14px 16px;border-bottom:1px solid #f1f5f9;cursor:pointer;transition:background .15s}
        .et-item:last-child{border-bottom:none}
        .et-item:hover{background:#f8fafc}
        .et-item.active{background:#eff6ff;border-left:3px solid #1e40af}
        .et-detail{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:22px}
        .et-badge{font-size:10px;font-weight:700;padding:2px 7px;border-radius:5px;text-transform:capitalize;margin-right:5px}
        .et-dismiss-btn{padding:6px 14px;background:#f1f5f9;color:#64748b;border:none;border-radius:7px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit}
        .et-dismiss-btn:hover{background:#fce7f3;color:#be185d}
        .et-summary-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;font-size:13px;color:#374151;margin:12px 0}
        .et-reply-box{background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px;font-size:13px;color:#374151;margin:12px 0;font-style:italic}
        @media(max-width:900px){.et-layout{grid-template-columns:1fr}}
      `}</style>

      {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: 10, color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</div>}

      <div className="et-layout">
        <div className="et-list">
          {emails.length === 0 ? (
            <div style={{ padding: "40px 16px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>No emails in triage</div>
          ) : emails.map((e) => (
            <div key={e.id} className={`et-item${selected?.id === e.id ? " active" : ""}`} onClick={() => setSelected(e)}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>{e.from_name ?? e.from_email}</span>
                <span style={{ fontSize: 11, color: "#94a3b8" }}>{e.received_at ? new Date(e.received_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : ""}</span>
              </div>
              <div style={{ fontSize: 12, color: "#374151", marginBottom: 4, fontWeight: 600 }}>{e.subject}</div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {e.category && <span className="et-badge" style={{ background: CATEGORY_COLORS[e.category] ?? "#f1f5f9" }}>{e.category.replace(/_/g, " ")}</span>}
                {e.urgency != null && <span className="et-badge" style={{ background: URGENCY_COLORS[Math.min(e.urgency, 4)] }}>urgency {e.urgency}</span>}
                {e.requires_clinician && <span className="et-badge" style={{ background: "#fce7f3", color: "#be185d" }}>needs clinician</span>}
              </div>
            </div>
          ))}
        </div>

        <div className="et-detail">
          {!selected ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#94a3b8", fontSize: 14 }}>
              Select an email to view details
            </div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                <div>
                  <h3 style={{ margin: "0 0 4px", fontSize: "1.1rem", fontWeight: 800, color: "#0f172a" }}>{selected.subject}</h3>
                  <div style={{ fontSize: 13, color: "#64748b" }}>From: {selected.from_name ? `${selected.from_name} <${selected.from_email}>` : selected.from_email}</div>
                  {selected.received_at && <div style={{ fontSize: 12, color: "#94a3b8" }}>{new Date(selected.received_at).toLocaleString("en-GB")}</div>}
                </div>
                <button className="et-dismiss-btn" disabled={dismissing === selected.id} onClick={() => void dismiss(selected.id)}>
                  {dismissing === selected.id ? "Dismissing…" : "Dismiss"}
                </button>
              </div>

              <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
                {selected.category && <span className="et-badge" style={{ background: CATEGORY_COLORS[selected.category] ?? "#f1f5f9", fontSize: 12, padding: "3px 10px" }}>{selected.category.replace(/_/g, " ")}</span>}
                {selected.urgency != null && <span className="et-badge" style={{ background: URGENCY_COLORS[Math.min(selected.urgency, 4)], fontSize: 12, padding: "3px 10px" }}>Urgency: {selected.urgency}/4</span>}
                {selected.requires_clinician && <span className="et-badge" style={{ background: "#fce7f3", color: "#be185d", fontSize: 12, padding: "3px 10px" }}>Requires Clinician</span>}
              </div>

              {selected.body_snippet && (
                <div style={{ background: "#f8fafc", borderRadius: 8, padding: 12, fontSize: 13, color: "#374151", marginBottom: 12, borderLeft: "3px solid #e2e8f0" }}>
                  {selected.body_snippet}
                </div>
              )}

              {selected.ai_summary && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 6 }}>AI Summary</div>
                  <div className="et-summary-box">{selected.ai_summary}</div>
                </>
              )}

              {selected.ai_suggested_reply && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 6 }}>Suggested Reply</div>
                  <div className="et-reply-box">{selected.ai_suggested_reply}</div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
