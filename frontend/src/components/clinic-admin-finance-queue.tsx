"use client";

import { useCallback, useEffect, useState } from "react";

import {
  fetchAdminInvoiceRequests,
  patchAdminInvoiceRequest,
  type AdminInvoiceRequest,
} from "../lib/admin-clinician-finance-api";

// ── Helpers ───────────────────────────────────────────────────────────────────

const FILTER_OPTIONS = [
  { value: "pending",         label: "Pending approval" },
  { value: "approved",        label: "Approved" },
  { value: "rejected",        label: "Rejected" },
  { value: "needs_revision",  label: "Needs revision" },
  { value: "all",             label: "All requests" },
] as const;

function approvalChip(status: string): { label: string; cls: string } {
  switch (status) {
    case "approved":       return { label: "Approved",       cls: "fin-chip fin-chip--approved" };
    case "rejected":       return { label: "Rejected",       cls: "fin-chip fin-chip--rejected" };
    case "needs_revision": return { label: "Needs revision", cls: "fin-chip fin-chip--revision" };
    default:               return { label: "Pending",        cls: "fin-chip fin-chip--pending" };
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ClinicAdminFinanceQueue() {
  const [filter, setFilter]     = useState<string>("pending");
  const [rows, setRows]         = useState<AdminInvoiceRequest[]>([]);
  const [loadErr, setLoadErr]   = useState<string | null>(null);
  const [busyId, setBusyId]     = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminInvoiceRequest | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");

  const load = useCallback(async () => {
    setLoadErr(null);
    try {
      setRows(await fetchAdminInvoiceRequests(filter === "all" ? "all" : filter));
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Load failed");
    }
  }, [filter]);

  useEffect(() => { void load(); }, [load]);

  async function applyAction(action: "approve" | "reject" | "needs_revision") {
    if (!selected) return;
    if ((action === "reject" || action === "needs_revision") && !reviewNotes.trim()) {
      setLoadErr("Add review notes for reject or revision.");
      return;
    }
    setBusyId(selected.id);
    setLoadErr(null);
    try {
      await patchAdminInvoiceRequest(selected.id, { action, notes: reviewNotes.trim() || null });
      setSelected(null);
      setReviewNotes("");
      await load();
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  }

  const activeFilter = FILTER_OPTIONS.find((o) => o.value === filter);

  return (
    <div className="fin-shell">

      {/* ── Header toolbar ───────────────────────────────────────────────── */}
      <div className="fin-toolbar">
        <div className="fin-toolbar-left">
          <p className="fin-toolbar-lead">
            Review self-employed clinician invoice requests. Approve before disbursement runs.
          </p>
          <div className="fin-filter-row">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`fin-filter-btn${filter === opt.value ? " fin-filter-btn--active" : ""}`}
                onClick={() => setFilter(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <button type="button" className="ghost-chip button-reset fin-refresh-btn" onClick={() => void load()}>
          ↻ Refresh
        </button>
      </div>

      {/* ── Error banner ─────────────────────────────────────────────────── */}
      {loadErr && (
        <div className="fin-error-banner" role="alert">{loadErr}</div>
      )}

      {/* ── Queue label ──────────────────────────────────────────────────── */}
      <div className="fin-queue-label">
        <span className="panel-label">{activeFilter?.label ?? "Queue"}</span>
        <strong className="fin-queue-count">{rows.length} request{rows.length !== 1 ? "s" : ""}</strong>
      </div>

      {/* ── Table ────────────────────────────────────────────────────────── */}
      <article className="workspace-card fin-table-card">
        <div className="data-table-shell">
          <div className="data-table">
            <div className="data-table-head fin-table-cols">
              <span>Clinician</span>
              <span>Period</span>
              <span>Lines</span>
              <span>Hrs</span>
              <span>Approval</span>
              <span>Action</span>
            </div>

            {rows.length === 0 ? (
              <div className="fin-empty-row">
                No invoice requests in this filter.
              </div>
            ) : (
              rows.map((r) => {
                const chip = approvalChip(r.approval_status);
                return (
                  <div key={r.id} className="data-table-row fin-table-cols fin-table-row">
                    <span className="fin-clinician-cell">
                      <strong className="fin-clinician-name">{r.clinician_full_name}</strong>
                    </span>
                    <span className="fin-period">
                      {r.period_from} → {r.period_to}
                    </span>
                    <span className="fin-num">{r.line_count ?? "—"}</span>
                    <span className="fin-num">{r.total_hours != null ? r.total_hours.toFixed(2) : "—"}</span>
                    <span>
                      <span className={chip.cls}>{chip.label}</span>
                    </span>
                    <span>
                      <button type="button" className="fin-review-btn button-reset" onClick={() => setSelected(r)}>
                        Review →
                      </button>
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </article>

      {/* ── Review modal ─────────────────────────────────────────────────── */}
      {selected && (
        <div className="calendar-modal-backdrop" onClick={() => setSelected(null)} role="presentation">
          <div
            className="calendar-booking-modal"
            role="dialog"
            aria-label="Review invoice request"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 560 }}
          >
            <div className="workspace-card-header">
              <div>
                <span className="panel-label">Invoice request</span>
                <h2 style={{ margin: 0 }}>{selected.clinician_full_name}</h2>
              </div>
              <button type="button" className="ghost-chip button-reset" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>
            <p style={{ color: "var(--muted)", fontSize: "0.875rem", marginTop: 8 }}>
              Ref <code style={{ background: "var(--muted-100)", padding: "1px 5px", borderRadius: 4 }}>
                {selected.id.slice(0, 13)}…
              </code>
              {" · "}
              <span className={approvalChip(selected.approval_status).cls}>
                {approvalChip(selected.approval_status).label}
              </span>
            </p>
            <ul className="clean-list" style={{ marginTop: "0.75rem", fontSize: 14, lineHeight: 1.8 }}>
              <li><strong>Period:</strong> {selected.period_from} → {selected.period_to}</li>
              <li><strong>Lines / hours:</strong> {selected.line_count ?? "—"} / {selected.total_hours != null ? selected.total_hours.toFixed(2) : "—"}</li>
              {selected.notes && <li><strong>Clinician notes:</strong> {selected.notes}</li>}
              {selected.review_notes && <li><strong>Previous review:</strong> {selected.review_notes}</li>}
            </ul>
            <label style={{ display: "grid", marginTop: "1rem", gap: 6, fontSize: 13, fontWeight: 600 }}>
              Review notes <span style={{ fontWeight: 400, color: "var(--muted)" }}>(required for reject / revision)</span>
              <textarea rows={4} style={{ padding: "8px 10px", border: "1px solid var(--card-border)", borderRadius: 6, fontSize: 14, fontFamily: "inherit", resize: "vertical" }} value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} />
            </label>
            <div className="button-strip" style={{ marginTop: "1rem", flexWrap: "wrap", gap: 8 }}>
              <button type="button" className="primary-action button-reset" disabled={busyId === selected.id} onClick={() => void applyAction("approve")}>
                ✓ Approve
              </button>
              <button type="button" className="ghost-chip button-reset" disabled={busyId === selected.id} onClick={() => void applyAction("needs_revision")}>
                Request revision
              </button>
              <button type="button" className="ghost-chip button-reset" style={{ color: "var(--danger)" }} disabled={busyId === selected.id} onClick={() => void applyAction("reject")}>
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
