"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { browserApiUrl } from "../lib/get-api-base";
import { FormResponseModal } from "./form-response-modal";

/* ── Types - matched exactly to backend scoring.py output ──────────────── */

interface AsrsScores {
  part_a: number;
  part_a_max: number;
  part_b: number;
  part_b_max: number;
  total: number;
  total_max: number;
  screen_positive: boolean;
  screen_count: number;
  result: string;
  inattention_score: number;
  inattention_max: number;
  hi_score: number;
  hi_max: number;
  presentation: string;
  likelihood: string;
}

interface SimpleScores {
  total: number;
  total_max: number;
  severity: string;
}

interface Phq9Scores extends SimpleScores {
  suicidal_ideation_flag: boolean;
}

interface WfirsDomain {
  domain: string;
  total: number;
  items_answered: number;
  items_total: number;
  mean: number;
  elevated_count: number;
}

interface WfirsScores {
  domains: WfirsDomain[];
  overall_mean: number;
  elevated_items: number;   // count, not list
  total_items_answered: number;
  impairment_level: string;
}

interface SdqScores {
  version: string;
  emotional_symptoms: number;
  conduct_problems: number;
  hyperactivity_inattention: number;
  peer_problems: number;
  prosocial: number;
  total_difficulties: number;
  total_max: number;
  emotional_band: string;
  conduct_band: string;
  hyperact_band: string;
  peer_band: string;
  prosocial_band: string;
  total_band: string;
}

interface ConnersScores {
  cognitive_inattention: number;
  cognitive_inattention_max: number;
  hyperactivity: number;
  hyperactivity_max: number;
  oppositional: number;
  oppositional_max: number;
  total: number;
  total_max: number;
  severity: string;
}

interface Scores {
  asrs?: AsrsScores;
  phq9?: Phq9Scores;
  gad7?: SimpleScores;
  wfirs?: WfirsScores;
  sdq?: SdqScores;
  cprs?: ConnersScores;
  ctrs?: ConnersScores;
}

interface DiagnosticImpression {
  likelihood: string;
  presentation: string;
  reasoning: string;
}

interface AiReport {
  diagnostic_impression: DiagnosticImpression | null;
  clinical_summary: string | null;
  recommendations: string[];
  flags: string[];
  generated_at: string;
  model?: string;
  error?: string;           // populated when AI generation failed
  scores_snapshot?: Scores;
}

interface ApiResponse {
  available: boolean;
  report?: AiReport;
  scores?: Scores;
}

interface FormSummary {
  id: string;
  form_label: string;
  form_type: string;
  status: string;
}

// ── View Forms dropdown ──────────────────────────────────────────────────────

