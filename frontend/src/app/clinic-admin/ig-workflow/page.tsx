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

const REQUEST_TYPES = [
  "data-share", "subject-access", "third-party-disclosure",
  "research", "audit", "safeguarding",
];

const TYPE_ICON: Record<string, string> = {
  "data-share": "🔗",
  "subject-access": "👤",
  "third-party-disclosure": "📤",
  "research": "🔬",
  "audit": "📊",
  "safeguarding": "🛡️",
};

type StatusKey = "pending" | "approved" | "rejected" | "deferred" | "standards-met" | "in-progress" | "not-started" | "met" | "not-met" | "not-applicable";

const STATUS_META: Record<StatusKey, { bg: string; color: string; border: string; label: string }> = {
  pending:           { bg: "#fffbeb", color: "#b45309", border: "#fcd34d", label: "Pending" },
  approved:          { bg: "#f0fdf4", color: "#166534", border: "#86efac", label: "Approved" },
  rejected:          { bg: "#fef2f2", color: "#991b1b", border: "#fca5a5", label: "Rejected" },
  deferred:          { bg: "#f8fafc", color: "#475569", border: "#cbd5e1", label: "Deferred" },
  "standards-met":   { bg: "#f0fdf4", color: "#166534", border: "#86efac", label: "Standards Met" },
  "in-progress":     { bg: "#eff6ff", color: "#1e40af", border: "#93c5fd", label: "In Progress" },
  "not-started":     { bg: "#f8fafc", color: "#64748b", border: "#e2e8f0", label: "Not Started" },
  "met":             { bg: "#f0fdf4", color: "#166534", border: "#86efac", label: "Met" },
  "not-met":         { bg: "#fef2f2", color: "#991b1b", border: "#fca5a5", label: "Not Met" },
  "not-applicable":  { bg: "#f8fafc", color: "#94a3b8", border: "#e2e8f0", label: "N/A" },
};

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status as StatusKey] ?? STATUS_META["not-started"];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 10px", borderRadius: 999,
      background: m.bg, color: m.color,
      border: `1px solid ${m.border}`,
      fontSize: "0.72rem", fontWeight: 700, whiteSpace: "nowrap",
    }}>
      {m.label}
    </span>
  );
}

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent: string }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 14,
      border: "1px solid #e2e8f0",
      padding: "18px 20px",
      display: "flex", flexDirection: "column", gap: 4,
      borderLeft: `4px solid ${accent}`,
    }}>
      <div style={{ fontSize: "1.8rem", fontWeight: 800, color: accent, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>{label}</div>
      {sub && <div style={{ fontSize: "0.68rem", color: "#94a3b8" }}>{sub}</div>}
    </div>
  );
}

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
    if (r.ok) { haptic("success"); setShowCreate(false); setForm({ request_type: "data-share", purpose: "", data_described: "", recipients: "", legal_basis: "" }); await load(); }
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
      body: JSON.stringify({ standard_id: stdId, status, evidence: evidence ?? null }),
    });
    await load();
  }

  const dsptStds = dspt ? Object.values(dspt.standards) : [];
  const metCount = dsptStds.filter(s => s.status === "met").length;
  const pct = dsptStds.length ? Math.round((metCount / dsptStds.length) * 100) : 0;

  const pending  = requests.filter(r => r.status === "pending").length;
  const approved = requests.filter(r => r.status === "approved").length;

  // ── Circumference for SVG ring ────────────────────────────────────────────
  const R = 36, C = 2 * Math.PI * R;

  return (
    <div style={{ padding: "0 0 48px" }}>

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "flex-start",
        marginBottom: 28, paddingBottom: 20, borderBottom: "1px solid #e2e8f0",
        flexWrap: "wrap", gap: 12,
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: "1.5rem" }}>🏛️</span>
            <h1 style={{ fontSize: "1.4rem", fontWeight: 800, margin: 0, color: "#0f172a" }}>
              Information Governance
            </h1>
          </div>
          <p style={{ margin: 0, fontSize: "0.82rem", color: "#64748b" }}>
            Caldicott guardian approvals · DSPT compliance · Data security
          </p>
        </div>
        {tab === "caldicott" && (
          <button
            onClick={() => { haptic("tap"); setShowCreate(true); }}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "10px 20px", borderRadius: 10,
              background: "#1d4ed8", color: "#fff", border: "none",
              fontWeight: 700, fontSize: "0.84rem", cursor: "pointer",
              boxShadow: "0 2px 8px rgba(29,78,216,0.25)",
            }}
          >
            <span style={{ fontSize: "1.1rem" }}>＋</span> New Request
          </button>
        )}
      </div>

      {/* ── Summary stats ─────────────────────────────────────────────────── */}
      {!loading && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 28 }}>
          <StatCard label="Total Requests"   value={requests.length}   accent="#1d4ed8" />
          <StatCard label="Pending Review"   value={pending}           accent="#f59e0b" sub="awaiting decision" />
          <StatCard label="Approved"         value={approved}          accent="#059669" />
          <StatCard label="DSPT Completion"  value={`${pct}%`}         accent="#7c3aed" sub={`${metCount} of ${dsptStds.length} standards`} />
        </div>
      )}

      {/* ── Tab bar ───────────────────────────────────────────────────────── */}
      <div style={{
        display: "flex", gap: 2, marginBottom: 24,
        background: "#f1f5f9", borderRadius: 12, padding: 4,
        width: "fit-content",
      }}>
        {([
          { key: "caldicott", label: "Caldicott Requests", icon: "🔐" },
          { key: "dspt",      label: "DSPT Checklist",     icon: "📋" },
        ] as const).map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setSelected(null); }}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 20px", borderRadius: 9, border: "none",
              fontWeight: 700, fontSize: "0.82rem", cursor: "pointer",
              background: tab === t.key ? "#fff" : "transparent",
              color: tab === t.key ? "#1d4ed8" : "#64748b",
              boxShadow: tab === t.key ? "0 1px 4px rgba(0,0,0,0.10)" : "none",
              transition: "all 0.15s",
            }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "60px 0", color: "#94a3b8" }}>
          <div style={{ width: 20, height: 20, border: "2px solid #e2e8f0", borderTopColor: "#1d4ed8", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
          Loading governance data…
        </div>
      ) : (
        <>
          {/* ════════════════════ CALDICOTT TAB ════════════════════ */}
          {tab === "caldicott" && (
            <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 380px" : "1fr", gap: 16, alignItems: "start" }}>

              {/* Request list */}
              <div>
                {requests.length === 0 ? (
                  <div style={{
                    textAlign: "center", padding: "64px 24px",
                    background: "#fff", borderRadius: 16, border: "1.5px dashed #e2e8f0",
                  }}>
                    <div style={{ fontSize: "3rem", marginBottom: 12 }}>🔐</div>
                    <p style={{ fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>No Caldicott requests yet</p>
                    <p style={{ fontSize: "0.82rem", color: "#94a3b8", marginBottom: 20 }}>
                      Data sharing requests will appear here once submitted for Caldicott Guardian review.
                    </p>
                    <button
                      onClick={() => { haptic("tap"); setShowCreate(true); }}
                      style={{
                        padding: "10px 24px", borderRadius: 10,
                        background: "#1d4ed8", color: "#fff", border: "none",
                        fontWeight: 700, fontSize: "0.84rem", cursor: "pointer",
                      }}
                    >
                      Submit first request
                    </button>
                  </div>
                ) : (
                  <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", overflow: "hidden" }}>
                    {/* Table header */}
                    <div style={{
                      display: "grid",
                      gridTemplateColumns: "40px 1fr 160px 130px 110px",
                      gap: 12, padding: "12px 20px",
                      background: "#f8fafc", borderBottom: "1px solid #e2e8f0",
                      fontSize: "0.67rem", fontWeight: 800, textTransform: "uppercase",
                      letterSpacing: "0.07em", color: "#64748b",
                    }}>
                      <span>#</span>
                      <span>Purpose / Description</span>
                      <span>Type</span>
                      <span>Submitted</span>
                      <span>Status</span>
                    </div>

                    {requests.map((req, i) => (
                      <div
                        key={req.id}
                        onClick={() => { setSelected(req); setDecision({ d: "", notes: "" }); }}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "40px 1fr 160px 130px 110px",
                          gap: 12, padding: "14px 20px",
                          borderBottom: i < requests.length - 1 ? "1px solid #f1f5f9" : "none",
                          cursor: "pointer",
                          background: selected?.id === req.id ? "#eff6ff" : "#fff",
                          transition: "background 0.1s",
                        }}
                      >
                        <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 700, paddingTop: 2 }}>{req.id}</span>

                        <div>
                          <p style={{ margin: 0, fontWeight: 600, fontSize: "0.84rem", color: "#0f172a", marginBottom: 2, lineClamp: 1,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{req.purpose}</p>
                          <p style={{ margin: 0, fontSize: "0.72rem", color: "#64748b",
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{req.data_described}</p>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.78rem", color: "#475569" }}>
                          <span>{TYPE_ICON[req.request_type] ?? "📄"}</span>
                          <span style={{ textTransform: "capitalize" }}>{req.request_type.replace(/-/g, " ")}</span>
                        </div>

                        <span style={{ fontSize: "0.77rem", color: "#64748b", paddingTop: 2 }}>
                          {new Date(req.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </span>

                        <div style={{ paddingTop: 1 }}>
                          <StatusBadge status={req.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Detail panel */}
              {selected && (
                <div style={{
                  background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0",
                  overflow: "hidden", position: "sticky", top: 16,
                }}>
                  {/* Panel header */}
                  <div style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "16px 20px", borderBottom: "1px solid #f1f5f9",
                    background: "#f8fafc",
                  }}>
                    <div>
                      <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", color: "#94a3b8", marginBottom: 2 }}>
                        Request #{selected.id}
                      </div>
                      <StatusBadge status={selected.status} />
                    </div>
                    <button
                      onClick={() => setSelected(null)}
                      style={{ border: "none", background: "#e2e8f0", borderRadius: "50%", width: 28, height: 28,
                        display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: "1rem", color: "#64748b" }}>
                      ✕
                    </button>
                  </div>

                  <div style={{ padding: "18px 20px", maxHeight: "calc(100vh - 260px)", overflowY: "auto" }}>
                    {/* Type */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16,
                      background: "#f1f5f9", borderRadius: 8, padding: "8px 12px" }}>
                      <span style={{ fontSize: "1.2rem" }}>{TYPE_ICON[selected.request_type] ?? "📄"}</span>
                      <span style={{ fontWeight: 700, fontSize: "0.84rem", textTransform: "capitalize", color: "#1d4ed8" }}>
                        {selected.request_type.replace(/-/g, " ")}
                      </span>
                    </div>

                    {[
                      { label: "Purpose", val: selected.purpose },
                      { label: "Data described", val: selected.data_described },
                      { label: "Recipients", val: selected.recipients },
                      { label: "Legal basis", val: selected.legal_basis },
                      { label: "Decision notes", val: selected.decision_notes },
                    ].filter(({ val }) => val).map(({ label, val }) => (
                      <div key={label} style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", color: "#94a3b8", marginBottom: 4 }}>
                          {label}
                        </div>
                        <div style={{ fontSize: "0.82rem", color: "#0f172a", lineHeight: 1.5 }}>{val}</div>
                      </div>
                    ))}

                    {/* Caldicott Principles */}
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", color: "#94a3b8", marginBottom: 8 }}>
                        Caldicott Principles
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {Object.entries(PRINCIPLES).map(([k, v]) => {
                          const met = selected.principles_met?.[k];
                          return (
                            <div key={k} style={{
                              display: "flex", gap: 8, alignItems: "flex-start",
                              padding: "7px 10px", borderRadius: 8,
                              background: met ? "#f0fdf4" : "#fef2f2",
                              border: `1px solid ${met ? "#86efac" : "#fca5a5"}`,
                            }}>
                              <span style={{ fontSize: "0.9rem", flexShrink: 0 }}>{met ? "✅" : "❌"}</span>
                              <span style={{ fontSize: "0.73rem", color: met ? "#166534" : "#991b1b", lineHeight: 1.4 }}>
                                <strong>{k}.</strong> {v}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Decision section */}
                    {selected.status === "pending" && (
                      <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 16 }}>
                        <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", color: "#94a3b8", marginBottom: 10 }}>
                          Guardian Decision
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 10 }}>
                          {([
                            { d: "approved", icon: "✅", color: "#166534", bg: "#f0fdf4", border: "#86efac" },
                            { d: "rejected", icon: "❌", color: "#991b1b", bg: "#fef2f2", border: "#fca5a5" },
                            { d: "deferred", icon: "⏸️", color: "#475569", bg: "#f8fafc", border: "#cbd5e1" },
                          ] as const).map(({ d, icon, color, bg, border }) => (
                            <button key={d} onClick={() => setDecision(p => ({ ...p, d }))}
                              style={{
                                padding: "8px 4px", borderRadius: 8, cursor: "pointer",
                                border: `2px solid ${decision.d === d ? color : border}`,
                                background: decision.d === d ? bg : "#fff",
                                color: decision.d === d ? color : "#94a3b8",
                                fontWeight: 700, fontSize: "0.72rem", textTransform: "capitalize",
                                display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                              }}>
                              <span>{icon}</span>
                              {d}
                            </button>
                          ))}
                        </div>
                        <textarea
                          placeholder="Add decision notes (optional)…"
                          value={decision.notes}
                          onChange={e => setDecision(p => ({ ...p, notes: e.target.value }))}
                          rows={3}
                          style={{
                            width: "100%", padding: "8px 10px", borderRadius: 8,
                            border: "1.5px solid #e2e8f0", fontSize: "0.8rem",
                            resize: "vertical", boxSizing: "border-box", fontFamily: "inherit",
                          }}
                        />
                        <button
                          onClick={() => { void decide(); }}
                          disabled={!decision.d || saving}
                          style={{
                            width: "100%", marginTop: 10, padding: "10px 0", borderRadius: 9,
                            background: !decision.d ? "#e2e8f0" : "#1d4ed8",
                            color: !decision.d ? "#94a3b8" : "#fff",
                            border: "none", fontWeight: 700, cursor: decision.d ? "pointer" : "not-allowed",
                            fontSize: "0.84rem",
                          }}>
                          {saving ? "Recording…" : "Record Decision"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════════════════════ DSPT TAB ════════════════════ */}
          {tab === "dspt" && dspt && (
            <div>
              {/* Overview card */}
              <div style={{
                background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0",
                padding: "24px 28px", marginBottom: 20,
                display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 32, alignItems: "center",
              }}>
                {/* SVG progress ring */}
                <div style={{ position: "relative", width: 88, height: 88, flexShrink: 0 }}>
                  <svg viewBox="0 0 88 88" style={{ transform: "rotate(-90deg)" }}>
                    <circle cx="44" cy="44" r={R} fill="none" stroke="#f1f5f9" strokeWidth="8" />
                    <circle cx="44" cy="44" r={R} fill="none"
                      stroke={pct === 100 ? "#059669" : "#1d4ed8"} strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={C}
                      strokeDashoffset={C - (C * pct) / 100}
                      style={{ transition: "stroke-dashoffset 0.6s ease" }}
                    />
                  </svg>
                  <div style={{
                    position: "absolute", inset: 0, display: "flex",
                    flexDirection: "column", alignItems: "center", justifyContent: "center",
                  }}>
                    <span style={{ fontSize: "1.3rem", fontWeight: 800, color: "#0f172a", lineHeight: 1 }}>{pct}%</span>
                  </div>
                </div>

                {/* Text summary */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "#0f172a" }}>
                      DSPT 2025–26 Compliance
                    </h3>
                    <StatusBadge status={dspt.overall_status} />
                  </div>
                  <p style={{ margin: 0, fontSize: "0.82rem", color: "#64748b", marginBottom: 12 }}>
                    {metCount} of {dsptStds.length} standards met · {dsptStds.filter(s => s.status === "in-progress").length} in progress ·{" "}
                    {dsptStds.filter(s => s.status === "not-started").length} not started
                  </p>
                  {/* Progress bar */}
                  <div style={{ background: "#f1f5f9", borderRadius: 999, height: 8, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", borderRadius: 999,
                      background: pct === 100 ? "#059669" : "linear-gradient(90deg, #1d4ed8, #3b82f6)",
                      width: `${pct}%`, transition: "width 0.6s ease",
                    }} />
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                  {dspt.submitted_at ? (
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "0.65rem", color: "#94a3b8", textTransform: "uppercase", fontWeight: 700, marginBottom: 2 }}>Submitted</div>
                      <div style={{ fontSize: "0.8rem", color: "#059669", fontWeight: 700 }}>
                        {new Date(dspt.submitted_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={async () => {
                        haptic("tap");
                        await fetch(browserApiUrl("/api/v1/ig/dspt/submit"), { method: "POST", credentials: "include" });
                        await load();
                      }}
                      disabled={metCount < dsptStds.length}
                      style={{
                        padding: "10px 20px", borderRadius: 10, border: "none", fontWeight: 700,
                        fontSize: "0.82rem", cursor: pct === 100 ? "pointer" : "not-allowed",
                        background: pct === 100 ? "#059669" : "#f1f5f9",
                        color: pct === 100 ? "#fff" : "#94a3b8",
                        boxShadow: pct === 100 ? "0 2px 8px rgba(5,150,105,0.25)" : "none",
                      }}>
                      {pct === 100 ? "✅ Submit to DSPT" : `${dsptStds.length - metCount} remaining`}
                    </button>
                  )}
                </div>
              </div>

              {/* Standards list */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {dsptStds.map(std => {
                  const m = STATUS_META[std.status as StatusKey] ?? STATUS_META["not-started"];
                  return (
                    <div key={std.id} style={{
                      background: "#fff", border: `1px solid ${std.status === "met" ? "#86efac" : "#e2e8f0"}`,
                      borderRadius: 14, overflow: "hidden",
                    }}>
                      <div style={{
                        display: "grid", gridTemplateColumns: "48px 1fr auto",
                        gap: 16, padding: "16px 20px", alignItems: "start",
                      }}>
                        {/* Number badge */}
                        <div style={{
                          width: 36, height: 36, borderRadius: "50%",
                          background: std.status === "met" ? "#f0fdf4" : "#f8fafc",
                          border: `2px solid ${m.border}`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          flexShrink: 0,
                        }}>
                          {std.status === "met"
                            ? <span style={{ fontSize: "1.1rem" }}>✓</span>
                            : <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "#64748b" }}>{std.id}</span>
                          }
                        </div>

                        {/* Content */}
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            <strong style={{ fontSize: "0.88rem", color: "#0f172a" }}>{std.title}</strong>
                          </div>
                          <p style={{ margin: 0, fontSize: "0.76rem", color: "#64748b", lineHeight: 1.5 }}>{std.description}</p>
                          {std.evidence && (
                            <div style={{
                              display: "flex", alignItems: "center", gap: 6, marginTop: 8,
                              padding: "5px 10px", background: "#f0fdf4", borderRadius: 6,
                              fontSize: "0.72rem", color: "#166534",
                            }}>
                              <span>📎</span>
                              <span>Evidence: {std.evidence}</span>
                            </div>
                          )}
                        </div>

                        {/* Status select */}
                        <select
                          value={std.status}
                          onChange={e => { void updateDspt(std.id, e.target.value); }}
                          style={{
                            padding: "6px 10px", borderRadius: 8,
                            border: `1.5px solid ${m.border}`, background: m.bg, color: m.color,
                            fontSize: "0.75rem", fontWeight: 700, cursor: "pointer",
                            appearance: "none", paddingRight: 24, whiteSpace: "nowrap",
                          }}
                        >
                          {["not-started", "in-progress", "met", "not-met", "not-applicable"].map(v => (
                            <option key={v} value={v}>{v.replace(/-/g, " ")}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Create request modal ─────────────────────────────────────────── */}
      {showCreate && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setShowCreate(false); }}
          style={{
            position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)",
            backdropFilter: "blur(2px)", zIndex: 1000,
            display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
          }}>
          <div style={{
            background: "#fff", borderRadius: 20, width: "100%", maxWidth: 540,
            maxHeight: "90vh", overflowY: "auto",
            boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
          }}>
            {/* Modal header */}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "20px 24px 16px", borderBottom: "1px solid #f1f5f9",
              position: "sticky", top: 0, background: "#fff", zIndex: 1,
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "#0f172a" }}>New Caldicott Request</h2>
                <p style={{ margin: "2px 0 0", fontSize: "0.76rem", color: "#64748b" }}>Submit for Caldicott Guardian review</p>
              </div>
              <button onClick={() => setShowCreate(false)}
                style={{ border: "none", background: "#f1f5f9", borderRadius: "50%", width: 32, height: 32,
                  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: "1rem", color: "#64748b" }}>
                ✕
              </button>
            </div>

            <div style={{ padding: "20px 24px 24px" }}>
              {/* Request type */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "#475569", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Request type
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  {REQUEST_TYPES.map(t => (
                    <button key={t} onClick={() => setForm(p => ({ ...p, request_type: t }))}
                      style={{
                        display: "flex", alignItems: "center", gap: 6,
                        padding: "8px 12px", borderRadius: 8, cursor: "pointer",
                        border: `2px solid ${form.request_type === t ? "#1d4ed8" : "#e2e8f0"}`,
                        background: form.request_type === t ? "#eff6ff" : "#fff",
                        color: form.request_type === t ? "#1d4ed8" : "#475569",
                        fontWeight: 600, fontSize: "0.78rem", textAlign: "left",
                        textTransform: "capitalize",
                      }}>
                      <span>{TYPE_ICON[t] ?? "📄"}</span>
                      {t.replace(/-/g, " ")}
                    </button>
                  ))}
                </div>
              </div>

              {[
                { label: "Purpose / clinical justification", key: "purpose", rows: 3, placeholder: "Describe the purpose and why this sharing is necessary…" },
                { label: "Data to be shared or accessed", key: "data_described", rows: 3, placeholder: "Specify the type and scope of personal data involved…" },
                { label: "Recipients", key: "recipients", rows: 2, placeholder: "Who will receive or access the data?" },
                { label: "Legal basis (e.g. GDPR Art 9(2)(h))", key: "legal_basis", rows: 1, placeholder: "e.g. Schedule 3 DPA 2018 / Art 9(2)(h) GDPR" },
              ].map(f => (
                <div key={f.key} style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "#475569", display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {f.label}
                  </label>
                  <textarea
                    value={(form as Record<string, string>)[f.key]}
                    rows={f.rows}
                    placeholder={f.placeholder}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    style={{
                      width: "100%", padding: "10px 12px", borderRadius: 10,
                      border: "1.5px solid #e2e8f0", fontSize: "0.84rem",
                      resize: "vertical", boxSizing: "border-box", fontFamily: "inherit",
                      lineHeight: 1.5, color: "#0f172a",
                    }}
                  />
                </div>
              ))}

              <button
                onClick={() => { void createRequest(); }}
                disabled={saving || !form.purpose || !form.data_described}
                style={{
                  width: "100%", padding: "12px 0", borderRadius: 10,
                  background: !form.purpose || !form.data_described ? "#e2e8f0" : "#1d4ed8",
                  color: !form.purpose || !form.data_described ? "#94a3b8" : "#fff",
                  border: "none", fontWeight: 700, fontSize: "0.88rem",
                  cursor: form.purpose && form.data_described ? "pointer" : "not-allowed",
                  marginTop: 4,
                }}>
                {saving ? "Submitting…" : "Submit for Review"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
