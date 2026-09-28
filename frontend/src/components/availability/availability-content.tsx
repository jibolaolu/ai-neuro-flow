"use client";
import { useCallback, useEffect, useState } from "react";
import { browserApiUrl } from "../../lib/get-api-base";

type Slot = {
  id: string;
  user_id: string;
  full_name: string;
  email: string | null;
  date_iso: string;
  start_time: string;
  end_time: string;
  week_id: string;
  rota_status: string;
  admin_status: string | null;
  admin_comment: string | null;
  reviewed_by: string | null;
  booked_client_name: string | null;
};

const ADMIN_STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  pending:  { bg: "#fffbeb", color: "#b45309", label: "Pending review" },
  accepted: { bg: "#f0fdf4", color: "#166534", label: "Accepted" },
  rejected: { bg: "#fef2f2", color: "#991b1b", label: "Rejected" },
  flagged:  { bg: "#eff6ff", color: "#1e40af", label: "Flagged" },
};

function fmtDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

export function AvailabilityContent({ isAdmin }: { isAdmin: boolean }) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "accepted" | "rejected" | "flagged">("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [commentTarget, setCommentTarget] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ date_iso: "", start_time: "", end_time: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = isAdmin
        ? browserApiUrl("/api/v1/availability/team")
        : browserApiUrl("/api/v1/availability/mine");
      const r = await fetch(url, { credentials: "include" });
      if (!r.ok) { setErr("Could not load availability slots"); return; }
      const data = await r.json() as { items: Slot[] };
      setSlots(data.items ?? []);
    } catch { setErr("Could not load availability slots"); }
    finally { setLoading(false); }
  }, [isAdmin]);

  useEffect(() => { void load(); }, [load]);

  async function handleAdminAction(id: string, action: "accept" | "reject" | "flag", c?: string) {
    setBusy(id);
    try {
      const r = await fetch(browserApiUrl(`/api/v1/availability/slots/${id}`), {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, comment: c ?? null }),
      });
      if (!r.ok) { setMsg("Action failed — please try again"); return; }
      setMsg(`Slot ${action}ed successfully`);
      setCommentTarget(null); setComment("");
      void load();
    } catch { setMsg("Action failed"); }
    finally { setBusy(null); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this availability slot?")) return;
    setBusy(id);
    try {
      await fetch(browserApiUrl(`/api/v1/availability/slots/${id}`), { method: "DELETE", credentials: "include" });
      setMsg("Slot deleted"); void load();
    } catch { setMsg("Could not delete slot"); }
    finally { setBusy(null); }
  }

  async function handleSubmitSlot(e: React.FormEvent) {
    e.preventDefault();
    setBusy("new");
    try {
      const r = await fetch(browserApiUrl("/api/v1/availability/slots"), {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({})) as { detail?: string };
        setMsg(d.detail ?? "Could not submit slot"); return;
      }
      setMsg("Availability slot submitted for review");
      setShowForm(false); setForm({ date_iso: "", start_time: "", end_time: "" });
      void load();
    } catch { setMsg("Could not submit slot"); }
    finally { setBusy(null); }
  }

  const visible = slots.filter((s) => {
    if (filter !== "all" && (s.admin_status ?? "pending") !== filter) return false;
    return true;
  });
  const pendingCount = slots.filter((s) => !s.admin_status || s.admin_status === "pending").length;

  return (
    <>
      <style>{`
        .av-card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden}
        .av-row{display:grid;padding:12px 16px;border-bottom:1px solid #f1f5f9;font-size:13px;align-items:center;gap:8px}
        .av-row:last-child{border-bottom:none}
        .av-head{background:#f8fafc;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:#94a3b8;padding:9px 16px}
        .av-badge{font-size:11px;font-weight:700;padding:2px 8px;border-radius:99px}
        .av-btn{padding:5px 12px;border-radius:6px;font-size:11px;font-weight:700;border:none;cursor:pointer;font-family:inherit}
        .av-tab{padding:5px 14px;border-radius:99px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit}
        .av-input{padding:8px 10px;border-radius:8px;border:1.5px solid #e2e8f0;font-size:13px;font-family:inherit;outline:none}
        .av-input:focus{border-color:#1e40af}
      `}</style>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ margin: "0 0 4px", fontSize: "1.1rem", fontWeight: 800, color: "#0f172a" }}>
            {isAdmin ? "Team availability slots" : "My availability"}
          </h2>
          {isAdmin && pendingCount > 0 && <p style={{ margin: 0, fontSize: 13, color: "#b45309" }}>{pendingCount} slot{pendingCount !== 1 ? "s" : ""} pending review</p>}
        </div>
        {!isAdmin && (
          <button onClick={() => setShowForm((v) => !v)} style={{ padding: "8px 16px", background: "#1e40af", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
            {showForm ? "Cancel" : "+ Submit availability"}
          </button>
        )}
      </div>

      {msg && (
        <div style={{ padding: "9px 14px", borderRadius: 8, background: "#f0fdf4", color: "#166534", fontSize: 13, marginBottom: 12, display: "flex", justifyContent: "space-between" }}>
          {msg}
          <button onClick={() => setMsg(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#166534", fontWeight: 700 }}>×</button>
        </div>
      )}

      {!isAdmin && showForm && (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 18, marginBottom: 16 }}>
          <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 800 }}>New availability slot</h3>
          <form onSubmit={(e) => void handleSubmitSlot(e)} style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 3 }}>Date</label>
              <input type="date" required value={form.date_iso} onChange={(e) => setForm((f) => ({ ...f, date_iso: e.target.value }))} className="av-input" />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 3 }}>Start time</label>
              <input type="time" required value={form.start_time} onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))} className="av-input" />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 3 }}>End time</label>
              <input type="time" required value={form.end_time} onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))} className="av-input" />
            </div>
            <button type="submit" disabled={busy === "new"} style={{ padding: "8px 16px", background: "#1e40af", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
              {busy === "new" ? "Submitting…" : "Submit"}
            </button>
          </form>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        {(["all", "pending", "accepted", "rejected", "flagged"] as const).map((f) => {
          const active = filter === f;
          return (
            <button key={f} className="av-tab" onClick={() => setFilter(f)} style={{ border: active ? "1.5px solid #1e40af" : "1px solid #e2e8f0", background: active ? "#1e40af" : "#fff", color: active ? "#fff" : "#374151" }}>
              {f === "all" ? "All slots" : ADMIN_STATUS_STYLE[f]?.label ?? f}
              {f === "pending" && pendingCount > 0 && ` (${pendingCount})`}
            </button>
          );
        })}
      </div>

      <div className="av-card">
        {loading && <div style={{ padding: 32, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>Loading…</div>}
        {err && <div style={{ padding: 32, textAlign: "center", color: "#dc2626", fontSize: 13 }}>{err}</div>}
        {!loading && !err && visible.length === 0 && (
          <div style={{ padding: 32, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>No availability slots found.</div>
        )}
        {!loading && visible.map((s) => {
          const st = ADMIN_STATUS_STYLE[s.admin_status ?? "pending"] ?? ADMIN_STATUS_STYLE.pending;
          const isShowingComment = commentTarget === s.id;
          return (
            <div key={s.id}>
              <div className="av-row" style={{ gridTemplateColumns: isAdmin ? "1.5fr 1fr 1fr 1fr 1fr auto" : "1.5fr 1fr 1fr 1fr auto" }}>
                {isAdmin && (
                  <span>
                    <strong style={{ display: "block", fontSize: 13 }}>{s.full_name}</strong>
                    {s.email && <small style={{ color: "#94a3b8", fontSize: 11 }}>{s.email}</small>}
                  </span>
                )}
                <span>{fmtDate(s.date_iso)}</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>{s.start_time} – {s.end_time}</span>
                <span>
                  <span className="av-badge" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                  {s.booked_client_name && <small style={{ display: "block", color: "#94a3b8", fontSize: 11, marginTop: 2 }}>Booked: {s.booked_client_name}</small>}
                </span>
                <span style={{ fontSize: 12, color: "#94a3b8" }}>{s.week_id}</span>
                <span style={{ display: "flex", gap: 6 }}>
                  {isAdmin && (!s.admin_status || s.admin_status === "pending" || s.admin_status === "flagged") && (
                    <button className="av-btn" disabled={busy === s.id} onClick={() => void handleAdminAction(s.id, "accept")} style={{ background: "#f0fdf4", color: "#166534", border: "1px solid #166534" }}>Accept</button>
                  )}
                  {isAdmin && s.admin_status !== "rejected" && (
                    <button className="av-btn" disabled={busy === s.id} onClick={() => { setCommentTarget(isShowingComment ? null : s.id); setComment(""); }} style={{ background: "#f8fafc", color: "#374151", border: "1px solid #e2e8f0" }}>
                      {s.admin_status === "flagged" ? "Reject" : "Reject / Flag"}
                    </button>
                  )}
                  {!isAdmin && s.rota_status === "draft" && (
                    <button className="av-btn" disabled={busy === s.id} onClick={() => void handleDelete(s.id)} style={{ background: "#fef2f2", color: "#991b1b", border: "1px solid #fca5a5" }}>Remove</button>
                  )}
                </span>
              </div>
              {isShowingComment && (
                <div style={{ padding: "12px 16px", background: "#fffbeb", borderTop: "1px solid #fef3c7", display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <label style={{ fontSize: 11, color: "#64748b", fontWeight: 600, display: "block", marginBottom: 4 }}>Comment (optional)</label>
                    <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Reason…" className="av-input" style={{ width: "100%" }} />
                  </div>
                  <button className="av-btn" onClick={() => void handleAdminAction(s.id, "reject", comment || undefined)} disabled={busy === s.id} style={{ background: "#ef4444", color: "#fff", border: "none" }}>Reject</button>
                  <button className="av-btn" onClick={() => void handleAdminAction(s.id, "flag", comment || undefined)} disabled={busy === s.id} style={{ background: "#3b82f6", color: "#fff", border: "none" }}>Flag</button>
                  <button className="av-btn" onClick={() => setCommentTarget(null)} style={{ background: "transparent", color: "#64748b", border: "1px solid #e2e8f0" }}>Cancel</button>
                </div>
              )}
              {s.admin_comment && (
                <div style={{ padding: "5px 16px 8px", background: "#f8fafc", borderTop: "1px solid #f1f5f9", fontSize: 12, color: "#64748b" }}>
                  Note: {s.admin_comment} — {s.reviewed_by}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
