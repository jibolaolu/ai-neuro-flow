"use client";

import { useState } from "react";
import {
  suggestReportSection,
  suggestSoapNotes,
  runPreSubmissionQA,
  crossInformantSynthesis,
  riskStratification,
  type QAIssue,
  type SmartAssignRanked,
} from "../lib/ai-api";

/* ── Props ─────────────────────────────────────────────────────────────────── */

interface AIAssistantPanelProps {
  clientId: string;
  /** Which tools to surface. Defaults to all. */
  tools?: ("report" | "soap" | "qa" | "synthesis" | "risk")[];
}

const REPORT_SECTIONS = [
  "Reason for Referral",
  "Background and History",
  "Assessment Method",
  "Results and Interpretation",
  "Diagnostic Impression",
  "Recommendations",
  "Summary",
];

type ActiveTool = "report" | "soap" | "qa" | "synthesis" | "risk" | null;

/* ── Component ──────────────────────────────────────────────────────────────── */

export function AIAssistantPanel({
  clientId,
  tools = ["report", "soap", "qa", "synthesis", "risk"],
}: AIAssistantPanelProps) {
  const [active, setActive]       = useState<ActiveTool>(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [result, setResult]       = useState<string | null>(null);
  const [qaIssues, setQaIssues]   = useState<QAIssue[] | null>(null);
  const [qaScore, setQaScore]     = useState<number | null>(null);

  // per-tool inputs
  const [section, setSection]     = useState(REPORT_SECTIONS[0]);
  const [caseNotes, setCaseNotes] = useState("");
  const [soapCtx, setSoapCtx]     = useState("");
  const [reportText, setReportText] = useState("");

  function reset() {
    setError(null);
    setResult(null);
    setQaIssues(null);
    setQaScore(null);
  }

  function open(tool: ActiveTool) {
    reset();
    setActive(active === tool ? null : tool);
  }

  async function handleReport() {
    setLoading(true); setError(null); setResult(null);
    const data = await suggestReportSection(clientId, section, caseNotes);
    setLoading(false);
    if (!data) { setError("AI request failed. Check your connection."); return; }
    setResult(data.draft);
  }

  async function handleSoap() {
    if (!soapCtx.trim()) { setError("Enter clinical context first."); return; }
    setLoading(true); setError(null); setResult(null);
    const data = await suggestSoapNotes(clientId, soapCtx);
    setLoading(false);
    if (!data) { setError("AI request failed."); return; }
    const { subjective, objective, assessment, plan } = data as Record<string, string>;
    setResult(
      `**S:** ${subjective}\n\n**O:** ${objective}\n\n**A:** ${assessment}\n\n**P:** ${plan}`
    );
  }

  async function handleQA() {
    if (!reportText.trim()) { setError("Paste the report text first."); return; }
    setLoading(true); setError(null); setResult(null); setQaIssues(null);
    const data = await runPreSubmissionQA(clientId, reportText);
    setLoading(false);
    if (!data) { setError("AI request failed."); return; }
    setQaScore(data.score ?? null);
    setQaIssues(data.issues ?? []);
    if (data.missing_sections?.length) {
      setResult(`Missing: ${data.missing_sections.join(", ")}`);
    } else if (data.passed) {
      setResult("Report passed QA review.");
    }
  }

  async function handleSynthesis() {
    setLoading(true); setError(null); setResult(null);
    const data = await crossInformantSynthesis(clientId);
    setLoading(false);
    if (!data || data.error) { setError(data?.error ?? "AI request failed."); return; }
    const lines: string[] = [data.summary ?? ""];
    if (data.discrepancies?.length) {
      lines.push("\n**Discrepancies:**");
      data.discrepancies.forEach((d) => {
        lines.push(`• ${d.raters?.join(" vs ")} — ${d.domain}: ${d.difference}`);
      });
    }
    if (data.flags?.length) {
      lines.push("\n⚠ **Flags:** " + data.flags.join("; "));
    }
    setResult(lines.join("\n"));
  }

  async function handleRisk() {
    setLoading(true); setError(null); setResult(null);
    const data = await riskStratification(clientId, caseNotes);
    setLoading(false);
    if (!data || data.error) { setError(data?.error ?? "AI request failed."); return; }
    const lines: string[] = [
      `**Overall risk: ${(data.overall_risk ?? "").toUpperCase()}**`,
    ];
    if (data.risk_factors?.length)
      lines.push("**Risk factors:** " + data.risk_factors.join("; "));
    if (data.protective_factors?.length)
      lines.push("**Protective factors:** " + data.protective_factors.join("; "));
    if (data.immediate_actions?.length)
      lines.push("**Immediate actions:** " + data.immediate_actions.join("; "));
    setResult(lines.join("\n\n"));
  }

  const TOOL_BTN_CLASS = (t: ActiveTool) =>
    `aip-tool-btn${active === t ? " aip-tool-btn--active" : ""}`;

  return (
    <div className="aip-shell">
      <div className="aip-header">
        <span className="aip-title">AI Assistant</span>
        <span className="aip-subtitle">Powered by Claude</span>
      </div>

      <div className="aip-toolbar">
        {tools.includes("report") && (
          <button className={TOOL_BTN_CLASS("report")} onClick={() => open("report")}>
            Report draft
          </button>
        )}
        {tools.includes("soap") && (
          <button className={TOOL_BTN_CLASS("soap")} onClick={() => open("soap")}>
            SOAP notes
          </button>
        )}
        {tools.includes("qa") && (
          <button className={TOOL_BTN_CLASS("qa")} onClick={() => open("qa")}>
            Pre-submission QA
          </button>
        )}
        {tools.includes("synthesis") && (
          <button className={TOOL_BTN_CLASS("synthesis")} onClick={() => open("synthesis")}>
            Cross-informant
          </button>
        )}
        {tools.includes("risk") && (
          <button className={TOOL_BTN_CLASS("risk")} onClick={() => open("risk")}>
            Risk
          </button>
        )}
      </div>

      {active === "report" && (
        <div className="aip-form">
          <label className="aip-label">Section</label>
          <select
            className="aip-select"
            value={section}
            onChange={(e) => setSection(e.target.value)}
          >
            {REPORT_SECTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <label className="aip-label">Clinician notes (optional)</label>
          <textarea
            className="aip-textarea"
            rows={3}
            value={caseNotes}
            onChange={(e) => setCaseNotes(e.target.value)}
            placeholder="Add any observations or context..."
          />
          <button className="aip-run-btn" onClick={handleReport} disabled={loading}>
            {loading ? "Generating…" : "Generate draft"}
          </button>
        </div>
      )}

      {active === "soap" && (
        <div className="aip-form">
          <label className="aip-label">Clinical context</label>
          <textarea
            className="aip-textarea"
            rows={4}
            value={soapCtx}
            onChange={(e) => setSoapCtx(e.target.value)}
            placeholder="Describe what happened in the session..."
          />
          <button className="aip-run-btn" onClick={handleSoap} disabled={loading}>
            {loading ? "Generating…" : "Generate SOAP note"}
          </button>
        </div>
      )}

      {active === "qa" && (
        <div className="aip-form">
          <label className="aip-label">Report text</label>
          <textarea
            className="aip-textarea"
            rows={6}
            value={reportText}
            onChange={(e) => setReportText(e.target.value)}
            placeholder="Paste the full report text here..."
          />
          <button className="aip-run-btn" onClick={handleQA} disabled={loading}>
            {loading ? "Reviewing…" : "Run QA review"}
          </button>
        </div>
      )}

      {active === "synthesis" && (
        <div className="aip-form">
          <p className="aip-hint">
            Analyses score discrepancies between parent, teacher, and self-report instruments
            for this client.
          </p>
          <button className="aip-run-btn" onClick={handleSynthesis} disabled={loading}>
            {loading ? "Analysing…" : "Analyse discrepancies"}
          </button>
        </div>
      )}

      {active === "risk" && (
        <div className="aip-form">
          <label className="aip-label">Additional notes (optional)</label>
          <textarea
            className="aip-textarea"
            rows={3}
            value={caseNotes}
            onChange={(e) => setCaseNotes(e.target.value)}
            placeholder="Any clinical observations relevant to risk..."
          />
          <button className="aip-run-btn" onClick={handleRisk} disabled={loading}>
            {loading ? "Stratifying…" : "Stratify risk"}
          </button>
        </div>
      )}

      {error && <p className="aip-error">{error}</p>}

      {qaScore !== null && (
        <div className={`aip-qa-score aip-qa-score--${qaScore >= 80 ? "pass" : qaScore >= 60 ? "warn" : "fail"}`}>
          QA score: {qaScore}/100
        </div>
      )}

      {qaIssues && qaIssues.length > 0 && (
        <div className="aip-qa-issues">
          {qaIssues.map((issue, i) => (
            <div key={i} className={`aip-qa-issue aip-qa-issue--${issue.severity}`}>
              <span className="aip-qa-issue-section">{issue.section}</span>
              <span className="aip-qa-issue-text">{issue.issue}</span>
            </div>
          ))}
        </div>
      )}

      {result && (
        <div className="aip-result">
          {result.split("\n").map((line, i) =>
            line.startsWith("**") && line.endsWith("**") ? (
              <p key={i} className="aip-result-heading">{line.replace(/\*\*/g, "")}</p>
            ) : line.startsWith("⚠") ? (
              <p key={i} className="aip-result-flag">{line}</p>
            ) : line.startsWith("•") ? (
              <p key={i} className="aip-result-bullet">{line}</p>
            ) : (
              <p key={i} className="aip-result-text">{line}</p>
            )
          )}
          <button
            className="aip-copy-btn"
            onClick={() => void navigator.clipboard.writeText(result)}
          >
            Copy to clipboard
          </button>
        </div>
      )}
    </div>
  );
}
