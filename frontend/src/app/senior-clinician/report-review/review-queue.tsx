"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { ClinicalReport } from "../../../lib/clinical-reports-api";
import { fetchPendingReports } from "../../../lib/clinical-reports-api";

export function ReviewQueue() {
  const [reports, setReports] = useState<ClinicalReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPendingReports()
      .then(setReports)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "var(--space-5) 0", color: "var(--muted)", fontSize: 14 }}>
        <span className="loading-spinner" />
        Loading pending reports…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "var(--space-4)", borderRadius: 8, background: "var(--danger-50)", color: "var(--danger)", fontSize: 14 }}>
        Could not load queue: {error}
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <p style={{ color: "var(--muted)", fontSize: 14 }}>
        No reports are currently awaiting sign-off. Check back after clinicians submit drafts for review.
      </p>
    );
  }

  return (
    <div className="report-card-list">
      {reports.map((r) => {
        const created = r.created_at
          ? new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
          : "-";
        const submitted = r.submitted_at
          ? new Date(r.submitted_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
          : null;
        const sections = r.sections as Record<string, string> ?? {};
        const filled = Object.values(sections).filter(Boolean).length;

        return (
          <article key={r.id} className="report-card mini-card">
            <div className="report-card-header">
              <div className="report-card-meta">
                <span className="report-card-id">{r.id}</span>
                <span className="inline-badge status-warn">Pending review</span>
              </div>
              <Link
                className="primary-action"
                href={`/clinician/clients/${r.client_id}?tab=reports`}
                style={{ fontSize: 13, padding: "6px 14px" }}
              >
                Open &amp; review
              </Link>
            </div>

            <div className="report-card-body">
              <strong className="report-card-type">{r.report_type}</strong>
              <p className="report-card-client">Client: {r.client_id}</p>
              {r.assessed_by && (
                <p className="report-card-assessed">Assessed by: {r.assessed_by}</p>
              )}
              {r.date_of_assessment && (
                <p className="report-card-date">Assessment date: {r.date_of_assessment}</p>
              )}
            </div>

            <div className="report-card-foot">
              <span>Created {created}</span>
              {submitted && (
                <>
                  <span aria-hidden>·</span>
                  <span>Submitted {submitted}</span>
                </>
              )}
              <span aria-hidden>·</span>
              <span>{filled} section{filled !== 1 ? "s" : ""} filled</span>
            </div>
          </article>
        );
      })}
    </div>
  );
}