function ViewFormsButton({ clientId }: { clientId: string }) {
  const [forms, setForms] = useState<FormSummary[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [modalFormId, setModalFormId] = useState<string | null>(null);
  const [modalFormLabel, setModalFormLabel] = useState<string>("");
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadForms() {
      try {
        const r = await fetch(browserApiUrl(`/api/v1/forms/client/${clientId}`), {
          credentials: "include",
        });
        if (!r.ok) return;
        const d = (await r.json()) as { forms: FormSummary[] };
        setForms((d.forms ?? []).filter((f) => f.status === "submitted"));
      } catch {
        // ignore
      }
    }
    void loadForms();
  }, [clientId]);

  // Close dropdown on outside click
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  if (forms.length === 0) return null;

  function openModal(formId: string, formLabel: string) {
    setModalFormId(formId);
    setModalFormLabel(formLabel);
    setDropdownOpen(false);
  }

  return (
    <>
      <div ref={dropRef} style={{ position: "relative" }}>
        {forms.length === 1 ? (
          <button
            type="button"
            onClick={() => openModal(forms[0].id, forms[0].form_label)}
            style={{
              fontSize: 12,
              fontWeight: 700,
              padding: "4px 12px",
              borderRadius: 20,
              border: "1px solid var(--brand-100, #bfdbfe)",
              background: "var(--brand-50, #eff6ff)",
              color: "var(--brand, #1d4ed8)",
              cursor: "pointer",
            }}
          >
            View form
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setDropdownOpen((o) => !o)}
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: "4px 12px",
                borderRadius: 20,
                border: "1px solid var(--brand-100, #bfdbfe)",
                background: "var(--brand-50, #eff6ff)",
                color: "var(--brand, #1d4ed8)",
                cursor: "pointer",
              }}
            >
              View forms {dropdownOpen ? "▲" : "▼"}
            </button>
            {dropdownOpen && (
              <div style={{
                position: "absolute",
                right: 0,
                top: "calc(100% + 6px)",
                background: "var(--card-bg, #fff)",
                border: "1px solid var(--card-border)",
                borderRadius: 10,
                boxShadow: "0 8px 24px rgba(0,0,0,0.14)",
                minWidth: 240,
                zIndex: 200,
                overflow: "hidden",
              }}>
                {forms.map((f) => (
                  <div
                    key={f.id}
                    onClick={() => openModal(f.id, f.form_label)}
                    style={{
                      padding: "10px 16px",
                      fontSize: 13,
                      cursor: "pointer",
                      borderBottom: "1px solid var(--muted-100)",
                      color: "var(--ink)",
                      fontWeight: 600,
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "var(--brand-50, #eff6ff)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
                  >
                    {f.form_label}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {modalFormId && (
        <FormResponseModal
          formId={modalFormId}
          formLabel={modalFormLabel}
          onClose={() => { setModalFormId(null); setModalFormLabel(""); }}
        />
      )}
    </>
  );
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

const LIKELIHOOD_COLORS: Record<string, string> = {
  "VERY HIGH": "#b91c1c",
  "HIGH": "#b91c1c",
  "MODERATE": "#d97706",
  "LOW": "#2563eb",
};

function likelihoodBadgeStyle(likelihood: string) {
  const color = LIKELIHOOD_COLORS[likelihood?.toUpperCase()] ?? "#6b7280";
  return {
    display: "inline-block",
    padding: "3px 12px",
    borderRadius: 20,
    background: `${color}18`,
    color,
    fontWeight: 700,
    fontSize: 13,
    border: `1px solid ${color}40`,
  };
}

function severityColor(severity: string): string {
  const s = (severity ?? "").toLowerCase();
  // PHQ-9 / GAD-7
  if (s === "moderately severe" || s === "severe") return "#b91c1c";
  if (s === "moderate") return "#d97706";
  if (s === "mild") return "#2563eb";
  // Conners
  if (s === "clinically significant") return "#b91c1c";
  if (s === "elevated") return "#d97706";
  if (s === "subclinical") return "#22a76a";
  return "#22a76a";
}

function wfirsDomainColor(mean: number): string {
  if (mean >= 1.5) return "#b91c1c";
  if (mean >= 1.0) return "#d97706";
  return "#22a76a";
}

function ScoreRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "5px 0",
        borderBottom: "1px solid var(--muted-100, #f0f0f0)",
        fontSize: 13,
      }}
    >
      <span style={{ color: "var(--muted)" }}>{label}</span>
      <span style={{ fontWeight: 700, color: "var(--ink)" }}>{value}</span>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: "0.08em",
        textTransform: "uppercase" as const,
        color: "var(--muted)",
        marginBottom: 6,
        marginTop: 16,
      }}
    >
      {children}
    </div>
  );
}

function ScorePanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "var(--surface-50, rgba(0,0,0,0.02))",
        border: "1px solid var(--muted-100, #f0f0f0)",
        borderRadius: 10,
        padding: "12px 14px",
      }}
    >
      <div
        style={{
          fontWeight: 800,
          fontSize: 12,
          textTransform: "uppercase" as const,
          letterSpacing: "0.07em",
          color: "var(--muted)",
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────────────── */

export function AiClinicalReportCard({ clientId }: { clientId: string }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(
        browserApiUrl(`/api/v1/clients/${encodeURIComponent(clientId)}/ai-report`),
        { credentials: "include" },
      );
      if (r.status === 403) {
        /* Not permitted for this role - silently hide the entire card */
        setData(null);
        return;
      }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData((await r.json()) as ApiResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load report");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void fetchReport();
  }, [fetchReport]);

  async function handleRegenerate() {
    setRegenerating(true);
    setError(null);
    try {
      const r = await fetch(
        browserApiUrl(`/api/v1/clients/${encodeURIComponent(clientId)}/ai-report/regenerate`),
        { method: "POST", credentials: "include" },
      );
      if (!r.ok) {
        const b = (await r.json().catch(() => ({}))) as { detail?: string };
        throw new Error(b.detail ?? `HTTP ${r.status}`);
      }
      await fetchReport();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Regeneration failed");
    } finally {
      setRegenerating(false);
    }
  }

  /* 403 → data stays null → card hidden */
  if (!loading && data === null && !error) return null;

  return (
    <article className="mini-card" style={{ marginTop: "1.25rem" }}>

      {/* ── Card header ──────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 4,
          gap: 10,
          flexWrap: "wrap" as const,
        }}
      >
        <h3 style={{ margin: 0 }}>AI Pre-Assessment Overview</h3>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase" as const,
              background: "#7c5cfc18",
              color: "#7c5cfc",
              border: "1px solid #7c5cfc40",
              borderRadius: 20,
              padding: "2px 10px",
            }}
          >
            Admin / Senior Clinician only
          </span>
          <ViewFormsButton clientId={clientId} />
        </div>
      </div>
      <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 12 }}>
        Automatically generated from instrument scores when the adult self-referral form is submitted.
      </p>

      {/* ── Loading ───────────────────────────────────────────────── */}
      {loading && <p style={{ color: "var(--muted)", fontSize: 13 }}>Loading report…</p>}

      {/* ── Error ────────────────────────────────────────────────── */}
      {!loading && error && (
        <p style={{ color: "#b91c1c", fontSize: 13 }}>⚠ {error}</p>
      )}

      {/* ── Not yet generated ────────────────────────────────────── */}
      {!loading && !error && data && !data.available && (
        <p style={{ color: "var(--muted)", fontSize: 13 }}>
          No AI overview yet - will be generated automatically when the adult self-referral form is submitted.
        </p>
      )}

      {/* ── Report body ──────────────────────────────────────────── */}
      {!loading && !error && data?.available && data.report && (
        <>
          {/* AI generation failed - report exists but diagnostic_impression is null */}
          {data.report.error && (
            <div style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: 8,
              padding: "10px 14px",
              marginBottom: 12,
              fontSize: 13,
              color: "#b91c1c",
            }}>
              AI generation failed - scores are saved but clinical narrative is unavailable.
              Use the Regenerate button below to retry.
              <br />
              <span style={{ opacity: 0.7, fontSize: 12 }}>{data.report.error}</span>
            </div>
          )}

          {/* Diagnostic impression */}
          {data.report.diagnostic_impression && (
            <>
              <SectionHeader>Diagnostic Impression</SectionHeader>
              <div
                style={{
                  background: "var(--surface-50, rgba(0,0,0,0.02))",
                  border: "1px solid var(--muted-100, #f0f0f0)",
                  borderRadius: 10,
                  padding: "14px 16px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    flexWrap: "wrap" as const,
                    marginBottom: 10,
                    alignItems: "center",
                  }}
                >
                  <span style={likelihoodBadgeStyle(data.report.diagnostic_impression.likelihood)}>
                    {data.report.diagnostic_impression.likelihood} likelihood
                  </span>
                  {data.report.diagnostic_impression.presentation && (
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--ink)",
                        background: "var(--muted-50, #f4f6fb)",
                        borderRadius: 6,
                        padding: "2px 10px",
                        border: "1px solid var(--muted-100, #e8eaf0)",
                      }}
                    >
                      {data.report.diagnostic_impression.presentation}
                    </span>
                  )}
                </div>
                <p style={{ margin: 0, fontSize: 13, color: "var(--ink)", lineHeight: 1.55 }}>
                  {data.report.diagnostic_impression.reasoning}
                </p>
              </div>
            </>
          )}

          {/* Instrument scores */}
          {data.scores && (
            <>
              <SectionHeader>Instrument Scores</SectionHeader>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                  gap: 10,
                }}
              >
                {/* ASRS */}
                {data.scores.asrs && (
                  <ScorePanel title="ASRS-v1.1 (ADHD)">
                    <ScoreRow label="Part A screener" value={`${data.scores.asrs.part_a} / ${data.scores.asrs.part_a_max}`} />
                    <ScoreRow label="Part B" value={`${data.scores.asrs.part_b} / ${data.scores.asrs.part_b_max}`} />
                    <ScoreRow label="Total" value={`${data.scores.asrs.total} / ${data.scores.asrs.total_max}`} />
                    <ScoreRow label="Inattention" value={`${data.scores.asrs.inattention_score} / ${data.scores.asrs.inattention_max}`} />
                    <ScoreRow label="Hyperactivity / Impulsivity" value={`${data.scores.asrs.hi_score} / ${data.scores.asrs.hi_max}`} />
                    <ScoreRow
                      label="Screen"
                      value={
                        <span style={{ color: data.scores.asrs.screen_positive ? "#b91c1c" : "#22a76a" }}>
                          {data.scores.asrs.result} ({data.scores.asrs.screen_count}/6)
                        </span>
                      }
                    />
                    <ScoreRow label="Presentation" value={data.scores.asrs.presentation} />
                    <ScoreRow label="Likelihood" value={data.scores.asrs.likelihood} />
                  </ScorePanel>
                )}

                {/* PHQ-9 */}
                {data.scores.phq9 && (
                  <ScorePanel title="PHQ-9 (Depression)">
                    <ScoreRow label="Total score" value={`${data.scores.phq9.total} / ${data.scores.phq9.total_max}`} />
                    <ScoreRow
                      label="Severity"
                      value={
                        <span style={{ color: severityColor(data.scores.phq9.severity) }}>
                          {data.scores.phq9.severity}
                        </span>
                      }
                    />
                    {data.scores.phq9.suicidal_ideation_flag && (
                      <div
                        style={{
                          marginTop: 8,
                          background: "#b91c1c12",
                          border: "1px solid #b91c1c40",
                          borderRadius: 6,
                          padding: "6px 10px",
                          fontSize: 12,
                          color: "#b91c1c",
                          fontWeight: 700,
                        }}
                      >
                        ⚠ Suicidal ideation flagged (Item 9)
                      </div>
                    )}
                  </ScorePanel>
                )}

                {/* GAD-7 */}
                {data.scores.gad7 && (
                  <ScorePanel title="GAD-7 (Anxiety)">
                    <ScoreRow label="Total score" value={`${data.scores.gad7.total} / ${data.scores.gad7.total_max}`} />
                    <ScoreRow
                      label="Severity"
                      value={
                        <span style={{ color: severityColor(data.scores.gad7.severity) }}>
                          {data.scores.gad7.severity}
                        </span>
                      }
                    />
                  </ScorePanel>
                )}

                {/* WFIRS */}
                {data.scores.wfirs && (
                  <ScorePanel title="WFIRS-S (Functional Impairment)">
                    <ScoreRow
                      label="Overall mean"
                      value={
                        <span style={{ color: wfirsDomainColor(data.scores.wfirs.overall_mean) }}>
                          {data.scores.wfirs.overall_mean.toFixed(2)} / 3 · {data.scores.wfirs.impairment_level}
                        </span>
                      }
                    />
                    {data.scores.wfirs.domains.map((d) => (
                      <ScoreRow
                        key={d.domain}
                        label={d.domain}
                        value={
                          <span style={{ color: wfirsDomainColor(d.mean) }}>
                            {d.mean.toFixed(2)}
                            {d.elevated_count > 0 ? ` (${d.elevated_count}↑)` : ""}
                          </span>
                        }
                      />
                    ))}
                    {data.scores.wfirs.elevated_items > 0 && (
                      <div style={{ marginTop: 8, fontSize: 12, color: "var(--muted)" }}>
                        {data.scores.wfirs.elevated_items} item
                        {data.scores.wfirs.elevated_items !== 1 ? "s" : ""} rated ≥ Often
                      </div>
                    )}
                  </ScorePanel>
                )}

                {/* SDQ */}
                {data.scores.sdq && (
                  <ScorePanel title={data.scores.sdq.version === "self" ? "SDQ Self-Report" : "SDQ Parent-Report"}>
                    <ScoreRow
                      label="Total Difficulties"
                      value={
                        <span style={{ color: data.scores.sdq.total_band === "Normal" ? "#22a76a" : data.scores.sdq.total_band === "Borderline" ? "#d97706" : "#b91c1c" }}>
                          {data.scores.sdq.total_difficulties} / {data.scores.sdq.total_max} · {data.scores.sdq.total_band}
                        </span>
                      }
                    />
                    {([
                      ["Emotional", data.scores.sdq.emotional_symptoms, data.scores.sdq.emotional_band],
                      ["Conduct", data.scores.sdq.conduct_problems, data.scores.sdq.conduct_band],
                      ["Hyperactivity", data.scores.sdq.hyperactivity_inattention, data.scores.sdq.hyperact_band],
                      ["Peer problems", data.scores.sdq.peer_problems, data.scores.sdq.peer_band],
                    ] as [string, number, string][]).map(([sub, score, band]) => (
                      <ScoreRow
                        key={sub}
                        label={sub}
                        value={
                          <span style={{ color: band === "Normal" ? "#22a76a" : band === "Borderline" ? "#d97706" : "#b91c1c" }}>
                            {score} / 10 · {band}
                          </span>
                        }
                      />
                    ))}
                    <ScoreRow
                      label="Prosocial"
                      value={
                        <span style={{ color: data.scores.sdq.prosocial_band === "Normal" ? "#22a76a" : data.scores.sdq.prosocial_band === "Borderline" ? "#d97706" : "#b91c1c" }}>
                          {data.scores.sdq.prosocial} / 10 · {data.scores.sdq.prosocial_band}
                        </span>
                      }
                    />
                  </ScorePanel>
                )}

                {/* CPRS */}
                {data.scores.cprs && (
                  <ScorePanel title="CPRS-R(S) (Conners Parent Scale)">
                    <ScoreRow
                      label="Total"
                      value={
                        <span style={{ color: severityColor(data.scores.cprs.severity) }}>
                          {data.scores.cprs.total} / {data.scores.cprs.total_max} · {data.scores.cprs.severity}
                        </span>
                      }
                    />
                    <ScoreRow label="Cognitive / Inattention" value={`${data.scores.cprs.cognitive_inattention} / ${data.scores.cprs.cognitive_inattention_max}`} />
                    <ScoreRow label="Hyperactivity" value={`${data.scores.cprs.hyperactivity} / ${data.scores.cprs.hyperactivity_max}`} />
                    <ScoreRow label="Oppositional" value={`${data.scores.cprs.oppositional} / ${data.scores.cprs.oppositional_max}`} />
                  </ScorePanel>
                )}

                {/* CTRS */}
                {data.scores.ctrs && (
                  <ScorePanel title="CTRS-R(S) (Conners Teacher Scale)">
                    <ScoreRow
                      label="Total"
                      value={
                        <span style={{ color: severityColor(data.scores.ctrs.severity) }}>
                          {data.scores.ctrs.total} / {data.scores.ctrs.total_max} · {data.scores.ctrs.severity}
                        </span>
                      }
                    />
                    <ScoreRow label="Cognitive / Inattention" value={`${data.scores.ctrs.cognitive_inattention} / ${data.scores.ctrs.cognitive_inattention_max}`} />
                    <ScoreRow label="Hyperactivity" value={`${data.scores.ctrs.hyperactivity} / ${data.scores.ctrs.hyperactivity_max}`} />
                    <ScoreRow label="Oppositional" value={`${data.scores.ctrs.oppositional} / ${data.scores.ctrs.oppositional_max}`} />
                  </ScorePanel>
                )}
              </div>
            </>
          )}

          {/* Clinical summary */}
          {data.report.clinical_summary && (
            <>
              <SectionHeader>Clinical Summary</SectionHeader>
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  color: "var(--ink)",
                  lineHeight: 1.65,
                  background: "var(--surface-50, rgba(0,0,0,0.02))",
                  border: "1px solid var(--muted-100, #f0f0f0)",
                  borderRadius: 10,
                  padding: "12px 16px",
                }}
              >
                {data.report.clinical_summary}
              </p>
            </>
          )}

          {/* Recommendations */}
          {(data.report.recommendations?.length ?? 0) > 0 && (
            <>
              <SectionHeader>Recommendations</SectionHeader>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: 18,
                  fontSize: 13,
                  color: "var(--ink)",
                  lineHeight: 1.65,
                  display: "flex",
                  flexDirection: "column" as const,
                  gap: 4,
                }}
              >
                {data.report.recommendations.map((rec, i) => (
                  <li key={i}>{rec}</li>
                ))}
              </ul>
            </>
          )}

          {/* Risk flags */}
          {(data.report.flags?.length ?? 0) > 0 && (
            <>
              <SectionHeader>Clinical Flags</SectionHeader>
              <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6 }}>
                {data.report.flags.map((flag, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      background: "#b91c1c12",
                      color: "#b91c1c",
                      border: "1px solid #b91c1c30",
                      borderRadius: 20,
                      padding: "2px 10px",
                    }}
                  >
                    {flag}
                  </span>
                ))}
              </div>
            </>
          )}

          {/* Meta + regenerate */}
          <div
            style={{
              marginTop: 16,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap" as const,
              gap: 8,
            }}
          >
            <span style={{ fontSize: 11, color: "var(--muted)" }}>
              Generated{" "}
              {data.report.generated_at
                ? new Date(data.report.generated_at).toLocaleString("en-GB")
                : "-"}{" "}
              · {data.report.model ?? "AI model"}
            </span>
            <button
              className="ghost-chip"
              style={{ fontSize: 12 }}
              onClick={handleRegenerate}
              disabled={regenerating}
            >
              {regenerating ? "Regenerating…" : "↻ Regenerate AI report"}
            </button>
          </div>

          {error && (
            <p style={{ color: "#b91c1c", fontSize: 13, marginTop: 8 }}>⚠ {error}</p>
          )}
        </>
      )}
    </article>
  );
}
