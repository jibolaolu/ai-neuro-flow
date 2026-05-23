"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { MyAssignmentItem } from "../lib/api-server";
import { browserApiUrl } from "../lib/get-api-base";

/* ── Helpers ────────────────────────────────────────────────────────────── */

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "-";
  }
}

/** Format a yyyy-mm-dd date string for display */
function displayDate(val: string): string {
  if (!val) return "";
  try {
    return new Date(val).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return val;
  }
}

function filterByWorkflowTab(
  rows: MyAssignmentItem[],
  tab: "upcoming" | "pending" | "history",
): MyAssignmentItem[] {
  return rows.filter((r) => {
    const st = r.status.toLowerCase();
    const isDone = /complete|closed|cancel|released/i.test(st);
    if (tab === "history") return isDone;
    if (tab === "pending")
      return /pending|forms|new\b|intake|awaiting|schedule|ready/i.test(st) && !isDone;
    return !isDone;
  });
}

function statusChipClass(status: string): string {
  const s = status.toLowerCase();
  if (s.includes("booked") || s.includes("scheduled")) return "chip-purple";
  if (s.includes("complete")) return "chip-green";
  if (s.includes("forms returned") || s.includes("ready")) return "chip-teal";
  if (s.includes("forms sent")) return "chip-blue";
  if (s.includes("new")) return "chip-neutral";
  if (s.includes("cancel") || s.includes("closed")) return "chip-neutral";
  return "chip-neutral";
}

/* ── Status options ─────────────────────────────────────────────────────── */
const STATUS_OPTIONS = [
  { value: "",                              label: "All statuses" },
  { value: "New",                           label: "New" },
  { value: "Forms Sent",                    label: "Forms sent" },
  { value: "Forms Returned",                label: "Forms returned" },
  { value: "Forms Returned, Ready to Schedule", label: "Ready to schedule" },
  { value: "Assessment Booked",             label: "Assessment booked" },
  { value: "In Progress",                   label: "In progress" },
  { value: "Complete",                      label: "Complete" },
  { value: "Cancelled",                     label: "Cancelled" },
];

/* ── SVG icons ──────────────────────────────────────────────────────────── */
function CalendarIcon() {
  return (
    <svg
      width="15" height="15" viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden
    >
      <rect x="1" y="3" width="14" height="12" rx="2" />
      <path d="M1 7h14M5 1v4M11 1v4" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg
      width="13" height="13" viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg
      width="14" height="14" viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2 4h12M4 8h8M6 12h4" />
    </svg>
  );
}

