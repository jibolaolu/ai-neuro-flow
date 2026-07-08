"use client";

import { useEffect, useState } from "react";
import { browserApiUrl } from "../../../lib/get-api-base";

type Referral = {
  id: string;
  patient_name: string;
  patient_dob: string | null;
  patient_nhs_number: string | null;
  patient_email: string | null;
  gp_name: string | null;
  gp_practice: string | null;
  icb_name: string | null;
  pathway: string;
  priority: string;
  presenting_concerns: string | null;
  status: string;
  rejection_reason: string | null;
  acceptance_notes: string | null;
  eligibility_confirmed: boolean;
  acceptance_letter_sent: boolean;
  converted_client_id: string | null;
  referred_date: string | null;
  accepted_at: string | null;
  rejected_at: string | null;
  created_at: string | null;
};

const PATHWAYS = [
  "Adult ADHD", "Adult Autism", "Adult ADHD + Autism",
  "Child ADHD", "Child Autism", "Child ADHD + Autism",
  "Adolescent ADHD", "Adolescent Autism",
];

const STATUS_COLORS: Record<string, string> = {
  pending:   "#f59e0b",
  accepted:  "#22c55e",
  rejected:  "#ef4444",
  converted: "#6366f1",
};

function statusBadge(s: string) {
  const col = STATUS_COLORS[s] ?? "#94a3b8";
  return (
    <span style={{
      background: `${col}22`,
      color: col,
      border: `1px solid ${col}55`,
      borderRadius: 6,
      padding: "2px 10px",
      fontSize: "0.72rem",
      fontWeight: 700,
      textTransform: "capitalize" as const,
    }}>
      {s}
    </span>
  );
}

function priorityBadge(p: string) {
  const col = p === "urgent" ? "#ef4444" : "#64748b";
  return (
    <span style={{
      color: col,
      fontSize: "0.68rem",
      fontWeight: 700,
      textTransform: "uppercase" as const,
      letterSpacing: "0.06em",
    }}>
      {p}
    </span>
  );
}

type NewForm = {
  patient_name: string;
  patient_dob: string;
  patient_nhs_number: string;
  patient_email: string;
  patient_phone: string;
  gp_name: string;
  gp_practice: string;
  gp_email: string;
  icb_name: string;
  pathway: string;
  priority: string;
  presenting_concerns: string;
  referred_date: string;
};

const BLANK: NewForm = {
  patient_name: "", patient_dob: "", patient_nhs_number: "",
  patient_email: "", patient_phone: "",
  gp_name: "", gp_practice: "", gp_email: "", icb_name: "",
  pathway: PATHWAYS[0], priority: "routine",
  presenting_concerns: "", referred_date: "",
};

