"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { SlotAdminAction, TeamAvailabilitySlot } from "../lib/availability-api";
import {
  adminActionOnSlot,
  confirmRotaWeek,
  deleteAvailabilitySlot,
  fetchTeamAvailability,
} from "../lib/availability-api";

// ── Admin status helpers ────────────────────────────────────────────────────

function AdminStatusBadge({ status }: { status: string | null }) {
  if (!status || status === "pending") {
    return <span className="inline-badge status-neutral">Pending review</span>;
  }
  if (status === "accepted") {
    return <span className="inline-badge status-good">Accepted</span>;
  }
  if (status === "flagged") {
    return <span className="inline-badge status-warn">Flagged</span>;
  }
  if (status === "rejected") {
    return <span className="inline-badge status-error">Rejected</span>;
  }
  return <span className="inline-badge status-neutral">{status}</span>;
}

function RotaBadge({ status }: { status: string | null }) {
  if (status === "booked") {
    return <span className="inline-badge status-warn">Booked</span>;
  }
  if (status === "confirmed") {
    return <span className="inline-badge status-good">Confirmed</span>;
  }
  return <span className="inline-badge status-neutral">Draft</span>;
}

// ── Flag / Reject modal ─────────────────────────────────────────────────────

function ActionModal({
  slot,
  action,
  onConfirm,
  onCancel,
  busy,
}: {
  slot: TeamAvailabilitySlot;
  action: "flag" | "reject";
  onConfirm: (comment: string) => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const [comment, setComment] = useState("");
  const title = action === "flag" ? "Flag slot for review" : "Reject slot";
  const verb = action === "flag" ? "Flag" : "Reject";
  const colour = action === "flag" ? "var(--warning, #d97706)" : "var(--danger, #dc2626)";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: "var(--card-bg, #fff)",
          borderRadius: 12,
          padding: 28,
          width: "100%",
          maxWidth: 480,
          boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
        }}
      >
        <h3 style={{ marginTop: 0, color: colour, fontWeight: 800, letterSpacing: "-0.01em" }}>
          {title}
        </h3>
        <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 16 }}>
          <strong>{slot.full_name}</strong> - {slot.date_iso} {slot.start_time}–{slot.end_time}
        </p>
        <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
          Comment {action === "reject" ? "(required)" : "(optional)"}
        </label>
        <textarea
          autoFocus
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          style={{
            width: "100%",
            boxSizing: "border-box",
            border: "1px solid var(--card-border)",
            borderRadius: 6,
            padding: "8px 10px",
            fontSize: 14,
            fontFamily: "inherit",
            resize: "vertical",
          }}
          placeholder={
            action === "flag"
              ? "e.g. Please check - overlaps with training day"
              : "e.g. Slot declined due to low demand that week"
          }
        />
        <div style={{ display: "flex", gap: 10, marginTop: 18, justifyContent: "flex-end" }}>
          <button
            type="button"
            className="ghost-chip button-reset"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="primary-action button-reset"
            style={{ background: colour }}
            disabled={busy || (action === "reject" && !comment.trim())}
            onClick={() => onConfirm(comment)}
          >
            {busy ? "Saving…" : verb}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main panel ──────────────────────────────────────────────────────────────