/* ── Main component ─────────────────────────────────────────────────────── */
export function ClinicianAssessmentsHub({
  workflowTab = "upcoming",
}: {
  workflowTab?: "upcoming" | "pending" | "history";
}) {
  const [rows, setRows]           = useState<MyAssignmentItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusQ, setStatusQ]     = useState("");
  const [fromDate, setFromDate]   = useState("");
  const [toDate, setToDate]       = useState("");

  const hasActiveFilters = statusQ !== "" || fromDate !== "" || toDate !== "";

  const clearFilters = () => {
    setStatusQ("");
    setFromDate("");
    setToDate("");
  };

  const load = useCallback(async () => {
    try {
      setLoadError(null);
      const params = new URLSearchParams();
      if (statusQ.trim()) params.set("status", statusQ.trim());
      if (fromDate) params.set("date_from", fromDate);
      if (toDate)   params.set("date_to", toDate);
      const q = params.toString();
      const r = await fetch(
        browserApiUrl(`/api/v1/assignments/mine${q ? `?${q}` : ""}`),
        { credentials: "include" },
      );
      if (!r.ok) {
        if (r.status === 401) { setLoadError("Not signed in or session expired."); return; }
        throw new Error("Could not load assignments");
      }
      const d = (await r.json()) as { items: MyAssignmentItem[] };
      setRows(d.items ?? []);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Load failed");
    }
  }, [fromDate, statusQ, toDate]);

  useEffect(() => { void load(); }, [load]);

  const displayRows = useMemo(
    () => filterByWorkflowTab(rows, workflowTab),
    [rows, workflowTab],
  );

  const done   = useMemo(() => rows.filter((c) => /complete|closed|released/i.test(c.status)).length, [rows]);
  const active = rows.length - done;

  return (
    <div className="calendar-layout">

      {loadError && (
        <p className="inline-badge status-warn" role="alert">{loadError}</p>
      )}

      {/* ── Metric strip ── */}
      <div className="metrics-strip admin-control-metrics">
        <article className="snapshot-card">
          <span>Assigned to you</span>
          <strong>{rows.length}</strong>
          <small className="metric-status-neutral">Live data</small>
        </article>
        <article className="snapshot-card">
          <span>In progress</span>
          <strong>{active}</strong>
          <small className="metric-status-warn">Active cases</small>
        </article>
        <article className="snapshot-card">
          <span>Completed / closed</span>
          <strong>{done}</strong>
          <small className="metric-status-good">Resolved</small>
        </article>
      </div>

      {/* ── Filter + table card ── */}
      <article className="workspace-card admin-portfolio-card">

        {/* Card header */}
        <div className="workspace-card-header">
          <div>
            <span className="panel-label">Appointments &amp; caseload</span>
            <h2>Search &amp; filter cases</h2>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              className="cah-clear-btn"
              onClick={clearFilters}
            >
              Clear filters
            </button>
          )}
        </div>

        {/* ── Filter bar ── */}
        <div className="cah-filter-bar">

          {/* Status select */}
          <div className="cah-filter-field cah-filter-field--select">
            <label htmlFor="cah-status" className="cah-filter-label">
              <FilterIcon />
              Case status
            </label>
            <div className="cah-select-wrap">
              <select
                id="cah-status"
                className="cah-select"
                value={statusQ}
                onChange={(e) => setStatusQ(e.target.value)}
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <span className="cah-select-icon"><ChevronIcon /></span>
            </div>
          </div>

          {/* Date divider */}
          <div className="cah-filter-divider" aria-hidden />

          {/* Registered from */}
          <div className="cah-filter-field">
            <label htmlFor="cah-from" className="cah-filter-label">
              <CalendarIcon />
              Registered from
            </label>
            <div className="cah-date-wrap">
              <input
                id="cah-from"
                type="date"
                className="cah-date-input"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
              {fromDate && (
                <span className="cah-date-display">{displayDate(fromDate)}</span>
              )}
            </div>
          </div>

          {/* Dash between dates */}
          <span className="cah-date-range-sep" aria-hidden>→</span>

          {/* Registered to */}
          <div className="cah-filter-field">
            <label htmlFor="cah-to" className="cah-filter-label">
              <CalendarIcon />
              Registered to
            </label>
            <div className="cah-date-wrap">
              <input
                id="cah-to"
                type="date"
                className="cah-date-input"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
              {toDate && (
                <span className="cah-date-display">{displayDate(toDate)}</span>
              )}
            </div>
          </div>
        </div>

        {/* Active filter chips */}
        {hasActiveFilters && (
          <div className="cah-active-chips">
            <span className="cah-active-label">Active filters:</span>
            {statusQ && (
              <span className="cah-chip">
                Status: <strong>{STATUS_OPTIONS.find((o) => o.value === statusQ)?.label ?? statusQ}</strong>
                <button type="button" onClick={() => setStatusQ("")} aria-label="Remove status filter">×</button>
              </span>
            )}
            {fromDate && (
              <span className="cah-chip">
                From: <strong>{displayDate(fromDate)}</strong>
                <button type="button" onClick={() => setFromDate("")} aria-label="Remove from date filter">×</button>
              </span>
            )}
            {toDate && (
              <span className="cah-chip">
                To: <strong>{displayDate(toDate)}</strong>
                <button type="button" onClick={() => setToDate("")} aria-label="Remove to date filter">×</button>
              </span>
            )}
          </div>
        )}

        <p className="cah-hint">
          Date filters use each client's first recorded registration in Neuro Flow (UTC). Results update automatically.
        </p>

        {/* ── Cases table ── */}
        <div className="data-table-shell">
          <div className="data-table">
            <div className="data-table-head admin-case-table">
              <span>Case</span>
              <span>Client</span>
              <span>Pathway</span>
              <span>Status</span>
              <span>Session / due</span>
            </div>

            {displayRows.length === 0 ? (
              <div className="cah-empty-state">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                </svg>
                <p>No cases match your current filters.</p>
                {hasActiveFilters && (
                  <button type="button" className="cah-clear-btn" onClick={clearFilters}>
                    Clear all filters
                  </button>
                )}
              </div>
            ) : (
              displayRows.map((c) => (
                <Link
                  className="data-table-row admin-case-table data-table-link-row"
                  href={`/clinician/clients/${c.client_id}`}
                  key={c.client_id}
                >
                  <span className="cah-case-id">{c.assessment_id ?? c.client_id}</span>
                  <span className="cah-client-name">{c.full_name}</span>
                  <span>{c.pathway ?? "—"}</span>
                  <span>
                    <span className={`status-chip ${statusChipClass(c.status)}`}>
                      {c.status}
                    </span>
                  </span>
                  <span className="cah-session-col">
                    {c.confirmed_session_at
                      ? <strong>{formatDate(c.confirmed_session_at)}</strong>
                      : <span className="cah-tbc">TBC</span>
                    }
                    {c.report_due_at && (
                      <small className="cah-due">due {formatDate(c.report_due_at)}</small>
                    )}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>
      </article>
    </div>
  );
}
