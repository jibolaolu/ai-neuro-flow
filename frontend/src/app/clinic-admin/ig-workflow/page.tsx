"use client";

import { useCallback, useEffect, useState } from "react";
import { browserApiUrl } from "../../../lib/get-api-base";
import { haptic } from "../../../lib/haptics";

type CaldicottReq = {
  id: number;
  request_type: string;
  purpose: string;
  status: string;
  data_described: string;
  recipients: string | null;
  legal_basis: string | null;
  principles_met: Record<string, boolean>;
  created_at: string;
  decided_at: string | null;
  decision_notes: string | null;
};

type DsptStandard = {
  id: string;
  title: string;
  description: string;
  status: string;
  evidence: string | null;
  notes: string | null;
};

type DsptData = {
  overall_status: string;
  standards: Record<string, DsptStandard>;
  submitted_at: string | null;
};

const PRINCIPLES: Record<string, string> = {
  "1": "Justify the purpose",
  "2": "Use only what is needed",
  "3": "Access only what is needed",
  "4": "Be aware of responsibilities",
  "5": "Comply with the law",
  "6": "Follow your organisation's procedures",
  "7": "The duty to share can be as important as the duty to protect",
};

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  pending:  { bg: "#fef3c7", color: "#b45309" },
  approved: { bg: "#d1fae5", color: "#059669" },
  rejected: { bg: "#fee2e2", color: "#dc2626" },
  deferred: { bg: "#f1f5f9", color: "#475569" },
  "standards-met": { bg: "#d1fae5", color: "#059669" },
  "in-progress":   { bg: "#dbeafe", color: "#1d4ed8" },
  "not-started":   { bg: "#f1f5f9", color: "#64748b" },
};

const REQUEST_TYPES = ["data-share", "subject-access", "third-party-disclosure", "research", "audit", "safeguarding"];

