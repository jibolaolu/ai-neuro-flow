"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { MyAssignmentItem } from "../lib/api-server";

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusChip(status: string): { label: string; cls: string } {
  const s = status.toLowerCase();
  if (s.includes("assessment booked") || s.includes("booked"))
    return { label: status, cls: "pt-chip pt-chip--booked" };
  if (s.includes("complete"))
    return { label: status, cls: "pt-chip pt-chip--complete" };
  if (s.includes("ready to schedule") || s === "forms returned")
    return { label: status, cls: "pt-chip pt-chip--ready" };
  if (s.includes("forms returned"))
    return { label: status, cls: "pt-chip pt-chip--forms-done" };
  if (s.includes("forms sent"))
    return { label: status, cls: "pt-chip pt-chip--forms-sent" };
  if (s === "new")
    return { label: status, cls: "pt-chip pt-chip--new" };
  return { label: status, cls: "pt-chip pt-chip--neutral" };
}

function pathwayChip(pathway: string | null): { label: string; cls: string } {
  if (!pathway) return { label: "—", cls: "pt-pathway-chip pt-pathway-chip--unknown" };
  const p = pathway.toLowerCase();
  if (p.includes("adhd") && p.includes("autis"))
    return { label: pathway, cls: "pt-pathway-chip pt-pathway-chip--combined" };
  if (p.includes("adhd"))
    return { label: pathway, cls: "pt-pathway-chip pt-pathway-chip--adhd" };
  if (p.includes("autis") || p.includes("asd"))
    return { label: pathway, cls: "pt-pathway-chip pt-pathway-chip--autism" };
  return { label: pathway, cls: "pt-pathway-chip pt-pathway-chip--other" };
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric", month: "short", year: "numeric",
    });
  } catch { return "—"; }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ClinicianPatientsTable({ rows }: { rows: MyAssignmentItem[] }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (r) =>
        r.full_name.toLowerCase().includes(s) ||
        (r.pathway ?? "").toLowerCase().includes(s) ||
        r.status.toLowerCase().includes(s) ||
        (r.stage ?? "").toLowerCase().includes(s) ||
        (r.assessment_id ?? "").toLowerCase().includes(s),
    );
  }, [rows, q]);

  const bookedCount = rows.filter((r) => r.confirmed_session_at).length;
  const pendingCount = rows.filter((r) => !r.confirmed_session_at && r.status !== "Complete").length;

  return (
    <div className="pt-shell">

      {/* ── Summary strip ─────────────────────────────────────────────────── */}
      <div className="pt-summary-strip">
        <div className="pt-summary-card">
          <strong className="pt-summary-value">{rows.length}</strong>
          <span className="pt-summary-label">Total patients</span>
        </div>
        <div className="pt-summary-card pt-summary-card--accent">
          <strong className="pt-summary-value">{bookedCount}</strong>
          <span className="pt-summary-label">Sessions booked</span>
        </div>
        <div className="pt-summary-card pt-summary-card--warn">
          <strong className="pt-summary-value">{pendingCount}</strong>
          <span className="pt-summary-label">Awaiting booking</span>
        </div>
      </div>

      {/* ── Search ────────────────────────────────────────────────────────── */}
      <div className="pt-search-row">
        <div className="clinical-search-field" style={{ flex: 1 }}>
          <label className="sr-only" htmlFor="pt-search">Search patients</label>
          <input
            id="pt-search"
            type="search"
            className="clinical-search-input"
            placeholder="Search by name, pathway, status, assessment ID…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <span className="clinical-search-icon" aria-hidden />
        </div>
        {q && (
          <span className="pt-search-count">
            {filtered.length} result{filtered.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      <article className="workspace-card pt-table-card">
        <div className="data-table-shell">
          <div className="data-table">

            {/* Head */}
            <div className="data-table-head pt-table-cols">
              <span>Patient</span>
              <span>Pathway</span>
              <span>Stage</span>
              <span>Session</span>
              <span>Status</span>
              <span />
            </div>

            {/* Empty */}
            {filtered.length === 0 ? (
              <div className="pt-empty-row">
                {q
                  ? `No patients match "${q}".`
                  : "No assigned patients yet. Clinical Admin can link you in the client overview."}
              </div>
            ) : (
              filtered.map((c) => {
                const sc = statusChip(c.status);
                const pc = pathwayChip(c.pathway);
                return (
                  <Link
                    key={c.client_id}
                    href={`/clinician/clients/${c.client_id}`}
                    className="data-table-row pt-table-cols pt-table-row"
                  >
                    {/* Name + ID */}
                    <span className="pt-name-cell">
                      <strong className="pt-name">{c.full_name}</strong>
                      {c.assessment_id && (
                        <small className="pt-id">{c.assessment_id}</small>
                      )}
                    </span>

                    {/* Pathway chip */}
                    <span>
                      <span className={pc.cls}>{pc.label}</span>
                    </span>

                    {/* Stage */}
                    <span className="pt-stage">{c.stage ?? "—"}</span>

                    {/* Session date */}
                    <span className="pt-session">
                      {c.confirmed_session_at
                        ? <strong style={{ color: "var(--brand)", fontSize: 12 }}>{formatDate(c.confirmed_session_at)}</strong>
                        : <span style={{ color: "var(--muted)", fontSize: 12 }}>Not booked</span>
                      }
                    </span>

                    {/* Status chip */}
                    <span>
                      <span className={sc.cls}>{sc.label}</span>
                    </span>

                    {/* Arrow */}
                    <span className="pt-arrow" aria-hidden>→</span>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </article>
    </div>
  );
}
