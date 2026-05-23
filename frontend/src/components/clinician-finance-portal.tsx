"use client";

import { useCallback, useEffect, useState } from "react";

import {
  createTimesheet,
  downloadInvoicePdf,
  fetchMyInvoices,
  fetchMyTimesheets,
  generateInvoice,
  type InvoiceGenerateResponse,
  type InvoiceSummary,
  type TimesheetLine,
} from "../lib/clinician-finance-api";

type TabKey = "timesheets" | "invoices" | "disbursements" | "submitted";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

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

/* ── SVG icons ───────────────────────────────────────────────────────────── */
function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="1" y="3" width="14" height="12" rx="2" />
      <path d="M1 7h14M5 1v4M11 1v4" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="8" cy="8" r="7" />
      <path d="M8 4v4l3 2" />
    </svg>
  );
}

function NoteIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 2h10v9l-3 3H3V2z" />
      <path d="M10 11v3M10 11h3M5 6h6M5 8.5h4" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="8" cy="5" r="3" />
      <path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6" />
    </svg>
  );
}

export function ClinicianFinancePortal({ initialTab }: { initialTab: TabKey }) {
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [timesheets, setTimesheets] = useState<TimesheetLine[]>([]);
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [activityDate, setActivityDate] = useState(isoDate(new Date()));
  const [hours, setHours] = useState("1");
  const [description, setDescription] = useState("");
  const [clientRef, setClientRef] = useState("");

  const [periodFrom, setPeriodFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return isoDate(d);
  });
  const [periodTo, setPeriodTo] = useState(isoDate(new Date()));
  const [invoiceNotes, setInvoiceNotes] = useState("");
  const [lastInvoice, setLastInvoice] = useState<InvoiceGenerateResponse | null>(null);
  const [pdfBusyId, setPdfBusyId] = useState<string | null>(null);

  const loadTs = useCallback(async () => {
    const items = await fetchMyTimesheets();
    setTimesheets(items);
  }, []);

  const loadInv = useCallback(async () => {
    const items = await fetchMyInvoices();
    setInvoices(items);
  }, []);

  useEffect(() => {
    setLoadErr(null);
    void Promise.all([loadTs(), loadInv()]).catch((e) =>
      setLoadErr(e instanceof Error ? e.message : "Could not load finance data"),
    );
  }, [loadTs, loadInv]);

  async function submitTimesheet(e: React.FormEvent) {
    e.preventDefault();
    const h = Number(hours);
    if (!description.trim() || Number.isNaN(h) || h <= 0) return;
    setSaving(true);
    setLoadErr(null);
    try {
      await createTimesheet({
        activity_date: activityDate,
        hours: h,
        description: description.trim(),
        client_ref: clientRef.trim() || null,
      });
      setDescription("");
      await loadTs();
    } catch (err) {
      setLoadErr(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function submitInvoice(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setLoadErr(null);
    try {
      const out = await generateInvoice({
        period_from: periodFrom,
        period_to: periodTo,
        notes: invoiceNotes.trim() || null,
      });
      setLastInvoice(out);
      setInvoiceNotes("");
      await loadInv();
    } catch (err) {
      setLoadErr(err instanceof Error ? err.message : "Could not generate invoice");
    } finally {
      setSaving(false);
    }
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: "timesheets", label: "Timesheets" },
    { key: "invoices", label: "Invoice generation" },
    { key: "disbursements", label: "Disbursements" },
    { key: "submitted", label: "Submitted" },
  ];

  return (
    <div>
      <section className="record-tab-row" role="tablist" aria-label="Finance sections">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            className={`record-tab button-reset ${tab === t.key ? "record-tab-active" : ""}`}
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </section>

      {loadErr ? (
        <p className="inline-badge status-warn" role="alert" style={{ marginTop: "1rem" }}>
          {loadErr}
        </p>
      ) : null}

      <div className="cfp-notice">
        <p>This section is <strong>only</strong> to be used by <strong>Self-Employed Clinicians</strong>.</p>
        <ul>
          <li>Invoices will be paid within 30 days of submission.</li>
          <li>Invoices must be submitted within 90 days of Activity Date.</li>
        </ul>
      </div>

      {tab === "timesheets" ? (
        <div className="cfp-form-card">
          <div className="cfp-form-card-header">
            <span className="panel-label">Submit activity</span>
            <h3>Timesheet entry</h3>
          </div>
          <div className="cfp-form-card-body">
            <form onSubmit={submitTimesheet}>

              {/* Single connected filter bar — all 4 fields */}
              <div className="cah-filter-bar" style={{ marginBottom: "1rem" }}>

                {/* Activity date */}
                <div className="cah-filter-field">
                  <label htmlFor="cfp-activity-date" className="cah-filter-label">
                    <CalendarIcon />
                    Activity date
                  </label>
                  <div className="cah-date-wrap">
                    <input
                      id="cfp-activity-date"
                      type="date"
                      className="cah-date-input"
                      value={activityDate}
                      onChange={(e) => setActivityDate(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="cah-filter-divider" aria-hidden />

                {/* Hours */}
                <div className="cah-filter-field" style={{ maxWidth: 120 }}>
                  <label htmlFor="cfp-hours" className="cah-filter-label">
                    <ClockIcon />
                    Hours
                  </label>
                  <input
                    id="cfp-hours"
                    type="number"
                    min={0.25}
                    max={24}
                    step={0.25}
                    className="cah-date-input"
                    style={{ width: "80px" }}
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                    required
                    placeholder="e.g. 2"
                  />
                </div>

                <div className="cah-filter-divider" aria-hidden />

                {/* Description */}
                <div className="cah-filter-field" style={{ flex: 2 }}>
                  <label htmlFor="cfp-desc" className="cah-filter-label">
                    <NoteIcon />
                    Description
                  </label>
                  <input
                    id="cfp-desc"
                    type="text"
                    className="cah-date-input"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                    placeholder="Describe the clinical activity…"
                  />
                </div>

                <div className="cah-filter-divider" aria-hidden />

                {/* Client / case ref */}
                <div className="cah-filter-field">
                  <label htmlFor="cfp-client-ref" className="cah-filter-label">
                    <PersonIcon />
                    Case ref
                    <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, fontSize: "0.65rem", color: "var(--muted)", marginLeft: 3 }}>(opt.)</span>
                  </label>
                  <input
                    id="cfp-client-ref"
                    type="text"
                    className="cah-date-input"
                    value={clientRef}
                    onChange={(e) => setClientRef(e.target.value)}
                    placeholder="e.g. ASS-XXXXXXXX"
                  />
                </div>

              </div>

              <div className="cfp-submit-row">
                <button type="submit" className="primary-action button-reset" disabled={saving}>
                  {saving ? "Saving…" : "Submit timesheet"}
                </button>
                <span className="cfp-submit-hint">Saved entries appear in the table below.</span>
              </div>
            </form>
          </div>

          {/* Submissions table */}
          <div style={{ padding: "0 1.25rem 1.25rem" }}>
            <h4 style={{ margin: "0 0 0.6rem", fontSize: "0.9rem", fontWeight: 700, color: "var(--ink)" }}>Your submissions</h4>
            <div className="data-table-shell">
              <div className="data-table">
                <div className="data-table-head" style={{ gridTemplateColumns: "110px 70px 1fr 130px" }}>
                  <span>Date</span>
                  <span>Hrs</span>
                  <span>Description</span>
                  <span>Case ref</span>
                </div>
                {timesheets.length === 0 ? (
                  <div className="data-table-row" style={{ padding: "1.25rem", color: "var(--muted)", gridColumn: "1/-1" }}>
                    No timesheet lines yet.
                  </div>
                ) : (
                  timesheets.map((r) => (
                    <div key={r.id} className="data-table-row" style={{ gridTemplateColumns: "110px 70px 1fr 130px" }}>
                      <span style={{ fontSize: 13 }}>{displayDate(r.activity_date) || r.activity_date}</span>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{r.hours}</span>
                      <span style={{ fontSize: 13 }}>{r.description}</span>
                      <span style={{ fontSize: 12, color: "var(--muted)", fontFamily: "monospace" }}>{r.client_ref ?? "—"}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {tab === "invoices" ? (
        <div className="cfp-form-card">
          <div className="cfp-form-card-header">
            <span className="panel-label">Aggregate timesheets</span>
            <h3>Generate invoice summary</h3>
            <p style={{ margin: "0.35rem 0 0", color: "var(--muted)", fontSize: "0.85rem" }}>
              Creates a stored invoice request from your <strong>submitted</strong> timesheet lines in the selected date range.
            </p>
          </div>
          <div className="cfp-form-card-body">
            <form onSubmit={submitInvoice}>

              {/* Single connected date-range bar — same pattern as appointments */}
              <div className="cah-filter-bar" style={{ marginBottom: "1rem" }}>

                <div className="cah-filter-field">
                  <label htmlFor="cfp-period-from" className="cah-filter-label">
                    <CalendarIcon />
                    Period from
                  </label>
                  <div className="cah-date-wrap">
                    <input
                      id="cfp-period-from"
                      type="date"
                      className="cah-date-input"
                      value={periodFrom}
                      onChange={(e) => setPeriodFrom(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <span className="cah-date-range-sep" aria-hidden>→</span>

                <div className="cah-filter-field">
                  <label htmlFor="cfp-period-to" className="cah-filter-label">
                    <CalendarIcon />
                    Period to
                  </label>
                  <div className="cah-date-wrap">
                    <input
                      id="cfp-period-to"
                      type="date"
                      className="cah-date-input"
                      value={periodTo}
                      onChange={(e) => setPeriodTo(e.target.value)}
                      required
                    />
                  </div>
                </div>

              </div>

              {/* Notes */}
              <div style={{ marginBottom: "0.75rem" }}>
                <div className="cfp-textarea-label">
                  <NoteIcon />
                  Notes
                  <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, fontSize: "0.68rem", color: "var(--muted)", marginLeft: 4 }}>(optional)</span>
                </div>
                <textarea
                  className="cfp-textarea"
                  rows={3}
                  value={invoiceNotes}
                  onChange={(e) => setInvoiceNotes(e.target.value)}
                  placeholder="Any notes to include with this invoice request…"
                />
              </div>

              <div className="cfp-submit-row">
                <button type="submit" className="primary-action button-reset" disabled={saving}>
                  {saving ? "Generating…" : "Generate invoice record"}
                </button>
              </div>
            </form>
          </div>

          {/* Result callout */}
          <div style={{ padding: "0 1.25rem 1.25rem" }}>
            {lastInvoice ? (
              <div className="detail-callout" style={{ borderColor: "var(--success-100)", background: "var(--success-50)" }}>
                <strong>Submitted for review</strong>
                <p style={{ margin: "8px 0 0", color: "var(--ink)" }}>
                  Invoice ref <code>{lastInvoice.id.slice(0, 8)}…</code> — {lastInvoice.line_count} lines,{" "}
                  <strong>{lastInvoice.total_hours.toFixed(2)}</strong> hrs ({lastInvoice.period_from} → {lastInvoice.period_to}). Status:{" "}
                  <strong>{lastInvoice.approval_status}</strong>. Clinical Admin will approve or request changes.
                </p>
              </div>
            ) : (
              <div className="detail-callout" style={{ borderColor: "var(--card-border)", background: "var(--muted-50)" }}>
                <strong>No clinician activity records</strong>
                <p style={{ margin: "8px 0 0", color: "var(--muted)" }}>
                  Add timesheet lines first, then generate an invoice for the same period.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {tab === "disbursements" ? (
        <div className="cfp-form-card">
          <div className="cfp-form-card-header">
            <span className="panel-label">Payments</span>
            <h3>Disbursements</h3>
          </div>
          <div className="cfp-form-card-body">
            <p style={{ color: "var(--muted)", margin: 0, lineHeight: 1.65, fontSize: "0.9rem" }}>
              After Clinical Admin <strong>approves</strong> your invoice request, finance runs disbursement on their
              schedule — typically paid within 30 days of a valid submission. Line-level payment detail and BACS
              references will appear here when that integration is enabled.
            </p>
          </div>
        </div>
      ) : null}

      {tab === "submitted" ? (
        <div className="cfp-form-card">
          <div className="cfp-form-card-header">
            <span className="panel-label">History</span>
            <h3>Submitted invoice requests</h3>
          </div>
          <div className="data-table-shell" style={{ overflowX: "auto" }}>
            <div className="data-table" style={{ minWidth: 720 }}>
              <div
                className="data-table-head"
                style={{ gridTemplateColumns: "minmax(150px,1.3fr) 130px 110px 52px 60px 90px minmax(120px,1fr)" }}
              >
                <span>Period</span>
                <span>Created</span>
                <span>Approval</span>
                <span>Lines</span>
                <span>Hrs</span>
                <span>PDF</span>
                <span>Admin notes</span>
              </div>
              {invoices.length === 0 ? (
                <div className="data-table-row" style={{ padding: "1.25rem", color: "var(--muted)", gridColumn: "1/-1" }}>
                  No generated invoices yet.
                </div>
              ) : (
                invoices.map((inv) => (
                  <div
                    key={inv.id}
                    className="data-table-row"
                    style={{
                      gridTemplateColumns: "minmax(150px,1.3fr) 130px 110px 52px 60px 90px minmax(120px,1fr)",
                      alignItems: "center",
                    }}
                  >
                    <span style={{ fontSize: 13 }}>
                      <strong>{displayDate(inv.period_from) || inv.period_from}</strong>
                      <span style={{ color: "var(--muted)", margin: "0 4px" }}>→</span>
                      {displayDate(inv.period_to) || inv.period_to}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>
                      {new Date(inv.created_at).toLocaleDateString("en-GB")}
                    </span>
                    <span>
                      <span
                        className={`status-chip ${
                          inv.approval_status === "approved"
                            ? "chip-green"
                            : inv.approval_status === "pending"
                              ? "chip-neutral"
                              : "chip-purple"
                        }`}
                      >
                        {inv.approval_status}
                      </span>
                    </span>
                    <span style={{ fontSize: 13 }}>{inv.line_count ?? "—"}</span>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>
                      {inv.total_hours != null ? inv.total_hours.toFixed(2) : "—"}
                    </span>
                    <span>
                      <button
                        type="button"
                        className="ghost-chip button-reset"
                        style={{ fontSize: 12 }}
                        disabled={pdfBusyId === inv.id}
                        onClick={() => {
                          setPdfBusyId(inv.id);
                          void downloadInvoicePdf(inv.id)
                            .catch((e) => setLoadErr(e instanceof Error ? e.message : "PDF failed"))
                            .finally(() => setPdfBusyId(null));
                        }}
                      >
                        {pdfBusyId === inv.id ? "…" : "PDF ↓"}
                      </button>
                    </span>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>
                      {inv.review_notes ?? "—"}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
