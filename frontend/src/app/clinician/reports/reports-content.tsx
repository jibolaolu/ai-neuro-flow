"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { ClinicalReport, ReportStatus } from "../../../lib/clinical-reports-api";
import { fetchMyReports, fetchPendingReports } from "../../../lib/clinical-reports-api";

// ── Types ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "drafts", label: "Drafts" },
  { id: "pending", label: "Pending review" },
  { id: "complete", label: "Complete" },
  { id: "issued", label: "Issued" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const TAB_STATUS: Record<TabId, ReportStatus | undefined> = {
  drafts: "draft",
  pending: "pending",
  complete: "complete",
  issued: "issued",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusBadgeClass(status: ReportStatus): string {
  switch (status) {
    case "draft":    return "status-neutral";
    case "pending":  return "status-warn";
    case "complete": return "status-good";
    case "issued":   return "status-done";
    default:         return "status-neutral";
  }
}

function statusLabel(status: ReportStatus): string {
  switch (status) {
    case "draft":    return "Draft";
    case "pending":  return "Pending review";
    case "complete": return "Complete";
    case "issued":   return "Issued";
    default:         return status;
  }
}

// ── Report card ───────────────────────────────────────────────────────────────

function ReportCard({ report, isSenior }: { report: ClinicalReport; isSenior: boolean }) {
  const created = report.created_at
    ? new Date(report.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : "-";
  const updated = report.updated_at
    ? new Date(report.updated_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : "-";
  const sections = report.sections as Record<string, string> ?? {};
  const sectionCount = Object.values(sections).filter(Boolean).length;

  return (
    <article className="report-card mini-card">
      <div className="report-card-header">
        <div className="report-card-meta">
          <span className="report-card-id">{report.id}</span>
          <span className={`inline-badge ${statusBadgeClass(report.status)}`}>{statusLabel(report.status)}</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {/* Senior can open pending reports directly in their review queue */}
          {isSenior && report.status === "pending" ? (
            <Link
              className="ghost-chip"
              href={`/senior-clinician/report-review?report=${report.id}`}
              aria-label="Review report"
            >
              Review
            </Link>
          ) : null}
          <Link
            className="ghost-chip"
            href={`/clinician/clients/${report.client_id}?tab=reports`}
            aria-label="Open client record"
          >
            Open client
          </Link>
        </div>
      </div>

      <div className="report-card-body">
        <strong className="report-card-type">{report.report_type}</strong>
        <p className="report-card-client">Client: {report.client_id}</p>
        {report.assessed_by && (
          <p className="report-card-assessed">Assessed by: {report.assessed_by}</p>
        )}
        {report.date_of_assessment && (
          <p className="report-card-date">Assessment date: {report.date_of_assessment}</p>
        )}
      </div>

      <div className="report-card-foot">
        <span>Created {created}</span>
        <span aria-hidden>·</span>
        <span>Updated {updated}</span>
        <span aria-hidden>·</span>
        <span>{sectionCount} section{sectionCount !== 1 ? "s" : ""} filled</span>
        {report.submitted_at && (
          <>
            <span aria-hidden>·</span>
            <span>Submitted {new Date(report.submitted_at).toLocaleDateString("en-GB")}</span>
          </>
        )}
        {report.issued_at && (
          <>
            <span aria-hidden>·</span>
            <span>Issued {new Date(report.issued_at).toLocaleDateString("en-GB")}</span>
          </>
        )}
      </div>

      {report.review_comment && (
        <div className="report-card-comment">
          <span className="report-card-comment-label">Reviewer note: </span>
          <span>{report.review_comment}</span>
        </div>
      )}

      {report.reviewed_by_name && (
        <div className="report-card-reviewer">
          <span>Reviewed by {report.reviewed_by_name}</span>
          {report.reviewed_at && (
            <span> on {new Date(report.reviewed_at).toLocaleDateString("en-GB")}</span>
          )}
        </div>
      )}
    </article>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ReportsContent({ isSeniorClinician }: { isSeniorClinician: boolean }) {
  const [activeTab, setActiveTab] = useState<TabId>("drafts");
  const [reports, setReports] = useState<ClinicalReport[]>([]);
  const [pendingQueue, setPendingQueue] = useState<ClinicalReport[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const status = TAB_STATUS[activeTab];

    // For the pending tab and senior clinician, fetch the review queue instead
    const mainFetch =
      activeTab === "pending" && isSeniorClinician
        ? fetchPendingReports()
        : fetchMyReports(status);

    const promises: Promise<void>[] = [
      mainFetch
        .then((data) => setReports(data))
        .catch(() => setReports([])),
    ];

    // Also keep the pending count fresh for the banner
    if (isSeniorClinician) {
      promises.push(
        fetchPendingReports()
          .then((data) => setPendingQueue(data))
          .catch(() => setPendingQueue([])),
      );
    }

    Promise.all(promises).finally(() => setLoading(false));
  }, [activeTab, isSeniorClinician]);

  return (
    <>
      {/* Tab navigation — flush to top */}
      <div className="reports-tab-row" role="tablist" aria-label="Report stages">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={activeTab === t.id}
            className={`reports-tab ${activeTab === t.id ? "reports-tab-active" : ""}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
            {t.id === "pending" && isSeniorClinician && pendingQueue.length > 0 && (
              <span className="reports-tab-badge">{pendingQueue.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Senior review queue banner */}
      {isSeniorClinician && pendingQueue.length > 0 && (
        <article
          className="mini-card"
          style={{ marginBottom: "1rem", borderColor: "var(--brand-300)", background: "var(--brand-50)" }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <strong>Senior review queue</strong>
              <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 14 }}>
                {pendingQueue.length} report{pendingQueue.length !== 1 ? "s" : ""} awaiting your sign-off.
                You cannot approve reports you authored.
              </p>
            </div>
            <Link className="primary-action" href="/senior-clinician/report-review" style={{ whiteSpace: "nowrap" }}>
              Open sign-off queue
            </Link>
          </div>
        </article>
      )}

      {/* Content */}
      {loading ? (
        <div className="report-list-loading" aria-busy="true">
          <span className="loading-spinner" aria-label="Loading reports…" />
          <span style={{ color: "var(--muted)", fontSize: 14 }}>Loading reports…</span>
        </div>
      ) : reports.length === 0 ? (
        <article className="workspace-card clinical-report-placeholder">
          <div className="clinical-report-banner">
            <span className="clinical-report-banner-icon" aria-hidden />
            <p>
              {activeTab === "drafts" &&
                "You have no draft reports yet. Open a client record and go to the Reports tab to begin."}
              {activeTab === "pending" &&
                (isSeniorClinician
                  ? "No reports are currently awaiting your sign-off."
                  : "None of your reports are pending review right now.")}
              {activeTab === "complete" &&
                "No approved reports yet. Once a senior clinician signs off, they will appear here."}
              {activeTab === "issued" &&
                "No reports have been issued to clients yet. Complete reports can be issued from the client's Reports tab."}
            </p>
          </div>
        </article>
      ) : (
        <div className="report-card-list">
          {reports.map((r) => (
            <ReportCard key={r.id} report={r} isSenior={isSeniorClinician} />
          ))}
        </div>
      )}
    </>
  );
}