export function TeamAvailabilityPanel() {
  const [items, setItems] = useState<TeamAvailabilitySlot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [weekId, setWeekId] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastRota, setLastRota] = useState<string | null>(null);
  const [filterName, setFilterName] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [filterAdminStatus, setFilterAdminStatus] = useState<string>("all");

  // Per-slot action modal state
  const [modalSlot, setModalSlot] = useState<TeamAvailabilitySlot | null>(null);
  const [modalAction, setModalAction] = useState<"flag" | "reject">("flag");
  const [modalBusy, setModalBusy] = useState(false);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchTeamAvailability();
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load team availability");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = filterName.trim().toLowerCase();
    const d = filterDate.trim();
    return items.filter((s) => {
      const nameHay = `${s.full_name} ${s.email ?? ""}`.toLowerCase();
      if (q && !nameHay.includes(q)) return false;
      if (d && s.date_iso !== d) return false;
      if (filterAdminStatus !== "all") {
        const statusNorm = s.admin_status ?? "pending";
        if (statusNorm !== filterAdminStatus) return false;
      }
      return true;
    });
  }, [items, filterName, filterDate, filterAdminStatus]);

  // ── Rota confirm (bulk) ──
  async function onConfirmRota() {
    if (!weekId.trim()) return;
    setBusy(true);
    try {
      setLastRota(null);
      const r = await confirmRotaWeek(weekId.trim());
      const n = r.notifications;
      setLastRota(
        n
          ? `Confirmed ${r.updated_slots} slot(s). Emails sent: ${n.email?.sent ?? 0} to ${n.email?.clinicians ?? 0} clinician(s).`
          : `Confirmed ${r.updated_slots} slot(s).`,
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not confirm rota");
    } finally {
      setBusy(false);
    }
  }

  // ── Per-slot accept ──
  async function onAccept(slot: TeamAvailabilitySlot) {
    setActionBusyId(slot.id);
    try {
      const updated = await adminActionOnSlot(slot.id, "accept");
      setItems((prev) => prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not accept slot");
    } finally {
      setActionBusyId(null);
    }
  }

  // ── Per-slot delete ──
  async function onDelete(slot: TeamAvailabilitySlot) {
    if (!confirm(`Delete slot for ${slot.full_name} on ${slot.date_iso}?`)) return;
    setActionBusyId(slot.id);
    try {
      await deleteAvailabilitySlot(slot.id);
      setItems((prev) => prev.filter((s) => s.id !== slot.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete slot");
    } finally {
      setActionBusyId(null);
    }
  }

  // ── Per-slot flag / reject (via modal) ──
  function openModal(slot: TeamAvailabilitySlot, action: "flag" | "reject") {
    setModalSlot(slot);
    setModalAction(action);
  }

  async function onModalConfirm(comment: string) {
    if (!modalSlot) return;
    setModalBusy(true);
    try {
      const updated = await adminActionOnSlot(modalSlot.id, modalAction, comment || undefined);
      setItems((prev) => prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)));
      setModalSlot(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save action");
    } finally {
      setModalBusy(false);
    }
  }

  // ── Per-slot reset to pending ──
  async function onReset(slot: TeamAvailabilitySlot) {
    setActionBusyId(slot.id);
    try {
      const updated = await adminActionOnSlot(slot.id, "reset");
      setItems((prev) => prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reset slot");
    } finally {
      setActionBusyId(null);
    }
  }

  return (
    <>
      {/* Flag / Reject modal */}
      {modalSlot && (
        <ActionModal
          slot={modalSlot}
          action={modalAction}
          onConfirm={(c) => void onModalConfirm(c)}
          onCancel={() => setModalSlot(null)}
          busy={modalBusy}
        />
      )}

      <article className="workspace-card" style={{ gridColumn: "1 / -1" }}>
        <div className="workspace-card-header">
          <div>
            <span className="panel-label">Capacity</span>
            <h2>Clinician-submitted availability</h2>
          </div>
          <button type="button" className="ghost-chip button-reset" onClick={() => void load()}>
            Refresh
          </button>
        </div>

        {error && (
          <p className="inline-badge status-warn" role="alert" style={{ display: "block", marginBottom: 12 }}>
            {error}
          </p>
        )}
        {lastRota && (
          <p className="inline-badge status-good" style={{ display: "block", marginBottom: 12 }}>
            {lastRota}
          </p>
        )}

        <p style={{ color: "var(--text-muted)", marginTop: 0 }}>
          Slots posted by clinicians appear here. Accept individual slots or confirm an entire ISO
          week. Flag a slot to request changes; reject with a comment to decline it.
        </p>

        {/* ── Bulk confirm week ── */}
        <div className="key-value-grid document-preview-meta" style={{ marginBottom: "1rem" }}>
          <label className="key-value-item">
            <span>Confirm ISO week (e.g. 2026-W18)</span>
            <input value={weekId} onChange={(e) => setWeekId(e.target.value)} placeholder="YYYY-Www" />
          </label>
          <div className="key-value-item" style={{ alignSelf: "end" }}>
            <button
              type="button"
              className="primary-action button-reset"
              disabled={busy || !weekId.trim()}
              onClick={() => void onConfirmRota()}
            >
              {busy ? "Confirming…" : "Confirm weekly rota"}
            </button>
          </div>
        </div>

        {/* ── Filters ── */}
        <div className="key-value-grid document-preview-meta" style={{ marginBottom: "1rem" }}>
          <label className="key-value-item">
            <span>Search clinician (name or email)</span>
            <input
              className="patient-table-input"
              style={{ minHeight: 36 }}
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              placeholder="e.g. Maya or @clinic.com"
            />
          </label>
          <label className="key-value-item">
            <span>Filter by date</span>
            <input
              className="patient-table-input"
              style={{ minHeight: 36 }}
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
            />
          </label>
          <label className="key-value-item">
            <span>Filter by review status</span>
            <select
              className="patient-table-input"
              style={{ minHeight: 36 }}
              value={filterAdminStatus}
              onChange={(e) => setFilterAdminStatus(e.target.value)}
            >
              <option value="all">All statuses</option>
              <option value="pending">Pending review</option>
              <option value="accepted">Accepted</option>
              <option value="flagged">Flagged</option>
              <option value="rejected">Rejected</option>
            </select>
          </label>
        </div>

        {/* ── Table ── */}
        <div className="data-table-shell">
          <div className="data-table">
            {/* Header */}
            <div
              className="data-table-head"
              style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 2fr 2fr" }}
            >
              <span>Clinician</span>
              <span>Date</span>
              <span>Window</span>
              <span>Rota</span>
              <span>Review</span>
              <span>Comment</span>
              <span>Actions</span>
            </div>

            {items.length === 0 ? (
              <div className="data-table-row" style={{ padding: "1.5rem" }}>
                No availability logged yet. Clinicians add slots from Clinical → Calendar.
              </div>
            ) : filtered.length === 0 ? (
              <div className="data-table-row" style={{ padding: "1.5rem" }}>
                No rows match your filters. Clear filters to see all {items.length} slot(s).
              </div>
            ) : (
              filtered.map((s) => {
                const isActionBusy = actionBusyId === s.id;
                const adminStatus = s.admin_status ?? "pending";

                return (
                  <div
                    key={s.id}
                    className="data-table-row"
                    style={{
                      gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 2fr 2fr",
                      alignItems: "start",
                      opacity: isActionBusy ? 0.6 : 1,
                    }}
                  >
                    {/* Clinician */}
                    <span>
                      <strong>{s.full_name}</strong>
                      <small style={{ display: "block", color: "var(--muted)" }}>{s.email}</small>
                    </span>

                    {/* Date */}
                    <span>{s.date_iso}</span>

                    {/* Window */}
                    <span>
                      {s.start_time}–{s.end_time}
                    </span>

                    {/* Rota status */}
                    <span>
                      <RotaBadge status={s.rota_status} />
                    </span>

                    {/* Admin review status */}
                    <span>
                      <AdminStatusBadge status={adminStatus} />
                      {s.reviewed_by && (
                        <small style={{ display: "block", color: "var(--muted)", marginTop: 2 }}>
                          by {s.reviewed_by}
                        </small>
                      )}
                    </span>

                    {/* Comment */}
                    <span>
                      {s.admin_comment ? (
                        <span style={{ fontSize: 13, color: "var(--ink)", fontStyle: "italic" }}>
                          "{s.admin_comment}"
                        </span>
                      ) : (
                        <span style={{ color: "var(--muted)", fontSize: 13 }}>-</span>
                      )}
                    </span>

                    {/* Actions */}
                    <span style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {adminStatus !== "accepted" && (
                        <button
                          type="button"
                          className="ghost-chip button-reset"
                          style={{ fontSize: 12, color: "var(--teal, #0d9488)" }}
                          disabled={isActionBusy}
                          onClick={() => void onAccept(s)}
                          title="Accept this slot and confirm it"
                        >
                          ✓ Accept
                        </button>
                      )}
                      {adminStatus !== "flagged" && (
                        <button
                          type="button"
                          className="ghost-chip button-reset"
                          style={{ fontSize: 12, color: "var(--warning, #d97706)" }}
                          disabled={isActionBusy}
                          onClick={() => openModal(s, "flag")}
                          title="Flag slot for further review"
                        >
                          ⚑ Flag
                        </button>
                      )}
                      {adminStatus !== "rejected" && (
                        <button
                          type="button"
                          className="ghost-chip button-reset"
                          style={{ fontSize: 12, color: "var(--danger, #dc2626)" }}
                          disabled={isActionBusy}
                          onClick={() => openModal(s, "reject")}
                          title="Reject this slot"
                        >
                          ✕ Reject
                        </button>
                      )}
                      {adminStatus !== "pending" && (
                        <button
                          type="button"
                          className="ghost-chip button-reset"
                          style={{ fontSize: 12 }}
                          disabled={isActionBusy}
                          onClick={() => void onReset(s)}
                          title="Reset to pending review"
                        >
                          ↺ Reset
                        </button>
                      )}
                      <button
                        type="button"
                        className="ghost-chip button-reset"
                        style={{ fontSize: 12, color: "var(--danger, #dc2626)" }}
                        disabled={isActionBusy}
                        onClick={() => void onDelete(s)}
                        title="Delete this slot permanently"
                      >
                        🗑 Delete
                      </button>
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Legend */}
        <div style={{ marginTop: 16, display: "flex", gap: 16, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            <span className="inline-badge status-good" style={{ marginRight: 4 }}>Accepted</span>
            Slot approved - rota confirmed
          </span>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            <span className="inline-badge status-warn" style={{ marginRight: 4 }}>Flagged</span>
            Needs attention / clarification
          </span>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            <span className="inline-badge status-error" style={{ marginRight: 4 }}>Rejected</span>
            Slot declined with reason
          </span>
        </div>
      </article>
    </>
  );
}
