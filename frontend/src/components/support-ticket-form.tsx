"use client";

import { useEffect, useState } from "react";
import {
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  type SupportTicket,
  type TicketCreatePayload,
  createTicket,
  fetchTickets,
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
function TicketIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="1" y="4" width="14" height="8" rx="2" />
      <path d="M5 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
    </svg>
  );
}
function NoteIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="1" width="12" height="14" rx="2" />
      <path d="M5 5h6M5 8h6M5 11h4" />
    </svg>
  );
}

/* ── Status chip helper ─────────────────────────────────────────────────────── */
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

/* ── Component ──────────────────────────────────────────────────────────────── */
export function SupportTicketForm() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Form state
  const [title, setTitle]           = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory]     = useState("other");
  const [priority, setPriority]     = useState("medium");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Expanded ticket
  const [expanded, setExpanded] = useState<string | null>(null);

  const loadTickets = async () => {
    try {
      setLoadError(null);
      const data = await fetchTickets();
      setTickets(data.items);
      setLoaded(true);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load");
    }
  };

  // Load on mount
  useEffect(() => { void loadTickets(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    try {
      const payload: TicketCreatePayload = { title, description, category, priority };
      await createTicket(payload);
      setTitle("");
      setDescription("");
      setCategory("other");
      setPriority("medium");
      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 5000);
      void loadTickets();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="calendar-layout">

      {/* ── Metric strip ── */}
      <div className="metrics-strip admin-control-metrics">
        <article className="snapshot-card">
          <span>Total tickets</span>
          <strong>{tickets.length}</strong>
          <small className="metric-status-neutral">All time</small>
        </article>
        <article className="snapshot-card">
          <span>Open / in-progress</span>
          <strong>{tickets.filter(t => t.status === "open" || t.status === "in_progress").length}</strong>
          <small className="metric-status-warn">Active</small>
        </article>
        <article className="snapshot-card">
          <span>Resolved</span>
          <strong>{tickets.filter(t => t.status === "resolved" || t.status === "closed").length}</strong>
          <small className="metric-status-good">Closed</small>
        </article>
      </div>

      {/* ── Raise ticket form ── */}
      <article className="workspace-card admin-portfolio-card">
        <div className="workspace-card-header">
          <div>
            <span className="panel-label">Platform support</span>
            <h2>Raise a support ticket</h2>
          </div>
        </div>

        <div className="cfp-notice">
          <p>Tickets are reviewed by the <strong>Neuro Flow platform team</strong>. You will receive a response via this portal.
            For urgent issues please also contact your account manager directly.</p>
        </div>

        <div className="cfp-form-card-body" style={{ paddingTop: "1rem" }}>
          <form onSubmit={(e) => { void handleSubmit(e); }}>
            {/* Row 1 — Category + Priority */}
            <div className="cah-filter-bar" style={{ marginBottom: "1rem" }}>
              <div className="cah-filter-field cah-filter-field--select">
                <label htmlFor="stf-category" className="cah-filter-label">
                  <FilterIcon /> Category
                </label>
                <div className="cah-select-wrap">
                  <select
                    id="stf-category"
                    className="cah-select"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    required
                  >
                    {TICKET_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                  <span className="cah-select-icon"><ChevronIcon /></span>
                </div>
              </div>

              <div className="cah-filter-divider" aria-hidden />

              <div className="cah-filter-field cah-filter-field--select">
                <label htmlFor="stf-priority" className="cah-filter-label">
                  <TicketIcon /> Priority
                </label>
                <div className="cah-select-wrap">
                  <select
                    id="stf-priority"
                    className="cah-select"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    required
                  >
                    {TICKET_PRIORITIES.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                  <span className="cah-select-icon"><ChevronIcon /></span>
                </div>
              </div>

              <div className="cah-filter-divider" aria-hidden />

              <div className="cah-filter-field" style={{ flex: 2 }}>
                <label htmlFor="stf-title" className="cah-filter-label">
                  <NoteIcon /> Subject
                </label>
                <input
                  id="stf-title"
                  type="text"
                  className="cah-date-input"
                  placeholder="Brief summary of the issue…"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  maxLength={200}
                />
              </div>
            </div>

            {/* Row 2 — Description textarea */}
            <div style={{ marginBottom: "1rem" }}>
              <label className="cfp-textarea-label">
                <NoteIcon /> Description <span>(required)</span>
              </label>
              <textarea
                className="cfp-textarea"
                placeholder="Describe the issue in detail — steps to reproduce, expected vs actual behaviour, screenshots if applicable…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                minLength={10}
                maxLength={10000}
                rows={5}
              />
            </div>

            {submitError && (
              <p className="inline-badge status-warn" role="alert" style={{ marginBottom: "0.75rem" }}>
                {submitError}
              </p>
            )}
            {submitSuccess && (
              <p className="inline-badge status-ok" role="status" style={{ marginBottom: "0.75rem" }}>
                ✓ Ticket submitted successfully — the platform team will respond shortly.
              </p>
            )}

            <div className="cfp-submit-row">
              <button
                type="submit"
                className="btn-primary"
                disabled={submitting}
              >
                {submitting ? "Submitting…" : "Submit ticket"}
              </button>
              <span className="cfp-submit-hint">Your ticket will be visible below once submitted.</span>
            </div>
          </form>
        </div>
      </article>

      {/* ── My tickets table ── */}
      <article className="workspace-card admin-portfolio-card">
        <div className="workspace-card-header">
          <div>
            <span className="panel-label">Ticket history</span>
            <h2>My support tickets</h2>
          </div>
          <button type="button" className="cah-clear-btn" onClick={() => void loadTickets()}>
            Refresh
          </button>
        </div>

        {loadError && (
          <p className="inline-badge status-warn" role="alert">{loadError}</p>
        )}

        <div className="data-table-shell">
          <div className="data-table">
            <div className="data-table-head stf-ticket-table">
              <span>Ref</span>
              <span>Subject</span>
              <span>Category</span>
              <span>Priority</span>
              <span>Status</span>
              <span>Raised</span>
            </div>

            {!loaded ? (
              <div className="cah-empty-state"><p>Loading tickets…</p></div>
            ) : tickets.length === 0 ? (
              <div className="cah-empty-state">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                </svg>
                <p>No tickets raised yet.</p>
              </div>
            ) : (
              tickets.map((t) => (
                <div key={t.id}>
                  <button
                    type="button"
                    className="data-table-row stf-ticket-table data-table-link-row"
                    onClick={() => setExpanded(expanded === t.id ? null : t.id)}
                    style={{ width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer" }}
                  >
                    <span className="cah-case-id">{t.id}</span>
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
                  </button>

                  {/* Expanded detail row */}
                  {expanded === t.id && (
                    <div className="stf-expanded-row">
                      <div className="stf-expanded-grid">
                        <div>
                          <p className="stf-expanded-label">Description</p>
                          <p className="stf-expanded-text">{t.description}</p>
                        </div>
                        {t.platform_response && (
                          <div>
                            <p className="stf-expanded-label">Platform response</p>
                            <p className="stf-expanded-response">{t.platform_response}</p>
                            {t.assigned_to_name && (
                              <p className="stf-expanded-meta">Handled by: {t.assigned_to_name}</p>
                            )}
                          </div>
                        )}
                      </div>
                      {t.resolved_at && (
                        <p className="stf-expanded-meta">Resolved: {formatDate(t.resolved_at)}</p>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </article>
    </div>
  );
}
