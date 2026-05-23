"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { MyAssignmentItem } from "../lib/api-server";

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "-";
  }
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function statusChipClass(status: string): string {
  const s = status.toLowerCase();
  if (s.includes("assessment booked") || s.includes("scheduled")) return "chip-purple";
  if (s.includes("complete")) return "chip-green";
  if (s.includes("forms returned")) return "chip-teal";
  if (s.includes("forms sent")) return "chip-blue";
  if (s.includes("new")) return "chip-neutral";
  return "chip-neutral";
}

export function ClinicalDashboardHome({
  userName,
  assignments,
  appointmentsHref,
  isSenior = false,
  basePath = "/clinician",
}: {
  userName: string;
  assignments: MyAssignmentItem[];
  appointmentsHref: string;
  isSenior?: boolean;
  basePath?: string;
}) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return assignments.slice(0, 12);
    return assignments.filter(
      (row) =>
        row.full_name.toLowerCase().includes(s) ||
        (row.pathway ?? "").toLowerCase().includes(s) ||
        row.status.toLowerCase().includes(s) ||
        (row.assessment_id ?? "").toLowerCase().includes(s),
    );
  }, [assignments, q]);

  const upcomingCount   = assignments.filter((a) => a.confirmed_session_at).length;
  const reportDueCount  = assignments.filter((a) => a.report_due_at).length;

  const todayStr = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="clinical-portal-dashboard">

      {/* ── Welcome banner ─────────────────────────────────────────────────── */}
      <header className="clinician-welcome-banner">
        <div className="clinician-welcome-left">
          <p className="clinician-welcome-greeting">{getGreeting()}</p>
          <h1 className="clinician-welcome-name">{userName || "Clinician"}</h1>
          <p className="clinician-welcome-sub">
            Here&apos;s your clinical workspace for today, {todayStr}.
          </p>
          {isSenior && (
            <span className="clinician-welcome-role-badge">Senior Clinician</span>
          )}
        </div>

        <div className="clinician-welcome-chips">
          <div className="clinician-stat-chip">
            <span className="clinician-stat-chip-value">{assignments.length}</span>
            <span className="clinician-stat-chip-label">Assigned cases</span>
          </div>
          <div className="clinician-stat-chip clinician-stat-chip--accent">
            <span className="clinician-stat-chip-value">{upcomingCount}</span>
            <span className="clinician-stat-chip-label">Booked sessions</span>
          </div>
          {reportDueCount > 0 && (
            <div className="clinician-stat-chip clinician-stat-chip--warn">
              <span className="clinician-stat-chip-value">{reportDueCount}</span>
              <span className="clinician-stat-chip-label">Reports due</span>
            </div>
          )}
        </div>
      </header>

      {/* ── Quick actions ──────────────────────────────────────────────────── */}
      <div className="clinician-quick-actions">
        <Link className="clinician-quick-btn" href={`${basePath}/clients`}>
          <span className="clinician-quick-icon" aria-hidden>👥</span>
          <span>My patients</span>
        </Link>
        <Link className="clinician-quick-btn" href={`${basePath}/reports`}>
          <span className="clinician-quick-icon" aria-hidden>📋</span>
          <span>Reports</span>
        </Link>
        <Link className="clinician-quick-btn" href={`${basePath}/availability`}>
          <span className="clinician-quick-icon" aria-hidden>📅</span>
          <span>My availability</span>
        </Link>
        {isSenior && (
          <Link
            className="clinician-quick-btn clinician-quick-btn--highlight"
            href="/senior-clinician/report-review"
          >
            <span className="clinician-quick-icon" aria-hidden>✅</span>
            <span>Sign-off queue</span>
          </Link>
        )}
      </div>

      {/* ── Search ─────────────────────────────────────────────────────────── */}
      <div className="clinical-search-field">
        <label className="sr-only" htmlFor="clinical-dash-search">
          Search appointments and patients
        </label>
        <input
          id="clinical-dash-search"
          type="search"
          className="clinical-search-input"
          placeholder="Search by patient name, pathway, status…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {/* ── Cases table ────────────────────────────────────────────────────── */}
      <article className="workspace-card clinical-upcoming-card">
        <div className="workspace-card-header">
          <div>
            <span className="panel-label">Upcoming</span>
            <h2>Your next appointments &amp; cases</h2>
          </div>
          <Link className="ghost-chip" href={appointmentsHref}>
            View all
          </Link>
        </div>
        <div className="data-table-shell">
          <div className="data-table">
            <div
              className="data-table-head"
              style={{
                gridTemplateColumns:
                  "minmax(120px, 1fr) minmax(130px, 1.1fr) minmax(140px, 1.2fr) minmax(120px, 1fr) minmax(110px, 0.9fr) 72px",
              }}
            >
              <span>Session date</span>
              <span>Patient</span>
              <span>Pathway</span>
              <span>Report due</span>
              <span>Status</span>
              <span />
            </div>
            {filtered.length === 0 ? (
              <div
                className="data-table-row"
                style={{ padding: "1.75rem", color: "var(--muted)", gridColumn: "1/-1" }}
              >
                {q
                  ? "No cases match your search."
                  : "No assigned cases yet. When Clinical Admin allocates patients to you, they will appear here."}
              </div>
            ) : (
              filtered.map((row) => (
                <div
                  className="data-table-row clinical-dash-row"
                  key={row.client_id}
                  style={{
                    gridTemplateColumns:
                      "minmax(120px, 1fr) minmax(130px, 1.1fr) minmax(140px, 1.2fr) minmax(120px, 1fr) minmax(110px, 0.9fr) 72px",
                  }}
                >
                  <span style={{ fontSize: 13 }}>
                    {row.confirmed_session_at ? (
                      <strong style={{ color: "var(--brand)" }}>
                        {formatDate(row.confirmed_session_at)}
                      </strong>
                    ) : (
                      <span style={{ color: "var(--muted)" }}>Not booked</span>
                    )}
                  </span>
                  <span>
                    <strong style={{ fontSize: 13 }}>{row.full_name}</strong>
                    {row.assessment_id && (
                      <small
                        style={{
                          display: "block",
                          color: "var(--muted)",
                          fontSize: 11,
                          fontFamily: "monospace",
                        }}
                      >
                        {row.assessment_id}
                      </small>
                    )}
                  </span>
                  <span style={{ fontSize: 13 }}>{row.pathway ?? "-"}</span>
                  <span style={{ fontSize: 13 }}>
                    {row.report_due_at ? (
                      <span style={{ color: "var(--warning)", fontWeight: 600 }}>
                        {formatDate(row.report_due_at)}
                      </span>
                    ) : (
                      <span style={{ color: "var(--muted)" }}>—</span>
                    )}
                  </span>
                  <span>
                    <span className={`status-chip ${statusChipClass(row.status)}`}>
                      {row.status}
                    </span>
                  </span>
                  <span>
                    <Link
                      className="clinical-details-link"
                      href={`/clinician/clients/${row.client_id}`}
                    >
                      Open →
                    </Link>
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </article>

      {/* ── Senior sign-off card (only for senior-clinician) ───────────────── */}
      {isSenior && (
        <article className="workspace-card clinical-oversight-card">
          <div className="workspace-card-header">
            <div>
              <span className="panel-label">Senior oversight</span>
              <h2>Quality &amp; sign-off</h2>
            </div>
            <Link className="ghost-chip" href="/senior-clinician/report-review">
              Sign-off queue
            </Link>
          </div>
          <p className="clinical-oversight-lead">
            Pending reviews and workflow stages also surface under{" "}
            <Link href="/senior-clinician/reports">Reports</Link>. Use the sign-off
            queue for cases that must not be self-approved.
          </p>
        </article>
      )}
    </div>
  );
}