export default function ReferralsPage() {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState<NewForm>({ ...BLANK });
  const [saving, setSaving] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [selected, setSelected] = useState<Referral | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [showLetterParser, setShowLetterParser] = useState(false);
  const [letterText, setLetterText] = useState("");
  const [parsing, setParsing] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const url = filter === "all"
        ? browserApiUrl("/api/v1/referrals/")
        : browserApiUrl(`/api/v1/referrals/?status=${filter}`);
      const r = await fetch(url, { credentials: "include" });
      if (r.ok) {
        const d = await r.json() as { items: Referral[] };
        setReferrals(d.items);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleParseLetterAndFill() {
    if (!letterText.trim()) return;
    setParsing(true);
    try {
      const r = await fetch(browserApiUrl("/api/v1/referrals/parse-letter"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ letter_text: letterText }),
      });
      if (r.ok) {
        const d = await r.json() as { fields: Partial<NewForm> };
        setForm((f) => ({ ...f, ...Object.fromEntries(Object.entries(d.fields).filter(([, v]) => v != null)) }));
        setShowLetterParser(false);
        setLetterText("");
        setShowNew(true);
      }
    } finally {
      setParsing(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await fetch(browserApiUrl("/api/v1/referrals/"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (r.ok) {
        setShowNew(false);
        setForm({ ...BLANK });
        await load();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleAccept(id: string) {
    setActionBusy(id + "-accept");
    try {
      const r = await fetch(browserApiUrl(`/api/v1/referrals/${id}/accept`), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ send_letter: true }),
      });
      if (r.ok) { setSelected(null); await load(); }
    } finally {
      setActionBusy(null);
    }
  }

  async function handleReject(id: string) {
    if (!rejectReason.trim()) return;
    setActionBusy(id + "-reject");
    try {
      const r = await fetch(browserApiUrl(`/api/v1/referrals/${id}/reject`), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rejection_reason: rejectReason }),
      });
      if (r.ok) { setSelected(null); setShowReject(false); setRejectReason(""); await load(); }
    } finally {
      setActionBusy(null);
    }
  }

  async function handleConvert(id: string) {
    setActionBusy(id + "-convert");
    try {
      const r = await fetch(browserApiUrl(`/api/v1/referrals/${id}/convert`), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (r.ok) {
        const d = await r.json() as { client_id: string };
        setSelected(null);
        await load();
        window.location.href = `/clinic-admin/clients/${d.client_id}`;
      }
    } finally {
      setActionBusy(null);
    }
  }

  const card: React.CSSProperties = {
    background: "var(--card-bg)",
    border: "1px solid var(--card-border)",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  };

  const inp: React.CSSProperties = {
    width: "100%",
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid var(--card-border)",
    background: "var(--input-bg, var(--card-bg))",
    color: "var(--ink)",
    fontSize: "0.88rem",
    boxSizing: "border-box" as const,
  };

  const lbl: React.CSSProperties = {
    fontSize: "0.75rem",
    fontWeight: 700,
    color: "var(--muted)",
    marginBottom: 4,
    display: "block",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--ink)", margin: 0 }}>
            Right to Choose Referrals
          </h1>
          <p style={{ color: "var(--muted)", fontSize: "0.85rem", margin: "4px 0 0" }}>
            NHS England GP-referred patients choosing private ADHD/autism assessment
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setShowLetterParser(true)}
            style={{ background: "transparent", color: "var(--brand)", border: "1px solid var(--brand)", borderRadius: 8, padding: "10px 16px", fontWeight: 700, cursor: "pointer", fontSize: "0.85rem" }}
          >
            🤖 Paste GP Letter
          </button>
          <button
            onClick={() => setShowNew(true)}
            style={{ background: "var(--brand)", color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontWeight: 700, cursor: "pointer", fontSize: "0.88rem" }}
          >
            + New Referral
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {["all", "pending", "accepted", "rejected", "converted"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: "6px 14px",
              borderRadius: 20,
              border: "1px solid var(--card-border)",
              background: filter === f ? "var(--brand)" : "transparent",
              color: filter === f ? "#fff" : "var(--ink)",
              fontWeight: 600,
              cursor: "pointer",
              fontSize: "0.8rem",
              textTransform: "capitalize",
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ color: "var(--muted)", textAlign: "center", padding: 40 }}>Loading…</div>
      ) : referrals.length === 0 ? (
        <div style={{ ...card, textAlign: "center", color: "var(--muted)", padding: 40 }}>
          No {filter === "all" ? "" : filter} referrals found.
        </div>
      ) : referrals.map((ref) => (
        <div
          key={ref.id}
          style={{ ...card, cursor: "pointer" }}
          onClick={() => { setSelected(ref); setShowReject(false); setRejectReason(""); }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <span style={{ fontWeight: 800, fontSize: "1rem", color: "var(--ink)" }}>{ref.patient_name}</span>
                {statusBadge(ref.status)}
                {priorityBadge(ref.priority)}
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                {ref.pathway}
                {ref.patient_nhs_number ? ` · NHS: ${ref.patient_nhs_number}` : ""}
                {ref.gp_practice ? ` · ${ref.gp_practice}` : ""}
                {ref.icb_name ? ` · ICB: ${ref.icb_name}` : ""}
              </div>
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)", textAlign: "right" }}>
              <div>{ref.id}</div>
              {ref.referred_date && (
                <div>Referred {new Date(ref.referred_date).toLocaleDateString("en-GB")}</div>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* GP Letter parser modal */}
      {showLetterParser && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
        }} onClick={() => setShowLetterParser(false)}>
          <div
            style={{ background: "var(--card-bg)", borderRadius: 16, padding: 28, width: "100%", maxWidth: 560 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: "0 0 8px", fontSize: "1.1rem", fontWeight: 800 }}>🤖 AI GP Letter Parser</h2>
            <p style={{ color: "var(--muted)", fontSize: "0.82rem", margin: "0 0 16px" }}>
              Paste the full GP referral letter below. AI will extract patient details, GP info, and pathway to pre-fill the form.
            </p>
            <textarea
              rows={10}
              value={letterText}
              onChange={(e) => setLetterText(e.target.value)}
              style={{ ...inp, resize: "vertical" }}
              placeholder="Paste GP referral letter here…"
            />
            <div style={{ display: "flex", gap: 10, marginTop: 14, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setShowLetterParser(false)} style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid var(--card-border)", background: "transparent", cursor: "pointer", fontWeight: 600 }}>Cancel</button>
              <button
                type="button"
                disabled={parsing || !letterText.trim()}
                onClick={() => { void handleParseLetterAndFill(); }}
                style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: "var(--brand)", color: "#fff", cursor: "pointer", fontWeight: 700 }}
              >
                {parsing ? "Parsing…" : "Extract & Pre-fill Form"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New referral modal */}
      {showNew && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
        }} onClick={() => setShowNew(false)}>
          <div
            style={{ background: "var(--card-bg)", borderRadius: 16, padding: 28, width: "100%", maxWidth: 600, maxHeight: "90vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: "0 0 20px", fontSize: "1.1rem", fontWeight: 800 }}>New NHS Referral</h2>
            <form onSubmit={(e) => { void handleCreate(e); }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                {[
                  { label: "Patient Full Name *", key: "patient_name", required: true },
                  { label: "Date of Birth", key: "patient_dob", type: "date" },
                  { label: "NHS Number", key: "patient_nhs_number" },
                  { label: "Patient Email", key: "patient_email", type: "email" },
                  { label: "Patient Phone", key: "patient_phone" },
                  { label: "GP Name", key: "gp_name" },
                  { label: "GP Practice", key: "gp_practice" },
                  { label: "GP Email", key: "gp_email", type: "email" },
                  { label: "ICB Name", key: "icb_name" },
                  { label: "Referral Date", key: "referred_date", type: "date" },
                ].map(({ label, key, type = "text", required = false }) => (
                  <div key={key} style={{ display: "flex", flexDirection: "column" }}>
                    <label style={lbl}>{label}</label>
                    <input
                      type={type}
                      required={required}
                      value={form[key as keyof NewForm]}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                      style={inp}
                    />
                  </div>
                ))}

                <div style={{ display: "flex", flexDirection: "column" }}>
                  <label style={lbl}>Pathway *</label>
                  <select
                    required
                    value={form.pathway}
                    onChange={(e) => setForm((f) => ({ ...f, pathway: e.target.value }))}
                    style={inp}
                  >
                    {PATHWAYS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                <div style={{ display: "flex", flexDirection: "column" }}>
                  <label style={lbl}>Priority</label>
                  <select
                    value={form.priority}
                    onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                    style={inp}
                  >
                    <option value="routine">Routine</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div style={{ marginTop: 14 }}>
                <label style={lbl}>Presenting Concerns</label>
                <textarea
                  rows={4}
                  value={form.presenting_concerns}
                  onChange={(e) => setForm((f) => ({ ...f, presenting_concerns: e.target.value }))}
                  style={{ ...inp, resize: "vertical" }}
                  placeholder="Brief summary of referral reason…"
                />
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setShowNew(false)} style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid var(--card-border)", background: "transparent", cursor: "pointer", fontWeight: 600 }}>
                  Cancel
                </button>
                <button type="submit" disabled={saving} style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: "var(--brand)", color: "#fff", cursor: "pointer", fontWeight: 700 }}>
                  {saving ? "Saving…" : "Create Referral"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail / actions panel */}
      {selected && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
        }} onClick={() => { setSelected(null); setShowReject(false); }}>
          <div
            style={{ background: "var(--card-bg)", borderRadius: 16, padding: 28, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800 }}>{selected.patient_name}</h2>
                <div style={{ marginTop: 4 }}>{statusBadge(selected.status)}</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", fontSize: "1.3rem", cursor: "pointer", color: "var(--muted)" }}>✕</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
              {[
                ["Referral ID", selected.id],
                ["Pathway", selected.pathway],
                ["Priority", selected.priority],
                ["NHS Number", selected.patient_nhs_number ?? "—"],
                ["DOB", selected.patient_dob ?? "—"],
                ["Email", selected.patient_email ?? "—"],
                ["GP Name", selected.gp_name ?? "—"],
                ["GP Practice", selected.gp_practice ?? "—"],
                ["GP Email", selected.gp_email ?? "—"],
                ["ICB", selected.icb_name ?? "—"],
              ].map(([k, v]) => (
                <div key={k}>
                  <div style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)" }}>{k}</div>
                  <div style={{ fontSize: "0.85rem", color: "var(--ink)" }}>{v}</div>
                </div>
              ))}
            </div>

            {selected.presenting_concerns && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)", marginBottom: 4 }}>Presenting Concerns</div>
                <div style={{ fontSize: "0.85rem", color: "var(--ink)", whiteSpace: "pre-wrap" }}>{selected.presenting_concerns}</div>
              </div>
            )}

            {selected.rejection_reason && (
              <div style={{ marginBottom: 14, background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#dc2626", marginBottom: 4 }}>REJECTION REASON</div>
                <div style={{ fontSize: "0.85rem", color: "#7f1d1d" }}>{selected.rejection_reason}</div>
              </div>
            )}

            {selected.converted_client_id && (
              <div style={{ marginBottom: 14, background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#16a34a", marginBottom: 4 }}>CONVERTED TO CLIENT</div>
                <a href={`/clinic-admin/clients/${selected.converted_client_id}`} style={{ fontSize: "0.85rem", color: "#166534" }}>
                  View client record →
                </a>
              </div>
            )}

            {/* Actions */}
            {selected.status === "pending" && (
              <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
                <button
                  onClick={() => { void handleAccept(selected.id); }}
                  disabled={actionBusy !== null}
                  style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "none", background: "#22c55e", color: "#fff", fontWeight: 700, cursor: "pointer" }}
                >
                  {actionBusy === selected.id + "-accept" ? "Accepting…" : "✓ Accept & Send Letter"}
                </button>
                <button
                  onClick={() => setShowReject(true)}
                  disabled={actionBusy !== null}
                  style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "none", background: "#ef4444", color: "#fff", fontWeight: 700, cursor: "pointer" }}
                >
                  ✕ Reject
                </button>
              </div>
            )}

            {selected.status === "accepted" && !selected.converted_client_id && (
              <button
                onClick={() => { void handleConvert(selected.id); }}
                disabled={actionBusy !== null}
                style={{ width: "100%", padding: "10px 0", borderRadius: 8, border: "none", background: "var(--brand)", color: "#fff", fontWeight: 700, cursor: "pointer", marginTop: 8 }}
              >
                {actionBusy === selected.id + "-convert" ? "Converting…" : "→ Convert to Client Record"}
              </button>
            )}

            {showReject && selected.status === "pending" && (
              <div style={{ marginTop: 16 }}>
                <label style={lbl}>Reason for rejection *</label>
                <textarea
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  style={{ ...inp, resize: "vertical" }}
                  placeholder="e.g. Patient outside catchment area…"
                />
                <button
                  onClick={() => { void handleReject(selected.id); }}
                  disabled={!rejectReason.trim() || actionBusy !== null}
                  style={{ marginTop: 10, width: "100%", padding: "9px 0", borderRadius: 8, border: "none", background: "#ef4444", color: "#fff", fontWeight: 700, cursor: "pointer" }}
                >
                  {actionBusy === selected.id + "-reject" ? "Rejecting…" : "Confirm Rejection"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
