"use client";

import { useCallback, useEffect, useState } from "react";
import {
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type SupportTicket,
  type TicketUpdatePayload,
  fetchTickets,
  updateTicket,
} from "../lib/support-ticket-api";

/* ── SVG icons ──────────────────────────────────────────────────────────────── */
function ChevronIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}
function FilterIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 4h12M4 8h8M6 12h4" />
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 3l10 10M13 3L3 13" />
    </svg>
  );
}

/* ── Chip helpers ───────────────────────────────────────────────────────────── */
function ticketStatusChip(status: string): string {
  switch (status) {
    case "open":          return "chip-neutral";
    case "in_progress":   return "chip-purple";
    case "awaiting_info": return "chip-blue";
    case "resolved":      return "chip-teal";
    case "closed":        return "chip-green";
    default:              return "chip-neutral";
  }
}
function priorityChip(priority: string): string {
  switch (priority) {
    case "critical": return "chip-red";
    case "high":     return "chip-warn";
    case "medium":   return "chip-blue";
    default:         return "chip-neutral";
  }
}
function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch { return "—"; }
}

/* ── Respond modal ──────────────────────────────────────────────────────────── */
function RespondModal({
  ticket,
  onClose,
  onSaved,
}: {
  ticket: SupportTicket;
  onClose: () => void;
  onSaved: (updated: SupportTicket) => void;
}) {
  const [newStatus, setNewStatus]   = useState(ticket.status);
  const [assignTo, setAssignTo]     = useState(ticket.assigned_to_name ?? "");
  const [response, setResponse]     = useState(ticket.platform_response ?? "");
  const [priority, setPriority]     = useState(ticket.priority);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload: TicketUpdatePayload = {
        status: newStatus,
        platform_response: response || undefined,
        priority,
        assigned_to_name: assignTo || undefined,
      };
      const updated = await updateTicket(ticket.id, payload);
      onSaved(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pth-modal-overlay" role="dialog" aria-modal aria-label="Respond to ticket">
      <div className="pth-modal">
        <div className="pth-modal-header">
          <div>
            <span className="panel-label">Platform team</span>
            <h3>Respond to {ticket.id}</h3>
          </div>
          <button type="button" className="pth-modal-close button-reset" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        {/* Ticket summary */}
        <div className="pth-modal-summary">
          <p className="pth-modal-title">{ticket.title}</p>
          <p className="pth-modal-body">{ticket.description}</p>
          <p className="pth-modal-meta">
            Raised by <strong>{ticket.raised_by_name || ticket.raised_by_email}</strong>
            {ticket.clinic_name ? ` · ${ticket.clinic_name}` : ""}
            {" · "}{formatDate(ticket.created_at)}
          </p>
        </div>

        {/* Update form — connected filter bar style */}
        <div className="cah-filter-bar" style={{ marginBottom: "1rem" }}>
          <div className="cah-filter-field cah-filter-field--select">
            <label htmlFor="pth-status" className="cah-filter-label">
              <FilterIcon /> Status
            </label>
            <div className="cah-select-wrap">
              <select
                id="pth-status"
                className="cah-select"
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
              >
                {TICKET_STATUSES.filter((s) => s.value !== "").map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <span className="cah-select-icon"><ChevronIcon /></span>
            </div>
          </div>

          <div className="cah-filter-divider" aria-hidden />

          <div className="cah-filter-field cah-filter-field--select">
            <label htmlFor="pth-priority" className="cah-filter-label">
              Priority
            </label>
            <div className="cah-select-wrap">
              <select
                id="pth-priority"
                className="cah-select"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                {TICKET_PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
              <span className="cah-select-icon"><ChevronIcon /></span>
            </div>
          </div>

          <div className="cah-filter-divider" aria-hidden />

          <div className="cah-filter-field" style={{ flex: 1 }}>
            <label htmlFor="pth-assign" className="cah-filter-label">Assigned to</label>
            <input
              id="pth-assign"
              type="text"
              className="cah-date-input"
              placeholder="Engineer name…"
              value={assignTo}
              onChange={(e) => setAssignTo(e.target.value)}
            />
          </div>
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <label className="cfp-textarea-label">Platform response <span>(visible to clinic)</span></label>
          <textarea
            className="cfp-textarea"
            placeholder="Write your response to the clinic team…"
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            rows={5}
            maxLength={10000}
          />
        </div>

        {error && (
          <p className="inline-badge status-warn" role="alert" style={{ marginBottom: "0.75rem" }}>{error}</p>
        )}

        <div className="cfp-submit-row">
          <button
            type="button"
            className="btn-primary"
            onClick={() => { void handleSave(); }}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save response"}
          </button>
          <button type="button" className="cah-clear-btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

/* ── Main hub ───────────────────────────────────────────────────────────────── */
export function PlatformTicketsHub() {
  const [tickets, setTickets]       = useState<SupportTicket[]>([]);
  const [loadError, setLoadError]   = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected]     = useState<SupportTicket | null>(null);

  const load = useCallback(async () => {
    try {
      setLoadError(null);
      const data = await fetchTickets(statusFilter || undefined);
      setTickets(data.items);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Load failed");
    }
  }, [statusFilter]);

  useEffect(() => { void load(); }, [load]);

  const handleSaved = (updated: SupportTicket) => {
    setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    setSelected(null);
  };

  const open     = tickets.filter((t) => t.status === "open").length;
  const active   = tickets.filter((t) => t.status === "in_progress" || t.status === "awaiting_info").length;
  const resolved = tickets.filter((t) => t.status === "resolved" || t.status === "closed").length;

  return (
    <div className="calendar-layout">

      {/* ── Metric strip ── */}
      <div className="metrics-strip admin-control-metrics">
        <article className="snapshot-card">
          <span>Total tickets</span>
          <strong>{tickets.length}</strong>
          <small className="metric-status-neutral">All clinics</small>
        </article>
        <article className="snapshot-card">
          <span>Open (unassigned)</span>
          <strong>{open}</strong>
          <small className="metric-status-warn">Needs attention</small>
        </article>
        <article className="snapshot-card">
          <span>In progress</span>
          <strong>{active}</strong>
          <small className="metric-status-neutral">Being handled</small>
        </article>
        <article className="snapshot-card">
          <span>Resolved / closed</span>
          <strong>{resolved}</strong>
          <small className="metric-status-good">Done</small>
        </article>
      </div>

      {/* ── Filter + table ── */}
      <article className="workspace-card admin-portfolio-card">
        <div className="workspace-card-header">
          <div>
            <span className="panel-label">Platform engineering</span>
            <h2>All support tickets</h2>
          </div>
          <button type="button" className="cah-clear-btn" onClick={() => void load()}>
            Refresh
          </button>
        </div>

        {/* Filter bar */}
        <div className="cah-filter-bar" style={{ marginBottom: "1.25rem" }}>
          <div className="cah-filter-field cah-filter-field--select">
            <label htmlFor="pth-filter-status" className="cah-filter-label">
              <FilterIcon /> Status
            </label>
            <div className="cah-select-wrap">
              <select
                id="pth-filter-status"
                className="cah-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                {TICKET_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <span className="cah-select-icon"><ChevronIcon /></span>
            </div>
          </div>
        </div>

        {loadError && (
          <p className="inline-badge status-warn" role="alert">{loadError}</p>
        )}

        <div className="data-table-shell">
          <div className="data-table">
            <div className="data-table-head pth-ticket-table">
              <span>Ref</span>
              <span>Clinic</span>
              <span>Subject</span>
              <span>Category</span>
              <span>Priority</span>
              <span>Status</span>
              <span>Raised</span>
              <span>Action</span>
            </div>

            {tickets.length === 0 ? (
              <div className="cah-empty-state">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                </svg>
                <p>No tickets found.</p>
                {statusFilter && (
                  <button type="button" className="cah-clear-btn" onClick={() => setStatusFilter("")}>
                    Clear filter
                  </button>
                )}
              </div>
            ) : (
              tickets.map((t) => (
                <div key={t.id} className="data-table-row pth-ticket-table">
                  <span className="cah-case-id">{t.id}</span>
                  <span>{t.clinic_name ?? "—"}</span>
                  <span className="cah-client-name">{t.title}</span>
                  <span>{TICKET_CATEGORIES.find((c) => c.value === t.category)?.label ?? t.category}</span>
                  <span>
                    <span className={`status-chip ${priorityChip(t.priority)}`}>
                      {t.priority.charAt(0).toUpperCase() + t.priority.slice(1)}
                    </span>
                  </span>
                  <span>
                    <span className={`status-chip ${ticketStatusChip(t.status)}`}>
                      {t.status.replace("_", " ")}
                    </span>
                  </span>
                  <span>{formatDate(t.created_at)}</span>
                  <span>
                    <button
                      type="button"
                      className="cah-clear-btn"
                      onClick={() => setSelected(t)}
                    >
                      Respond
                    </button>
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </article>

      {/* Respond modal */}
      {selected && (
        <RespondModal
          ticket={selected}
          onClose={() => setSelected(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