export default function IgWorkflowPage() {
  const [tab, setTab] = useState<"caldicott" | "dspt">("caldicott");
  const [requests, setRequests] = useState<CaldicottReq[]>([]);
  const [dspt, setDspt] = useState<DsptData | null>(null);
  const [selected, setSelected] = useState<CaldicottReq | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({ request_type: "data-share", purpose: "", data_described: "", recipients: "", legal_basis: "" });
  const [decision, setDecision] = useState({ d: "", notes: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [rRes, dRes] = await Promise.all([
      fetch(browserApiUrl("/api/v1/ig/caldicott"), { credentials: "include" }),
      fetch(browserApiUrl("/api/v1/ig/dspt"), { credentials: "include" }),
    ]);
    if (rRes.ok) setRequests(await rRes.json());
    if (dRes.ok) setDspt(await dRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function createRequest() {
    setSaving(true); haptic("tap");
    const r = await fetch(browserApiUrl("/api/v1/ig/caldicott"), {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (r.ok) { haptic("success"); setShowCreate(false); await load(); }
    setSaving(false);
  }

  async function decide() {
    if (!selected || !decision.d) return;
    setSaving(true); haptic("tap");
    const r = await fetch(browserApiUrl(`/api/v1/ig/caldicott/${selected.id}/decide`), {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision: decision.d, notes: decision.notes }),
    });
    if (r.ok) { haptic("success"); setSelected(null); await load(); }
    setSaving(false);
  }

  async function updateDspt(stdId: string, status: string, evidence?: string) {
    haptic("tap");
    await fetch(browserApiUrl("/api/v1/ig/dspt"), {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ standard_id: stdId, status, evidence: evidence || null }),
    });
    await load();
  }

  const dsptStds = dspt ? Object.values(dspt.standards) : [];
  const metCount = dsptStds.filter(s => s.status === "met").length;

  return (
    <div style={{ padding: "20px 0" }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 700 }}>Information Governance</h2>
        <p style={{ fontSize: "0.75rem", color: "#64748b" }}>Caldicott guardian approvals · DSPT compliance · Data security</p>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        {(["caldicott", "dspt"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: "7px 16px", borderRadius: 8, border: "none", fontWeight: 700, fontSize: "0.78rem", cursor: "pointer",
              background: tab === t ? "#1d4ed8" : "#f1f5f9", color: tab === t ? "#fff" : "#64748b" }}>
            {t === "caldicott" ? "🔐 Caldicott Requests" : "📋 DSPT Checklist"}
          </button>
        ))}
      </div>

      {loading ? <p style={{ color: "#94a3b8" }}>Loading…</p> : (
        <>
          {/* ── CALDICOTT TAB ── */}
          {tab === "caldicott" && (
            <div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
                <button onClick={() => setShowCreate(true)}
                  style={{ padding: "8px 16px", borderRadius: 8, background: "#1d4ed8", color: "#fff", border: "none", fontWeight: 700, cursor: "pointer", fontSize: "0.8rem" }}>
                  + New Request
                </button>
              </div>

              {requests.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#94a3b8" }}>
                  <div style={{ fontSize: "2rem", marginBottom: 8 }}>🔐</div>
                  <p style={{ fontSize: "0.84rem" }}>No Caldicott requests yet</p>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 1fr" : "1fr", gap: 14 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {requests.map(req => {
                      const s = STATUS_STYLE[req.status] || STATUS_STYLE.pending;
                      return (
                        <div key={req.id} onClick={() => { setSelected(req); setDecision({ d: "", notes: "" }); }}
                          style={{ background: "#fff", border: `2px solid ${selected?.id === req.id ? "#1d4ed8" : "#e2e8f0"}`, borderRadius: 12, padding: 14, cursor: "pointer" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                            <span style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", color: "#1d4ed8" }}>{req.request_type}</span>
                            <span style={{ fontSize: "0.67rem", fontWeight: 700, padding: "2px 8px", borderRadius: 999, ...s }}>{req.status}</span>
                          </div>
                          <p style={{ fontSize: "0.8rem", marginBottom: 4 }}>{req.purpose}</p>
                          <p style={{ fontSize: "0.7rem", color: "#64748b" }}>{new Date(req.created_at).toLocaleDateString("en-GB")}</p>
                        </div>
                      );
                    })}
                  </div>

                  {selected && (
                    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                        <strong>Request #{selected.id}</strong>
                        <button onClick={() => setSelected(null)} style={{ border: "none", background: "none", cursor: "pointer", color: "#94a3b8" }}>✕</button>
                      </div>

                      {[
                        ["Type", selected.request_type],
                        ["Purpose", selected.purpose],
                        ["Data shared", selected.data_described],
                        ["Recipients", selected.recipients],
                        ["Legal basis", selected.legal_basis],
                      ].filter(([, v]) => v).map(([label, val]) => (
                        <div key={label as string} style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", color: "#94a3b8", marginBottom: 2 }}>{label}</div>
                          <div style={{ fontSize: "0.8rem" }}>{val}</div>
                        </div>
                      ))}

                      {/* Principles */}
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", color: "#94a3b8", marginBottom: 6 }}>Caldicott Principles</div>
                        {Object.entries(PRINCIPLES).map(([k, v]) => (
                          <div key={k} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4, fontSize: "0.72rem" }}>
                            <span style={{ color: selected.principles_met?.[k] ? "#059669" : "#dc2626" }}>
                              {selected.principles_met?.[k] ? "✓" : "✗"}
                            </span>
                            <span>{k}. {v}</span>
                          </div>
                        ))}
                      </div>

                      {selected.status === "pending" && (
                        <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 12 }}>
                          <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", color: "#94a3b8", marginBottom: 8 }}>Guardian Decision</div>
                          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                            {["approved", "rejected", "deferred"].map(d => (
                              <button key={d} onClick={() => setDecision(p => ({ ...p, d }))}
                                style={{ flex: 1, padding: "6px 0", borderRadius: 7, border: `2px solid ${decision.d === d ? "#1d4ed8" : "#e2e8f0"}`,
                                  background: decision.d === d ? "#eff6ff" : "#fff", color: decision.d === d ? "#1d4ed8" : "#64748b",
                                  fontWeight: 700, fontSize: "0.72rem", cursor: "pointer", textTransform: "capitalize" }}>
                                {d}
                              </button>
                            ))}
                          </div>
                          <textarea placeholder="Decision notes…" value={decision.notes} onChange={e => setDecision(p => ({ ...p, notes: e.target.value }))}
                            rows={3} style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: "0.8rem", resize: "vertical" }} />
                          <button onClick={() => { void decide(); }} disabled={!decision.d || saving}
                            style={{ width: "100%", marginTop: 8, padding: "9px 0", borderRadius: 8, background: "#1d4ed8", color: "#fff", border: "none", fontWeight: 700, cursor: "pointer" }}>
                            {saving ? "Saving…" : "Record Decision"}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── DSPT TAB ── */}
          {tab === "dspt" && dspt && (
            <div>
              {/* Summary bar */}
              <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, marginBottom: 16, display: "flex", alignItems: "center", gap: 20 }}>
                <div>
                  <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", color: "#64748b", marginBottom: 4 }}>Overall Status</div>
                  <span style={{ fontSize: "0.88rem", fontWeight: 700, ...(STATUS_STYLE[dspt.overall_status] || STATUS_STYLE["not-started"]) }}>
                    {dspt.overall_status.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                  </span>
                </div>
                <div>
                  <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", color: "#64748b", marginBottom: 4 }}>Standards Met</div>
                  <span style={{ fontSize: "1.4rem", fontWeight: 800, color: "#1d4ed8" }}>{metCount}<span style={{ fontSize: "0.8rem", color: "#64748b" }}>/{dsptStds.length}</span></span>
                </div>
                {/* Progress bar */}
                <div style={{ flex: 1 }}>
                  <div style={{ background: "#f1f5f9", borderRadius: 999, height: 8 }}>
                    <div style={{ height: 8, borderRadius: 999, background: "#059669", width: `${(metCount / dsptStds.length) * 100}%`, transition: "width .4s ease" }} />
                  </div>
                </div>
                {!dspt.submitted_at && (
                  <button onClick={async () => { haptic("tap"); await fetch(browserApiUrl("/api/v1/ig/dspt/submit"), { method: "POST", credentials: "include" }); await load(); }}
                    disabled={metCount < dsptStds.length}
                    style={{ padding: "8px 16px", borderRadius: 8, background: metCount === dsptStds.length ? "#059669" : "#f1f5f9", color: metCount === dsptStds.length ? "#fff" : "#94a3b8", border: "none", fontWeight: 700, cursor: "pointer", fontSize: "0.78rem" }}>
                    Submit to DSPT
                  </button>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {dsptStds.map(std => {
                  const s = STATUS_STYLE[std.status] || STATUS_STYLE["not-started"];
                  return (
                    <div key={std.id} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 6 }}>
                        <div>
                          <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#94a3b8", marginRight: 6 }}>#{std.id}</span>
                          <strong style={{ fontSize: "0.85rem" }}>{std.title}</strong>
                          <p style={{ fontSize: "0.72rem", color: "#64748b", marginTop: 3 }}>{std.description}</p>
                        </div>
                        <select value={std.status}
                          onChange={e => { void updateDspt(std.id, e.target.value); }}
                          style={{ padding: "4px 8px", borderRadius: 6, border: `1.5px solid ${s.color}`, background: s.bg, color: s.color, fontSize: "0.72rem", fontWeight: 700, cursor: "pointer" }}>
                          {["not-started", "in-progress", "met", "not-met", "not-applicable"].map(v => (
                            <option key={v} value={v}>{v.replace(/-/g, " ")}</option>
                          ))}
                        </select>
                      </div>
                      {std.evidence && (
                        <div style={{ fontSize: "0.72rem", color: "#059669", marginTop: 4 }}>✓ Evidence: {std.evidence}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Create modal */}
      {showCreate && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <strong>New Caldicott Request</strong>
              <button onClick={() => setShowCreate(false)} style={{ border: "none", background: "none", cursor: "pointer", color: "#64748b" }}>✕</button>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "#475569", display: "block", marginBottom: 4 }}>Request Type</label>
              <select value={form.request_type} onChange={e => setForm(p => ({ ...p, request_type: e.target.value }))}
                style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: "0.84rem" }}>
                {REQUEST_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {[
              { label: "Purpose / justification", key: "purpose", rows: 3 },
              { label: "Data to be shared / accessed", key: "data_described", rows: 3 },
              { label: "Recipients", key: "recipients", rows: 2 },
              { label: "Legal basis (e.g. GDPR Art 9(2)(h))", key: "legal_basis", rows: 1 },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "#475569", display: "block", marginBottom: 4 }}>{f.label}</label>
                <textarea value={(form as any)[f.key]} rows={f.rows}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: "0.84rem", resize: "vertical" }} />
              </div>
            ))}
            <button onClick={() => { void createRequest(); }} disabled={saving || !form.purpose || !form.data_described}
              style={{ width: "100%", padding: "10px 0", borderRadius: 8, background: "#1d4ed8", color: "#fff", border: "none", fontWeight: 700, cursor: "pointer" }}>
              {saving ? "Submitting…" : "Submit Request"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
