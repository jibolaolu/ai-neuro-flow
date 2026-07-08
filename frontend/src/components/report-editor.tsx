"use client";

import React from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { ClinicalReport } from "../lib/clinical-reports-api";
import {
  createReport,
  deleteReport,
  fetchReportsForClient,
  issueReport,
  patchReport,
  reportPdfUrl,
  reviewReport,
  submitReport,
} from "../lib/clinical-reports-api";
import { suggestReportSection } from "../lib/ai-api";
import type { ClientRecord } from "../lib/api";
import {
  ALL_TEMPLATES,
  getReportOptionsForClient,
  getTemplateForPathway,
  type ReportSection,
} from "../lib/report-template-config";
import {
  NHS_ADULT_ADHD_SCHEMA,
  type NHSReportField,
  type AutoTextField,
  type CheckboxGroupField,
  type InlineStatementField,
  type TextareaField,
  type BooleanField,
  type ScaleField,
} from "../lib/nhs-adhd-report-schema";

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "status-neutral",
    pending: "status-warn",
    complete: "status-good",
    issued: "status-good",
  };
  return (
    <span className={`inline-badge ${map[status] ?? "status-neutral"}`} style={{ textTransform: "capitalize" }}>
      {status}
    </span>
  );
}

function SectionField({
  section,
  value,
  locked,
  onChange,
}: {
  section: ReportSection;
  value: string;
  locked: boolean;
  onChange: (key: string, value: string) => void;
}) {
  const isSubsection = section.depth === 2;
  return (
    <div
      className={`report-section-field ${isSubsection ? "report-section-sub" : ""}`}
      style={{ marginBottom: isSubsection ? 16 : 24 }}
    >
      <div
        style={{
          fontSize: isSubsection ? 12 : 13,
          fontWeight: 800,
          color: isSubsection ? "var(--ink-700)" : "var(--brand)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: 6,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        {section.label}
        {section.required && <span style={{ color: "#dc2626", fontSize: 10 }}>REQUIRED</span>}
      </div>
      <textarea
        className="patient-table-textarea"
        style={{
          width: "100%",
          minHeight: isSubsection ? 80 : 120,
          fontSize: 13,
          lineHeight: 1.6,
          padding: "10px 12px",
          borderRadius: 8,
          border: "1px solid var(--muted-200)",
          background: locked ? "var(--muted-100)" : "var(--surface, #fff)",
          color: locked ? "var(--muted)" : "var(--ink)",
          resize: "vertical",
          transition: "border-color 150ms",
        }}
        placeholder={locked ? "(Template locked until 24 hours before assessment)" : section.placeholder}
        value={value}
        readOnly={locked}
        onChange={(e) => onChange(section.key, e.target.value)}
      />
    </div>
  );
}

// ── NHS Adult ADHD specific rendering ────────────────────────────────────────

/** Returns true for any adult ADHD report type — NHS, Private, or Combined. */
function isAdultADHDReport(reportType: string): boolean {
  return /adult.*adhd|adhd.*adult/i.test(reportType) ||
    /combined.*adhd|adhd.*autism/i.test(reportType);
}

function subVars(
  template: string,
  vars: { clientName: string; assessmentDate: string; assessedBy: string },
): string {
  return template
    .replace(/\{clientName\}/g, vars.clientName || "[Client]")
    .replace(/\{assessmentDate\}/g, vars.assessmentDate || "[Date]")
    .replace(/\{assessedBy\}/g, vars.assessedBy || "[Assessor]");
}

/** Returns true when a sectionNumber like "3.1" or "4.12.1" should be shown as a sub-heading. */
function isNumberedSubsection(sn: string): boolean {
  return /^\d/.test(sn) && sn.includes(".");
}

/** Combines sectionNumber + label for display, e.g. "4.1. Presenting difficulties" */
function fieldHeading(sectionNumber: string, label: string, depth: number): string {
  if (depth === 1 && isNumberedSubsection(sectionNumber) && !label.startsWith(sectionNumber)) {
    return `${sectionNumber}. ${label}`;
  }
  return label;
}

function AutoTextHeading({ label }: { label: string }) {
  return (
    <div
      style={{
        fontSize: 13,
        fontWeight: 800,
        color: "var(--brand)",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        marginBottom: 8,
        marginTop: 12,
        paddingTop: 6,
        borderTop: "1px solid var(--muted-200)",
      }}
    >
      {label}
    </div>
  );
}

function AutoTextContent({
  content,
  vars,
}: {
  content: string;
  vars: { clientName: string; assessmentDate: string; assessedBy: string };
}) {
  const substituted = subVars(content, vars);
  const paragraphs = substituted.split("\n\n");
  return (
    <div style={{ marginBottom: 12, color: "var(--ink)", fontSize: 13, lineHeight: 1.7 }}>
      {paragraphs.map((para, i) => {
        if (para.includes("\n•") || para.startsWith("•")) {
          const lines = para.split("\n").filter(Boolean);
          return (
            <div key={i} style={{ marginBottom: 8 }}>
              {lines.map((line, j) =>
                line.startsWith("•") ? (
                  <div key={j} style={{ display: "flex", gap: 8, marginBottom: 6, paddingLeft: 4 }}>
                    <span style={{ flexShrink: 0, color: "var(--brand)" }}>•</span>
                    <span>{line.replace(/^•\s*/, "")}</span>
                  </div>
                ) : (
                  <p key={j} style={{ margin: "0 0 6px" }}>{line}</p>
                ),
              )}
            </div>
          );
        }
        return <p key={i} style={{ margin: "0 0 8px" }}>{para}</p>;
      })}
    </div>
  );
}

function NHSAutoText({
  field,
  vars,
}: {
  field: AutoTextField;
  vars: { clientName: string; assessmentDate: string; assessedBy: string };
}) {
  const sn = field.sectionNumber ?? "";
  const depth = field.depth ?? 1;
  // Heading-only (no content) — e.g. 2.2 Recommendations, 2.3 heading
  if (!field.content) {
    return <AutoTextHeading label={field.label} />;
  }
  // Content with explicit showLabel flag — e.g. 3.1 Diagnostic criteria, 2.3.2 bullets
  if (field.showLabel) {
    return (
      <>
        <AutoTextHeading label={fieldHeading(sn, field.label, depth)} />
        <AutoTextContent content={field.content} vars={vars} />
      </>
    );
  }
  // Preamble content only (no heading) — e.g. 2_1_preamble, 4_0_preamble
  return <AutoTextContent content={field.content} vars={vars} />;
}

function NHSCheckboxField({
  field,
  value,
  notesValue,
  canEdit,
  onChange,
}: {
  field: CheckboxGroupField;
  value: string;
  notesValue: string;
  canEdit: boolean;
  onChange: (key: string, val: string) => void;
}) {
  const selected = value ? value.split(",").map((s) => s.trim()).filter(Boolean) : [];

  function toggle(option: string) {
    if (!canEdit) return;
    const next = selected.includes(option)
      ? selected.filter((s) => s !== option)
      : [...selected, option];
    onChange(field.key, next.join(","));
  }

  const cbHeading = fieldHeading(field.sectionNumber ?? "", field.label, field.depth ?? 1);
  return (
    <div style={{ marginBottom: 20 }}>
      <div
        style={{
          fontSize: 13,
          fontWeight: 800,
          color: "var(--brand)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: 6,
        }}
      >
        {cbHeading}{" "}
        <span style={{ fontWeight: 400, fontSize: 11, color: "var(--muted)", textTransform: "none", letterSpacing: 0 }}>
          ({field.instruction})
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
        {field.options.map((option) => (
          <label
            key={option}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              cursor: canEdit ? "pointer" : "default",
              color: "var(--ink)",
            }}
          >
            <input
              type="checkbox"
              checked={selected.includes(option)}
              disabled={!canEdit}
              onChange={() => toggle(option)}
              style={{ width: 15, height: 15, accentColor: "var(--brand)" }}
            />
            {option}
          </label>
        ))}
      </div>
      {field.notesKey && (
        <textarea
          className="patient-table-textarea"
          style={{
            width: "100%",
            minHeight: 72,
            fontSize: 13,
            lineHeight: 1.6,
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid var(--muted-200)",
            background: canEdit ? "var(--surface, #fff)" : "var(--muted-100)",
            color: canEdit ? "var(--ink)" : "var(--muted)",
            resize: "vertical",
          }}
          placeholder={canEdit ? "" : "(Read only)"}
          value={notesValue}
          readOnly={!canEdit}
          maxLength={field.notesMaxChars}
          onChange={(e) => field.notesKey && onChange(field.notesKey, e.target.value)}
        />
      )}
      {field.notesKey && field.notesMaxChars && (
        <div style={{ fontSize: 11, color: "var(--muted)", textAlign: "right", marginTop: 2 }}>
          {notesValue.length}/{field.notesMaxChars} characters
        </div>
      )}
    </div>
  );
}

function NHSInlineStatement({
  field,
  sections,
  clientName,
  canEdit,
  onChange,
}: {
  field: InlineStatementField;
  sections: Record<string, string>;
  clientName: string;
  canEdit: boolean;
  onChange: (key: string, val: string) => void;
}) {
  const firstPart = field.templateParts[0] ?? "";
  const hasClientPlaceholder = firstPart.includes("[Patient]");
  const depth = field.depth ?? 1;
  const sn = field.sectionNumber ?? "";

  return (
    <div style={{ marginBottom: 20 }}>
      {field.showLabel && (
        <AutoTextHeading label={fieldHeading(sn, field.label, depth)} />
      )}
      <div
        style={{
          fontSize: 14,
          lineHeight: 2,
          color: "var(--ink)",
          padding: "10px 14px",
          background: "var(--brand-50)",
          borderRadius: 8,
          border: "1px solid rgba(42, 77, 183, 0.12)",
        }}
      >
        {hasClientPlaceholder ? (
          <>
            {firstPart.split("[Patient]")[0]}
            <strong style={{ color: "var(--brand)" }}>{clientName || "[Patient]"}</strong>
            {firstPart.split("[Patient]")[1]}
          </>
        ) : (
          <span>{firstPart}</span>
        )}
        {field.dropdowns.map((dd, idx) => (
          <span key={dd.key}>
            <select
              value={sections[`${field.key}_${dd.key}`] ?? dd.options[0]}
              disabled={!canEdit}
              onChange={(e) => onChange(`${field.key}_${dd.key}`, e.target.value)}
              style={{
                fontSize: 13,
                padding: "2px 6px",
                borderRadius: 6,
                border: "1px solid var(--muted-200)",
                background: canEdit ? "#fff" : "var(--muted-100)",
                color: "var(--ink)",
                cursor: canEdit ? "pointer" : "default",
                margin: "0 4px",
              }}
            >
              {dd.options.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
            <span>{field.templateParts[idx + 1]}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function NHSTextareaField({
  field,
  value,
  canEdit,
  onChange,
}: {
  field: TextareaField;
  value: string;
  canEdit: boolean;
  onChange: (key: string, val: string) => void;
}) {
  const depth = field.depth ?? 1;
  const isSubsection = depth >= 2;
  const isBulletItem = depth === 3;
  const heading = fieldHeading(field.sectionNumber ?? "", field.label, depth);

  // Bullet-item style (depth 3) — used for DIVA 4.18.x sub-criteria
  if (isBulletItem) {
    return (
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 4 }}>
          <span style={{ color: "var(--brand)", fontWeight: 800, fontSize: 14, flexShrink: 0, marginTop: 1 }}>•</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--brand)" }}>
            {field.label}
            {field.required && <span style={{ color: "#dc2626", fontSize: 10, marginLeft: 4 }}>REQUIRED</span>}
          </span>
        </div>
        <textarea
          className="patient-table-textarea"
          style={{
            width: "100%",
            minHeight: 72,
            fontSize: 13,
            lineHeight: 1.6,
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid var(--muted-200)",
            background: canEdit ? "var(--surface, #fff)" : "var(--muted-100)",
            color: canEdit ? "var(--ink)" : "var(--muted)",
            resize: "vertical",
          }}
          placeholder={canEdit ? (field.placeholder ?? "Type in here") : "(Read only)"}
          value={value}
          readOnly={!canEdit}
          maxLength={field.maxChars}
          onChange={(e) => onChange(field.key, e.target.value)}
        />
        {field.maxChars && (
          <div style={{ fontSize: 11, color: "var(--muted)", textAlign: "right", marginTop: 2 }}>
            {value.length}/{field.maxChars} characters
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ marginBottom: isSubsection ? 16 : 24 }}>
      <div
        style={{
          fontSize: isSubsection ? 12 : 13,
          fontWeight: 800,
          color: isSubsection ? "var(--ink-700)" : "var(--brand)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: 6,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        {heading}
        {field.required && <span style={{ color: "#dc2626", fontSize: 10 }}>REQUIRED</span>}
      </div>
      <textarea
        className="patient-table-textarea"
        style={{
          width: "100%",
          minHeight: isSubsection ? 80 : 120,
          fontSize: 13,
          lineHeight: 1.6,
          padding: "10px 12px",
          borderRadius: 8,
          border: "1px solid var(--muted-200)",
          background: canEdit ? "var(--surface, #fff)" : "var(--muted-100)",
          color: canEdit ? "var(--ink)" : "var(--muted)",
          resize: "vertical",
          transition: "border-color 150ms",
        }}
        placeholder={canEdit ? (field.placeholder ?? "") : "(Template locked)"}
        value={value}
        readOnly={!canEdit}
        maxLength={field.maxChars}
        onChange={(e) => onChange(field.key, e.target.value)}
      />
      {field.maxChars && (
        <div style={{ fontSize: 11, color: "var(--muted)", textAlign: "right", marginTop: 2 }}>
          {value.length}/{field.maxChars} characters
        </div>
      )}
    </div>
  );
}

function NHSBooleanField({
  field,
  value,
  canEdit,
  onChange,
}: {
  field: BooleanField;
  value: string;
  canEdit: boolean;
  onChange: (key: string, val: string) => void;
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--brand)", marginBottom: 8, lineHeight: 1.5 }}>
        <span style={{ marginRight: 6, fontWeight: 800 }}>{field.sectionNumber}.</span>
        {field.label}
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        {["Yes", "No"].map((opt) => (
          <label key={opt} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: canEdit ? "pointer" : "default" }}>
            <input
              type="radio"
              name={field.key}
              value={opt === "Yes" ? "true" : "false"}
              checked={value === (opt === "Yes" ? "true" : "false")}
              disabled={!canEdit}
              onChange={() => onChange(field.key, opt === "Yes" ? "true" : "false")}
              style={{ accentColor: "var(--brand)" }}
            />
            {opt}
          </label>
        ))}
      </div>
    </div>
  );
}

const QUESTIONNAIRE_DESCRIPTIONS: Record<string, string> = {
  "AQ-10": "AQ-10 (Autism Quotient) is a 10-item self-report questionnaire to help determine if someone should be referred for an autism assessment.",
  "AQ10": "AQ-10 (Autism Quotient) is a 10-item self-report questionnaire to help determine if someone should be referred for an autism assessment.",
  "AQ10-CHILD": "AQ-10 (Autism Quotient) is a 10-item self-report questionnaire to help determine if someone should be referred for an autism assessment.",
  "ASRS": "ASRS (Adult ADHD Self-Report Scale) is an 18-item questionnaire developed by the World Health Organization to screen for ADHD symptoms in adults.",
  "ASRS-18": "ASRS-18 (Adult ADHD Self-Report Scale) is an 18-item questionnaire developed by the World Health Organization to screen for ADHD symptoms in adults.",
  "RCADS": "RCADS (Revised Child Anxiety and Depression Scale) is a 47-item self-report questionnaire to assess various anxiety and depression symptoms (including separation anxiety disorder, social phobia, generalized anxiety disorder, panic disorder, obsessive compulsive disorder, and low mood) in young people.",
  "RCAD-5": "RCADS (Revised Child Anxiety and Depression Scale) is a 47-item self-report questionnaire to assess various anxiety and depression symptoms (including separation anxiety disorder, social phobia, generalized anxiety disorder, panic disorder, obsessive compulsive disorder, and low mood) in young people.",
  "RCADS-5": "RCADS (Revised Child Anxiety and Depression Scale) is a 47-item self-report questionnaire to assess various anxiety and depression symptoms (including separation anxiety disorder, social phobia, generalized anxiety disorder, panic disorder, obsessive compulsive disorder, and low mood) in young people.",
  "HADS": "HADS (Hospital Anxiety and Depression Scale) is a 14-item questionnaire measuring anxiety and depression in non-psychiatric patients.",
  "BGIIv": "BGIIv (Brown Attention-Deficit Disorder Rating Scales) assess executive function and ADHD symptoms across the lifespan.",
  "BGDIA": "BGDia/BGCHDio is a self-or parent-reported questionnaire that collects information on current issues, family background, life events, and medical history.",
  "BGCHDIO": "BGDia/BGCHDio is a self-or parent-reported questionnaire that collects information on current issues, family background, life events, and medical history.",
  "MHAQ": "MHAQ (Mental Health and Autism Questionnaire) is used to assess mental health alongside neurodevelopmental presentations.",
  "SDQ": "SDQ (Strengths and Difficulties Questionnaire) is a questionnaire that parents, teachers, or an individual themselves can complete which assesses a child's positive and negative attributes across five scales; emotional symptoms, conduct problems, hyperactivity-inattention, peer problems, and prosocial behavior.",
  "SAQ": "SAQ (School Assessment Questionnaire) is a teacher-completed assessment that evaluates a child's social behaviour to help understand how well a child is adapting or coping with the social and behavioral demands of the school environment.",
  "Conners": "The Conners Rating Scale is a standardised tool used to assess ADHD symptoms using T-scores across multiple informants.",
};

function getDescription(name: string): string {
  const nameUp = name.toUpperCase().replace(/[\s\-_]/g, "");
  const key = Object.keys(QUESTIONNAIRE_DESCRIPTIONS).find((k) =>
    nameUp.includes(k.toUpperCase().replace(/[\s\-_]/g, "")) ||
    k.toUpperCase().replace(/[\s\-_]/g, "").includes(nameUp),
  );
  return key ? QUESTIONNAIRE_DESCRIPTIONS[key] : "";
}

type QuestionnaireEntry = {
  id: string;
  name: string;
  status: string;
  completionDate: string;
  score: string;
};

function NHSQuestionnaireTable({
  value,
  canEdit,
  onChange,
}: {
  value: string;
  canEdit: boolean;
  onChange: (val: string) => void;
}) {
  const entries: QuestionnaireEntry[] = (() => {
    try { return value ? JSON.parse(value) : []; } catch { return []; }
  })();

  const [adding, setAdding] = useState(false);
  const [newEntry, setNewEntry] = useState({ name: "", status: "Completed", completionDate: "", score: "" });

  function save(updated: QuestionnaireEntry[]) {
    onChange(JSON.stringify(updated));
  }

  function handleAdd() {
    if (!newEntry.name.trim()) return;
    const entry: QuestionnaireEntry = {
      id: `q_${Date.now()}`,
      name: newEntry.name.trim(),
      status: newEntry.status,
      completionDate: newEntry.completionDate,
      score: newEntry.score,
    };
    save([...entries, entry]);
    setNewEntry({ name: "", status: "Completed", completionDate: "", score: "" });
    setAdding(false);
  }

  function handleRemove(id: string) {
    save(entries.filter((e) => e.id !== id));
  }

  const thStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    color: "var(--muted)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    padding: "8px 12px",
    textAlign: "left",
    borderBottom: "2px solid var(--muted-200)",
    background: "var(--muted-100)",
  };

  return (
    <div style={{ marginBottom: 24 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr>
            <th style={thStyle}>Questionnaire Name and Status</th>
            <th style={thStyle}>Completion Date</th>
            <th style={{ ...thStyle, minWidth: 180 }}>Score or Output</th>
            {canEdit && <th style={{ ...thStyle, width: 48 }}>Remove</th>}
          </tr>
        </thead>
        <tbody>
          {entries.length === 0 && (
            <tr>
              <td colSpan={canEdit ? 4 : 3} style={{ padding: "16px 12px", color: "var(--muted)", fontSize: 13 }}>
                No questionnaires added yet.
              </td>
            </tr>
          )}
          {entries.map((entry) => {
            const desc = getDescription(entry.name);
            return (
              <React.Fragment key={entry.id}>
                <tr style={{ borderBottom: "1px solid var(--muted-200)" }}>
                  <td style={{ padding: "10px 12px", verticalAlign: "top" }}>
                    <strong style={{ color: "var(--brand)", display: "block" }}>{entry.name}</strong>
                    <span style={{ color: "var(--muted)", fontSize: 12 }}>{entry.status}</span>
                  </td>
                  <td style={{ padding: "10px 12px", verticalAlign: "top", color: "var(--ink)" }}>
                    {entry.completionDate}
                  </td>
                  <td style={{ padding: "10px 12px", verticalAlign: "top", color: "var(--ink)", whiteSpace: "pre-wrap" }}>
                    {entry.score}
                  </td>
                  {canEdit && (
                    <td style={{ padding: "10px 12px", verticalAlign: "top", textAlign: "center" }}>
                      <button
                        type="button"
                        onClick={() => handleRemove(entry.id)}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "#dc2626",
                          fontSize: 16,
                          padding: 4,
                        }}
                        aria-label="Remove questionnaire"
                      >
                        🗑
                      </button>
                    </td>
                  )}
                </tr>
                {desc && (
                  <tr>
                    <td colSpan={canEdit ? 4 : 3} style={{ padding: "8px 12px 12px", color: "var(--muted)", fontSize: 12, lineHeight: 1.6, borderBottom: "1px solid var(--muted-200)", fontStyle: "italic" }}>
                      {desc}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>

      {canEdit && !adding && (
        <button
          type="button"
          className="ghost-chip button-reset"
          style={{ marginTop: 10, fontSize: 12 }}
          onClick={() => setAdding(true)}
        >
          + Add questionnaire
        </button>
      )}

      {canEdit && adding && (
        <div
          style={{
            marginTop: 12,
            padding: "14px 16px",
            border: "1px solid var(--muted-200)",
            borderRadius: 8,
            background: "var(--muted-100)",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
          }}
        >
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 4 }}>Questionnaire Name</label>
            <input
              type="text"
              className="patient-table-input"
              value={newEntry.name}
              onChange={(e) => setNewEntry((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. ASRS-18 (Self)"
              style={{ fontSize: 13, width: "100%" }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 4 }}>Status</label>
            <select
              className="clinical-appointment-type-select"
              value={newEntry.status}
              onChange={(e) => setNewEntry((p) => ({ ...p, status: e.target.value }))}
              style={{ fontSize: 13, width: "100%" }}
            >
              <option>Completed</option>
              <option>Pending</option>
              <option>Not completed</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 4 }}>Completion Date</label>
            <input
              type="datetime-local"
              className="patient-table-input"
              value={newEntry.completionDate}
              onChange={(e) => setNewEntry((p) => ({ ...p, completionDate: e.target.value }))}
              style={{ fontSize: 13, width: "100%" }}
            />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 4 }}>Score or Output</label>
            <textarea
              className="patient-table-textarea"
              value={newEntry.score}
              onChange={(e) => setNewEntry((p) => ({ ...p, score: e.target.value }))}
              placeholder="Scores, bands, or descriptive output"
              style={{ fontSize: 13, width: "100%", minHeight: 60 }}
            />
          </div>
          <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}>
            <button type="button" className="primary-action button-reset" style={{ fontSize: 12 }} onClick={handleAdd}>Add</button>
            <button type="button" className="ghost-chip button-reset" style={{ fontSize: 12 }} onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Conners 4 Structured Table ────────────────────────────────────────────────

type ConnersData = Record<string, string>;

function tScoreStyle(val: string): React.CSSProperties {
  const n = parseInt(val, 10);
  if (isNaN(n) || !val.trim()) return {};
  if (n >= 70) return { background: "#fecaca", color: "#b91c1c" };
  if (n >= 60) return { background: "#fde68a", color: "#92400e" };
  return { background: "#bbf7d0", color: "#166534" };
}

function ConnersCell({
  val,
  dataKey,
  colored,
  canEdit,
  disabled,
  onUpdate,
}: {
  val: string;
  dataKey: string;
  colored: boolean;
  canEdit: boolean;
  disabled?: boolean;
  onUpdate: (key: string, v: string) => void;
}) {
  if (disabled) {
    return (
      <td style={{ textAlign: "center", padding: "8px 10px", color: "var(--muted)", fontSize: 13 }}>—</td>
    );
  }
  const cellStyle: React.CSSProperties = colored ? tScoreStyle(val) : {};
  if (!canEdit) {
    return (
      <td style={{ textAlign: "center", padding: "6px 8px" }}>
        <span style={{
          display: "inline-block",
          minWidth: 38,
          padding: "3px 8px",
          borderRadius: 6,
          fontSize: 13,
          fontWeight: val ? 700 : 400,
          ...cellStyle,
        }}>
          {val || "—"}
        </span>
      </td>
    );
  }
  return (
    <td style={{ textAlign: "center", padding: "6px 8px", background: cellStyle.background as string | undefined }}>
      <input
        type="text"
        value={val}
        onChange={(e) => onUpdate(dataKey, e.target.value)}
        style={{
          width: 64,
          textAlign: "center",
          fontSize: 13,
          fontWeight: 700,
          borderRadius: 6,
          border: "1px solid var(--muted-200)",
          padding: "4px 6px",
          ...cellStyle,
        }}
      />
    </td>
  );
}

function NHSConnersTable({
  value,
  canEdit,
  onChange,
}: {
  value: string;
  canEdit: boolean;
  onChange: (val: string) => void;
}) {
  const data: ConnersData = (() => {
    try { return value ? (JSON.parse(value) as ConnersData) : {}; } catch { return {}; }
  })();

  const [expandContent, setExpandContent] = useState(true);
  const [expandImpairment, setExpandImpairment] = useState(true);
  const [expandIndex, setExpandIndex] = useState(true);
  const [expandInfo, setExpandInfo] = useState(false);

  function update(key: string, val: string) {
    onChange(JSON.stringify({ ...data, [key]: val }));
  }

  const thBase: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    color: "var(--muted)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    padding: "8px 10px",
    textAlign: "center",
    background: "var(--muted-100)",
    borderBottom: "2px solid var(--muted-200)",
    whiteSpace: "nowrap",
  };

  function anyElevated(keys: string[]): boolean {
    return keys.some((k) => { const n = parseInt(data[k] ?? "", 10); return !isNaN(n) && n >= 60; });
  }

  function groupRow(label: string, expanded: boolean, toggle: () => void) {
    return (
      <tr
        style={{ background: "#f3f4fb", cursor: "pointer", userSelect: "none" }}
        onClick={toggle}
      >
        <td colSpan={5} style={{ padding: "8px 14px", fontWeight: 700, fontSize: 12, color: "var(--brand)", letterSpacing: "0.03em" }}>
          <span style={{ marginRight: 8, fontSize: 10 }}>{expanded ? "▼" : "▶"}</span>
          {label}
        </td>
      </tr>
    );
  }

  function tScoreRow(label: string, ck: string, pk: string, tk: string, noTeacher?: boolean) {
    const flagKeys = noTeacher ? [ck, pk] : [ck, pk, tk];
    const elevated = anyElevated(flagKeys);
    return (
      <tr style={{ borderBottom: "1px solid var(--muted-100)" }}>
        <td style={{ padding: "8px 12px", paddingLeft: 24, fontSize: 13, color: "var(--ink)" }}>{label}</td>
        <ConnersCell val={data[ck] ?? ""} dataKey={ck} colored canEdit={canEdit} onUpdate={update} />
        <ConnersCell val={data[pk] ?? ""} dataKey={pk} colored canEdit={canEdit} onUpdate={update} />
        <ConnersCell val={data[tk] ?? ""} dataKey={tk} colored={!noTeacher} canEdit={canEdit} disabled={noTeacher} onUpdate={update} />
        <td style={{ textAlign: "center", padding: "6px 8px", width: 60, whiteSpace: "nowrap" }}>
          {elevated && <span title="Elevated score" style={{ color: "#f59e0b", fontSize: 14, marginRight: 2 }}>⚠</span>}
          {(elevated || canEdit) && <span style={{ color: "var(--brand)", fontSize: 11 }}>✱</span>}
        </td>
      </tr>
    );
  }

  function plainCell(cellKey: string, placeholder?: string) {
    if (!canEdit) {
      return (
        <td style={{ textAlign: "center", padding: "8px 10px", fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
          {data[cellKey] || "—"}
        </td>
      );
    }
    return (
      <td style={{ textAlign: "center", padding: "6px 8px" }}>
        <input
          type="text"
          value={data[cellKey] ?? ""}
          onChange={(e) => update(cellKey, e.target.value)}
          placeholder={placeholder ?? ""}
          style={{
            width: 90,
            textAlign: "center",
            fontSize: 13,
            borderRadius: 6,
            border: "1px solid var(--muted-200)",
            padding: "4px 6px",
          }}
        />
      </td>
    );
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, border: "1px solid var(--muted-200)", borderRadius: 8, overflow: "hidden" }}>
        <thead>
          <tr>
            <th style={{ ...thBase, textAlign: "left", width: "38%" }}>Scale</th>
            <th style={thBase}>Child</th>
            <th style={thBase}>Parent</th>
            <th style={thBase}>Teacher</th>
            <th style={{ ...thBase, width: 60 }}>Flags</th>
          </tr>
        </thead>
        <tbody>
          {/* Content Scales */}
          {groupRow("Content Scales", expandContent, () => setExpandContent((c) => !c))}
          {expandContent && (
            <>
              {tScoreRow("Inattention/Executive Dysfunction", "cs_inattention_child", "cs_inattention_parent", "cs_inattention_teacher")}
              {tScoreRow("Hyperactivity", "cs_hyperactivity_child", "cs_hyperactivity_parent", "cs_hyperactivity_teacher")}
              {tScoreRow("Impulsivity", "cs_impulsivity_child", "cs_impulsivity_parent", "cs_impulsivity_teacher")}
              {tScoreRow("Emotional Dysregulation", "cs_emotional_child", "cs_emotional_parent", "cs_emotional_teacher")}
            </>
          )}

          {/* Impairment & Functional Outcome Scales */}
          {groupRow("Impairment & Functional Outcome Scales", expandImpairment, () => setExpandImpairment((c) => !c))}
          {expandImpairment && (
            <>
              {tScoreRow("Schoolwork", "fs_schoolwork_child", "fs_schoolwork_parent", "fs_schoolwork_teacher")}
              {tScoreRow("Peer Interactions", "fs_peer_child", "fs_peer_parent", "fs_peer_teacher")}
              {tScoreRow("Family Life", "fs_family_child", "fs_family_parent", "fs_family_teacher", true)}
            </>
          )}

          {/* Conners 4-ADHD Index */}
          {groupRow("Conners 4-ADHD Index", expandIndex, () => setExpandIndex((c) => !c))}
          {expandIndex && (
            <>
              <tr style={{ borderBottom: "1px solid var(--muted-100)" }}>
                <td style={{ padding: "8px 12px", paddingLeft: 24, fontSize: 13, color: "var(--ink)" }}>Raw Score</td>
                {plainCell("idx_raw_child")}
                {plainCell("idx_raw_parent")}
                {plainCell("idx_raw_teacher")}
                <td />
              </tr>
              <tr style={{ borderBottom: "1px solid var(--muted-100)" }}>
                <td style={{ padding: "8px 12px", paddingLeft: 24, fontSize: 13, color: "var(--ink)" }}>Probability Score</td>
                {plainCell("idx_prob_child", "e.g. 95%")}
                {plainCell("idx_prob_parent", "e.g. 99%")}
                {plainCell("idx_prob_teacher", "e.g. 82%")}
                <td />
              </tr>
              <tr style={{ borderBottom: "1px solid var(--muted-100)" }}>
                <td style={{ padding: "8px 12px", paddingLeft: 24, fontSize: 13, color: "var(--ink)" }}>Guideline</td>
                {plainCell("idx_guide_child", "e.g. Very High")}
                {plainCell("idx_guide_parent", "e.g. Very High")}
                {plainCell("idx_guide_teacher", "e.g. High")}
                <td />
              </tr>
            </>
          )}
        </tbody>
      </table>

      {/* Info expandable */}
      <div style={{ border: "1px solid var(--muted-200)", borderRadius: 6, marginTop: 6, overflow: "hidden" }}>
        <button
          type="button"
          onClick={() => setExpandInfo((i) => !i)}
          style={{
            width: "100%",
            textAlign: "left",
            padding: "8px 14px",
            background: expandInfo ? "var(--muted-100)" : "transparent",
            border: "none",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
            color: "var(--ink)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ fontSize: 10 }}>{expandInfo ? "▼" : "▶"}</span> Info
        </button>
        {expandInfo && (
          <div style={{ padding: "12px 14px", fontSize: 12, color: "var(--ink)", lineHeight: 1.8, borderTop: "1px solid var(--muted-200)" }}>
            <p style={{ margin: "0 0 8px", fontWeight: 700 }}>T-score interpretation:</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span><span style={{ background: "#bbf7d0", color: "#166534", borderRadius: 4, padding: "1px 8px", fontWeight: 700 }}>≤59</span> — Within normal limits</span>
              <span><span style={{ background: "#fde68a", color: "#92400e", borderRadius: 4, padding: "1px 8px", fontWeight: 700 }}>60–69</span> — Mildly elevated</span>
              <span><span style={{ background: "#fecaca", color: "#b91c1c", borderRadius: 4, padding: "1px 8px", fontWeight: 700 }}>≥70</span> — Clinically elevated</span>
            </div>
            <p style={{ margin: "8px 0 0", color: "var(--muted)" }}>⚠ Flags appear when at least one rater scored the scale in the elevated range (T ≥ 60).</p>
          </div>
        )}
      </div>

      {/* Conners summary */}
      <div style={{ marginTop: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "var(--brand)", marginBottom: 8 }}>
          Conners summary
        </div>
        <textarea
          className="patient-table-textarea"
          style={{
            width: "100%",
            minHeight: 100,
            fontSize: 13,
            lineHeight: 1.6,
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid var(--muted-200)",
            background: canEdit ? "var(--surface, #fff)" : "var(--muted-100)",
            color: canEdit ? "var(--ink)" : "var(--muted)",
            resize: "vertical",
          }}
          placeholder={canEdit ? "Type in here" : "(Read only)"}
          value={data["conners_summary"] ?? ""}
          readOnly={!canEdit}
          maxLength={5000}
          onChange={(e) => update("conners_summary", e.target.value)}
        />
        <div style={{ fontSize: 11, color: "var(--muted)", textAlign: "right", marginTop: 2 }}>
          {(data["conners_summary"] ?? "").length}/5000 characters
        </div>
      </div>
    </div>
  );
}

function NHSSectionGroupHeader({ sectionNumber, sectionLabel }: { sectionNumber: string; sectionLabel: string }) {
  const isRoman = /^[IVX]+$/.test(sectionNumber);
  // e.g. "4.18.1" → show "4.18.1 Attention, concentration and focus"
  // But the sectionLabel already includes the number for DIVA sub-sections, so don't double-prefix
  const labelAlreadyNumbered = /^\d/.test(sectionLabel);
  return (
    <div
      style={{
        marginTop: 28,
        marginBottom: 16,
        paddingBottom: 8,
        borderBottom: "2px solid var(--brand)",
      }}
    >
      <h2
        style={{
          fontSize: isRoman ? 18 : 15,
          fontWeight: 800,
          color: "var(--brand)",
          margin: 0,
          letterSpacing: "-0.01em",
        }}
      >
        {isRoman ? `${sectionNumber}. ` : (!labelAlreadyNumbered && isNumberedSubsection(sectionNumber) ? `${sectionNumber}. ` : "")}{sectionLabel}
      </h2>
    </div>
  );
}

function NHSAdultADHDForm({
  sections,
  client,
  localMeta,
  canEdit,
  onChange,
}: {
  sections: Record<string, string>;
  client: ClientRecord;
  localMeta: { place: string; date: string; assessed_by: string; report_type: string };
  canEdit: boolean;
  onChange: (key: string, val: string) => void;
}) {
  const clientName = client.child_name ?? client.full_name ?? "";
  const vars = {
    clientName,
    assessmentDate: localMeta.date
      ? new Date(localMeta.date).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })
      : "",
    assessedBy: localMeta.assessed_by,
  };

  return (
    <div>
      {NHS_ADULT_ADHD_SCHEMA.sections.map((group) => (
        <div key={group.sectionNumber}>
          {/* Skip Section I — already rendered in the header metadata block */}
          {group.sectionNumber !== "I" && (
            <NHSSectionGroupHeader sectionNumber={group.sectionNumber} sectionLabel={group.sectionLabel} />
          )}
          {group.sectionNumber !== "I" && group.fields.map((field) => {
            switch (field.kind) {
              case "auto-text":
                return (
                  <NHSAutoText key={field.key} field={field as AutoTextField} vars={vars} />
                );
              case "textarea":
                return (
                  <NHSTextareaField
                    key={field.key}
                    field={field as TextareaField}
                    value={sections[field.key] ?? ""}
                    canEdit={canEdit}
                    onChange={onChange}
                  />
                );
              case "checkbox-group": {
                const cbField = field as CheckboxGroupField;
                return (
                  <NHSCheckboxField
                    key={field.key}
                    field={cbField}
                    value={sections[field.key] ?? ""}
                    notesValue={sections[cbField.notesKey ?? ""] ?? ""}
                    canEdit={canEdit}
                    onChange={onChange}
                  />
                );
              }
              case "inline-statement":
                return (
                  <NHSInlineStatement
                    key={field.key}
                    field={field as InlineStatementField}
                    sections={sections}
                    clientName={clientName}
                    canEdit={canEdit}
                    onChange={onChange}
                  />
                );
              case "scale": {
                const sf = field as ScaleField;
                const currentVal = parseInt(sections[field.key] ?? "-1", 10);
                return (
                  <div key={field.key} style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--brand)", marginBottom: 10, lineHeight: 1.5 }}>
                      <span style={{ fontWeight: 800, marginRight: 4 }}>{sf.sectionNumber}.</span>
                      {sf.label}
                      <span style={{ fontWeight: 400, fontSize: 12, color: "var(--muted)", marginLeft: 6, fontStyle: "italic" }}>({sf.instruction})</span>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {Array.from({ length: sf.max - sf.min + 1 }, (_, i) => i + sf.min).map((n) => (
                        <button
                          key={n}
                          type="button"
                          disabled={!canEdit}
                          onClick={() => canEdit && onChange(field.key, String(n))}
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: "50%",
                            border: currentVal === n ? "2px solid var(--brand)" : "1px solid var(--muted-200)",
                            background: currentVal === n ? "var(--brand)" : "#fff",
                            color: currentVal === n ? "#fff" : "var(--ink)",
                            fontWeight: 700,
                            fontSize: 13,
                            cursor: canEdit ? "pointer" : "default",
                          }}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              }
              case "boolean":
                return (
                  <NHSBooleanField
                    key={field.key}
                    field={field as BooleanField}
                    value={sections[field.key] ?? ""}
                    canEdit={canEdit}
                    onChange={onChange}
                  />
                );
              case "table":
                return (
                  <NHSQuestionnaireTable
                    key={field.key}
                    value={sections[field.key] ?? ""}
                    canEdit={canEdit}
                    onChange={(val) => onChange(field.key, val)}
                  />
                );
              case "structured":
                return (
                  <div key={field.key}>
                    <AutoTextHeading label={fieldHeading(field.sectionNumber ?? "", field.label, field.depth ?? 1)} />
                    <NHSConnersTable
                      value={sections[field.key] ?? ""}
                      canEdit={canEdit}
                      onChange={(val) => onChange(field.key, val)}
                    /></div>
                );
              default:
                return null;
            }
          })}
        </div>
      ))}
    </div>
  );
}

// ── Main ReportEditor ─────────────────────────────────────────────────────────

type Props = {
  client: ClientRecord;
  /**
   * Role string — frontend mock cookie uses "clinic-admin" / "super-admin";
   * JWT auth uses "clinical-admin" / "super-platform-admin". Both are accepted.
   */
  userRole: string;
  currentUserId?: string;
};

export function ReportEditor({ client, userRole, currentUserId }: Props) {
  // Accept both "clinic-admin" (frontend mock cookie) and "clinical-admin" (JWT role value)
  const isReviewer = [
    "senior-clinician",
    "clinic-admin",
    "clinical-admin",
    "super-admin",
    "super-platform-admin",
  ].includes(userRole);
  const isClinician = ["clinician", "senior-clinician"].includes(userRole);
  // Admins are always read-only on clinical content — they can review/issue but never write sections
  const isAdminOnly = isReviewer && !isClinician;

  const [reports, setReports] = useState<ClinicalReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<ClinicalReport | null>(null);
  const [localSections, setLocalSections] = useState<Record<string, string>>({});
  const [localMeta, setLocalMeta] = useState({ place: "", date: "", assessed_by: "", report_type: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [err, setErr] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Smart filtered options: only show report types relevant to this client's pathway
  const reportTypeOptions = getReportOptionsForClient(client.pathway, client.age_group);
  const defaultReportType = reportTypeOptions[0] ?? "NHS Adult ADHD";
  const [newReportType, setNewReportType] = useState(defaultReportType);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewAction, setReviewAction] = useState<"approve" | "reject" | null>(null);

  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);
  const pendingSave = useRef(false);

  // ── Real-time AI suggestions ─────────────────────────────────────────────
  const [aiHint, setAiHint] = useState<{ sectionKey: string; suggestion: string } | null>(null);
  const [aiHintLoading, setAiHintLoading] = useState(false);
  const aiDebounceTimer = useRef<NodeJS.Timeout | null>(null);

  // ── Diagnostic AI support ─────────────────────────────────────────────────
  const [diagSupport, setDiagSupport] = useState<{
    suggestion: string | null;
    confidence: string;
    reasoning: string;
    next_steps: string[];
  } | null>(null);
  const [diagLoading, setDiagLoading] = useState(false);

  async function runDiagnosticSupport() {
    setDiagLoading(true);
    try {
      const r = await fetch(`/api/v1/ai/diagnostic-support`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: client.id }),
      });
      if (r.ok) setDiagSupport(await r.json() as typeof diagSupport);
    } finally { setDiagLoading(false); }
  }

  // ── Load reports ──────────────────────────────────────────────────────────

  const loadReports = useCallback(async () => {
    try {
      setLoading(true);
      const items = await fetchReportsForClient(client.id);
      setReports(items);
      if (items.length > 0 && !selectedReport) {
        const first = items[0];
        setSelectedReport(first);
        setLocalSections(first.sections ?? {});
        setLocalMeta({
          place: first.place_of_assessment ?? "",
          date: first.date_of_assessment ?? "",
          assessed_by: first.assessed_by ?? "",
          report_type: first.report_type,
        });
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load reports");
    } finally {
      setLoading(false);
    }
  }, [client.id, selectedReport]);

  useEffect(() => {
    void loadReports();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.id]);

  // ── Auto-save every 5 minutes (draft only) ────────────────────────────────

  const triggerAutoSave = useCallback(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    pendingSave.current = true;
    autoSaveTimer.current = setTimeout(() => {
      if (pendingSave.current && selectedReport?.status === "draft") {
        void doSave();
      }
    }, 5 * 60 * 1000); // 5 minutes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedReport]);

  // ── Check if template is locked (< 24h until assessment) ─────────────────

  const isLocked = (() => {
    if (!client.confirmed_session_at) return true; // no session booked yet → locked
    const sessionAt = new Date(client.confirmed_session_at);
    const now = new Date();
    const diff = sessionAt.getTime() - now.getTime();
    return diff > 24 * 60 * 60 * 1000; // locked if > 24h away
  })();

  // canEdit: only a clinician (not admin-only) can edit draft reports within the 24h unlock window
  const canEdit = isClinician && selectedReport?.status === "draft" && !isLocked;
  const canSubmit = isClinician && selectedReport?.status === "draft" && !isLocked;
  const canReview = isReviewer && selectedReport?.status === "pending";
  const canIssue = isReviewer && selectedReport?.status === "complete";

  // ── Handlers ──────────────────────────────────────────────────────────────

  function onSectionChange(key: string, value: string) {
    setLocalSections((s) => ({ ...s, [key]: value }));
    setSaveStatus("idle");
    triggerAutoSave();

    // Debounced AI suggestion: fire after 2.5s of inactivity on sections with enough content
    if (aiDebounceTimer.current) clearTimeout(aiDebounceTimer.current);
    if (value.trim().length >= 40) {
      aiDebounceTimer.current = setTimeout(() => {
        setAiHint(null);
        setAiHintLoading(true);
        void suggestReportSection(client.id, key, value)
          .then((res) => {
            if (res?.draft) {
              setAiHint({ sectionKey: key, suggestion: res.draft });
            }
          })
          .catch(() => {/* silently skip on error */})
          .finally(() => setAiHintLoading(false));
      }, 2500);
    }
  }

  async function doSave() {
    if (!selectedReport || selectedReport.status !== "draft") return;
    try {
      setSaveStatus("saving");
      pendingSave.current = false;
      const updated = await patchReport(selectedReport.id, {
        sections: localSections,
        place_of_assessment: localMeta.place || undefined,
        date_of_assessment: localMeta.date || undefined,
        assessed_by: localMeta.assessed_by || undefined,
        report_type: localMeta.report_type || undefined,
      });
      setSelectedReport(updated);
      setReports((r) => r.map((x) => (x.id === updated.id ? updated : x)));
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch (e) {
      setSaveStatus("error");
      setErr(e instanceof Error ? e.message : "Save failed");
    }
  }

  async function handleCreateReport() {
    try {
      setCreating(true);
      const r = await createReport({
        client_id: client.id,
        report_type: newReportType,
        date_of_assessment: client.confirmed_session_at
          ? new Date(client.confirmed_session_at).toISOString().slice(0, 10)
          : undefined,
        assessed_by: undefined,
      });
      setReports((prev) => [r, ...prev]);
      setSelectedReport(r);
      setLocalSections(r.sections ?? {});
      setLocalMeta({
        place: r.place_of_assessment ?? "",
        date: r.date_of_assessment ?? "",
        assessed_by: r.assessed_by ?? "",
        report_type: r.report_type,
      });
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not create report");
    } finally {
      setCreating(false);
    }
  }

  async function handleSubmit() {
    if (!selectedReport) return;
    await doSave();
    try {
      setSaving(true);
      const updated = await submitReport(selectedReport.id);
      setSelectedReport(updated);
      setReports((r) => r.map((x) => (x.id === updated.id ? updated : x)));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleReview(approved: boolean) {
    if (!selectedReport) return;
    try {
      setSaving(true);
      const updated = await reviewReport(selectedReport.id, approved, reviewComment || undefined);
      setSelectedReport(updated);
      setReports((r) => r.map((x) => (x.id === updated.id ? updated : x)));
      setReviewAction(null);
      setReviewComment("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Review action failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleIssue() {
    if (!selectedReport) return;
    try {
      setSaving(true);
      const updated = await issueReport(selectedReport.id);
      setSelectedReport(updated);
      setReports((r) => r.map((x) => (x.id === updated.id ? updated : x)));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Issue failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteDraft() {
    if (!selectedReport || selectedReport.status !== "draft") return;
    try {
      setDeleting(true);
      await deleteReport(selectedReport.id);
      const remaining = reports.filter((r) => r.id !== selectedReport.id);
      setReports(remaining);
      setSelectedReport(remaining[0] ?? null);
      setLocalSections(remaining[0]?.sections ?? {});
      setLocalMeta({
        place: remaining[0]?.place_of_assessment ?? "",
        date: remaining[0]?.date_of_assessment ?? "",
        assessed_by: remaining[0]?.assessed_by ?? "",
        report_type: remaining[0]?.report_type ?? defaultReportType,
      });
      setConfirmDelete(false);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  function selectReport(r: ClinicalReport) {
    setSelectedReport(r);
    setLocalSections(r.sections ?? {});
    setLocalMeta({
      place: r.place_of_assessment ?? "",
      date: r.date_of_assessment ?? "",
      assessed_by: r.assessed_by ?? "",
      report_type: r.report_type,
    });
    setErr(null);
    setReviewAction(null);
    setConfirmDelete(false);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const displayName = client.child_name ?? client.full_name;
  const template = getTemplateForPathway(selectedReport?.report_type ?? newReportType);

  if (loading) {
    return <div className="workspace-card-header"><p style={{ color: "var(--muted)" }}>Loading reports…</p></div>;
  }

  return (
    <div className="report-editor-shell">
      {err && (
        <p className="inline-badge status-warn" role="alert" style={{ marginBottom: 12 }}>
          {err}
        </p>
      )}

      {/* ── Report list / create ──────────────────────────────────────────── */}
      <div className="workspace-card-header" style={{ marginBottom: 16 }}>
        <div>
          <span className="panel-label">Clinical Report</span>
          <h2 style={{ margin: 0 }}>{displayName}</h2>
        </div>
        {isClinician && (
          <div className="button-strip" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {/* Only show create controls when no report exists yet */}
            {reports.length === 0 ? (
              <>
                <select
                  className="clinical-appointment-type-select"
                  value={newReportType}
                  onChange={(e) => setNewReportType(e.target.value)}
                  style={{ fontSize: 12 }}
                >
                  {reportTypeOptions.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="primary-action button-reset"
                  disabled={creating}
                  onClick={() => void handleCreateReport()}
                  style={{ fontSize: 12, padding: "0 14px" }}
                >
                  {creating ? "Creating…" : "+ New Report"}
                </button>
              </>
            ) : (
              /* One report exists — show delete option for drafts */
              selectedReport?.status === "draft" && (
                confirmDelete ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, color: "var(--danger)", fontWeight: 600 }}>
                      Delete this draft?
                    </span>
                    <button
                      type="button"
                      className="button-reset"
                      style={{ fontSize: 12, color: "#fff", background: "var(--danger)", border: "none", borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontWeight: 700 }}
                      disabled={deleting}
                      onClick={() => void handleDeleteDraft()}
                    >
                      {deleting ? "Deleting…" : "Yes, delete"}
                    </button>
                    <button
                      type="button"
                      className="ghost-chip button-reset"
                      style={{ fontSize: 12 }}
                      onClick={() => setConfirmDelete(false)}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="ghost-chip button-reset"
                    style={{ fontSize: 12, color: "var(--danger)", borderColor: "var(--danger)" }}
                    onClick={() => setConfirmDelete(true)}
                  >
                    Delete draft
                  </button>
                )
              )
            )}
          </div>
        )}
      </div>

      {reports.length === 0 ? (
        <div className="clinical-report-banner" style={{ borderRadius: 10, padding: "20px 24px" }}>
          <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>
            No reports have been started yet for this client.
            {isClinician && " Select the report type above and click + New Report to begin."}
            {isAdminOnly && " A clinician must create the first report draft."}
          </p>
          {isAdultADHDReport(newReportType) && isClinician && (
            <div style={{ marginTop: 16, opacity: 0.6, pointerEvents: "none" }}>
              <p style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Form preview (read-only)
              </p>
              <NHSAdultADHDForm
                sections={{}}
                client={client}
                localMeta={{ place: "", date: client.confirmed_session_at?.slice(0,10) ?? "", assessed_by: "", report_type: "NHS Adult ADHD" }}
                canEdit={false}
                onChange={() => {}}
              />
            </div>
          )}
        </div>
      ) : (
        <>
          {/* ── Report selector tabs ──────────────────────────────────────── */}
          {reports.length > 1 && (
            <div className="clinical-subtab-row" style={{ marginBottom: 16 }}>
              {reports.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className={`clinical-subtab button-reset ${selectedReport?.id === r.id ? "clinical-subtab-active" : ""}`}
                  onClick={() => selectReport(r)}
                  style={{ fontSize: 12 }}
                >
                  {r.report_type} <StatusBadge status={r.status} />
                </button>
              ))}
            </div>
          )}

          {selectedReport && (
            <>
              {/* ── Header info ────────────────────────────────────────────── */}
              <div className="detail-metadata portal-summary-grid" style={{ marginBottom: 16 }}>
                <article>
                  <span>Report ID</span>
                  <strong style={{ fontFamily: "monospace", fontSize: 12 }}>{selectedReport.id}</strong>
                </article>
                <article>
                  <span>Status</span>
                  <strong><StatusBadge status={selectedReport.status} /></strong>
                </article>
                <article>
                  <span>Report type</span>
                  <strong>{selectedReport.report_type}</strong>
                </article>
                <article>
                  <span>Last saved</span>
                  <strong style={{ fontSize: 12 }}>
                    {new Date(selectedReport.updated_at).toLocaleString("en-GB")}
                  </strong>
                </article>
              </div>

              {/* ── Lock / read-only notice ─────────────────────────────────── */}
              {isAdminOnly && selectedReport.status === "draft" && (
                <div
                  className="detail-callout"
                  style={{ borderColor: "var(--brand-300)", background: "var(--brand-50)", marginBottom: 16 }}
                >
                  <strong>Read-only view</strong>
                  <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--ink)" }}>
                    Clinical content is authored by the assigned clinician. As admin you can view all sections,
                    approve or return pending reports, and issue completed reports to the client.
                  </p>
                </div>
              )}
              {isLocked && !isAdminOnly && selectedReport.status === "draft" && (
                <div
                  className="detail-callout"
                  style={{ borderColor: "#f59e0b", background: "#fffbeb", marginBottom: 16 }}
                >
                  <strong>Template locked</strong>
                  <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--ink)" }}>
                    {client.confirmed_session_at
                      ? `This report becomes editable 24 hours before the assessment on ${new Date(client.confirmed_session_at).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}. Review the template in the meantime.`
                      : "A session must be booked before the report can be edited."}
                  </p>
                </div>
              )}

              {/* ── Assessment header fields ────────────────────────────────── */}
              {/* Always show for reviewer/admin and for any non-draft; only editable when canEdit */}
              {(canEdit || selectedReport.status !== "draft" || isReviewer) && (
                <div
                  className="detail-metadata portal-summary-grid"
                  style={{
                    background: "linear-gradient(135deg,rgba(29,78,216,0.04),rgba(124,92,252,0.04))",
                    border: "1px solid var(--muted-200)",
                    borderRadius: 10,
                    padding: "16px 20px",
                    marginBottom: 20,
                  }}
                >
                  <article style={{ border: "none", background: "none", boxShadow: "none", padding: 0 }}>
                    <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Patient Name
                    </span>
                    <strong style={{ fontSize: 14 }}>{displayName}</strong>
                  </article>
                  <article style={{ border: "none", background: "none", boxShadow: "none", padding: 0 }}>
                    <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Date of Assessment
                    </span>
                    {canEdit ? (
                      <input
                        type="date"
                        className="patient-table-input"
                        value={localMeta.date}
                        onChange={(e) => setLocalMeta((m) => ({ ...m, date: e.target.value }))}
                        style={{ fontSize: 13 }}
                      />
                    ) : (
                      <strong>{selectedReport.date_of_assessment || "—"}</strong>
                    )}
                  </article>
                  <article style={{ border: "none", background: "none", boxShadow: "none", padding: 0 }}>
                    <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Place of Assessment
                    </span>
                    {canEdit ? (
                      <input
                        type="text"
                        className="patient-table-input"
                        value={localMeta.place}
                        placeholder="e.g. Video (Zoom) / Clinic name / Address"
                        onChange={(e) => setLocalMeta((m) => ({ ...m, place: e.target.value }))}
                        style={{ fontSize: 13 }}
                      />
                    ) : (
                      <strong>{selectedReport.place_of_assessment || "—"}</strong>
                    )}
                  </article>
                  <article style={{ border: "none", background: "none", boxShadow: "none", padding: 0 }}>
                    <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Assessed By
                    </span>
                    {canEdit ? (
                      <input
                        type="text"
                        className="patient-table-input"
                        value={localMeta.assessed_by}
                        placeholder="Full name, qualifications, reg. number"
                        onChange={(e) => setLocalMeta((m) => ({ ...m, assessed_by: e.target.value }))}
                        style={{ fontSize: 13 }}
                      />
                    ) : (
                      <strong>{selectedReport.assessed_by || "—"}</strong>
                    )}
                  </article>
                </div>
              )}

              {/* ── Patient Information block (auto-filled, read-only) ───────── */}
              <div
                style={{
                  background: "var(--muted-100)",
                  border: "1px solid var(--muted-200)",
                  borderRadius: 10,
                  padding: "14px 18px",
                  marginBottom: 20,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 800, color: "var(--brand)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
                  1. Patient Information (auto-filled)
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: "8px 24px" }}>
                  {[
                    ["Patient Name", displayName],
                    ["Date of Birth", client.date_of_birth ?? "—"],
                    ["Address", client.address ?? "—"],
                    ["GP Name", client.gp_name ?? "—"],
                    ["GP Practice", client.gp_practice ?? "—"],
                    ["Pathway", client.pathway ?? "—"],
                  ].map(([label, val]) => (
                    <div key={label}>
                      <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
                      <div style={{ fontSize: 13, color: "var(--ink)", fontWeight: 600 }}>{val}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Diagnostic AI support panel ─────────────────────────────── */}
              {canEdit && (
                <div style={{ marginBottom: 16 }}>
                  {!diagSupport ? (
                    <button
                      type="button"
                      onClick={() => { void runDiagnosticSupport(); }}
                      disabled={diagLoading}
                      style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "8px 14px", borderRadius: 8,
                        border: "1px solid var(--brand)", background: "transparent",
                        color: "var(--brand)", cursor: "pointer", fontSize: "0.82rem", fontWeight: 700,
                      }}
                    >
                      {diagLoading ? "Analysing scores…" : "🧠 AI Diagnostic Support"}
                    </button>
                  ) : (
                    <div style={{
                      padding: "14px 16px", borderRadius: 10,
                      border: `1px solid ${diagSupport.confidence === "high" ? "#86efac" : diagSupport.confidence === "medium" ? "#fcd34d" : "#e2e8f0"}`,
                      background: diagSupport.confidence === "high" ? "#f0fdf4" : diagSupport.confidence === "medium" ? "#fffbeb" : "#f8fafc",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                        <div>
                          <div style={{ fontSize: "0.7rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--muted)", marginBottom: 2 }}>AI Diagnostic Direction</div>
                          <div style={{ fontSize: "1rem", fontWeight: 800, color: "var(--ink)" }}>
                            {diagSupport.suggestion ?? "Insufficient data"}
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{
                            fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
                            padding: "2px 8px", borderRadius: 6,
                            background: diagSupport.confidence === "high" ? "#dcfce7" : diagSupport.confidence === "medium" ? "#fef9c3" : "#f1f5f9",
                            color: diagSupport.confidence === "high" ? "#16a34a" : diagSupport.confidence === "medium" ? "#a16207" : "#64748b",
                          }}>
                            {diagSupport.confidence} confidence
                          </span>
                          <button type="button" onClick={() => setDiagSupport(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: "0.9rem" }}>✕</button>
                        </div>
                      </div>
                      <div style={{ fontSize: "0.82rem", color: "var(--ink-700)", marginBottom: 10, lineHeight: 1.5 }}>
                        {diagSupport.reasoning}
                      </div>
                      {diagSupport.next_steps.length > 0 && (
                        <div>
                          <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Suggested next steps</div>
                          <ul style={{ margin: 0, paddingLeft: 16, fontSize: "0.8rem", color: "var(--ink-700)" }}>
                            {diagSupport.next_steps.map((s, i) => <li key={i}>{s}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── Template sections ───────────────────────────────────────── */}
              {isAdultADHDReport(selectedReport.report_type) ? (
                <NHSAdultADHDForm
                  sections={localSections}
                  client={client}
                  localMeta={localMeta}
                  canEdit={canEdit}
                  onChange={onSectionChange}
                />
              ) : (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {template.sections.map((section) => (
                    <SectionField
                      key={section.key}
                      section={section}
                      value={localSections[section.key] ?? ""}
                      locked={!canEdit}
                      onChange={onSectionChange}
                    />
                  ))}
                </div>
              )}

              {/* ── Real-time AI writing hint ───────────────────────────────── */}
              {canEdit && (aiHintLoading || aiHint) && (
                <div className="rah-panel">
                  <div className="rah-header">
                    <span className="rah-label">AI writing suggestion</span>
                    {aiHintLoading && <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>Generating…</span>}
                    {aiHint && (
                      <button
                        type="button"
                        className="button-reset"
                        style={{ fontSize: "0.72rem", color: "var(--muted)" }}
                        onClick={() => setAiHint(null)}
                        aria-label="Dismiss suggestion"
                      >
                        ✕ dismiss
                      </button>
                    )}
                  </div>
                  {aiHint && (
                    <>
                      <div className="rah-body">{aiHint.suggestion}</div>
                      <div className="rah-actions">
                        <button
                          type="button"
                          className="rah-apply-btn"
                          onClick={() => {
                            onSectionChange(aiHint.sectionKey, aiHint.suggestion);
                            setAiHint(null);
                          }}
                        >
                          Apply to section
                        </button>
                        <button
                          type="button"
                          className="rah-dismiss-btn"
                          onClick={() => setAiHint(null)}
                        >
                          Keep mine
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ── Review comment (if sent back) ────────────────────────────── */}
              {selectedReport.status === "draft" && selectedReport.review_comment && (
                <div
                  className="detail-callout"
                  style={{ borderColor: "#f59e0b", background: "#fffbeb", marginBottom: 16 }}
                >
                  <strong>Returned by reviewer</strong>
                  <p style={{ margin: "4px 0 0", fontSize: 13 }}>
                    {selectedReport.reviewed_by_name && <em>{selectedReport.reviewed_by_name}: </em>}
                    {selectedReport.review_comment}
                  </p>
                </div>
              )}

              {/* ── Toolbar ──────────────────────────────────────────────────── */}
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  padding: "14px 0",
                  borderTop: "1px solid var(--muted-200)",
                  marginTop: 8,
                  flexWrap: "wrap",
                }}
              >
                {/* Auto-save indicator */}
                {saveStatus === "saving" && <span style={{ fontSize: 12, color: "var(--muted)" }}>Saving…</span>}
                {saveStatus === "saved" && <span style={{ fontSize: 12, color: "#22a76a" }}>Saved</span>}
                {saveStatus === "error" && <span style={{ fontSize: 12, color: "#dc2626" }}>Save error</span>}

                {canEdit && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: 12 }}>
                    {/* Back placeholder — keeps layout balanced */}
                    <div style={{ width: 44 }} />

                    {/* Save Draft — outlined pill, centred */}
                    <button
                      type="button"
                      className="button-reset"
                      disabled={saving || saveStatus === "saving"}
                      onClick={() => void doSave()}
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        padding: "11px 40px",
                        borderRadius: 50,
                        border: "2px solid var(--brand)",
                        color: "var(--brand)",
                        background: "#fff",
                        cursor: saving || saveStatus === "saving" ? "default" : "pointer",
                        opacity: saving || saveStatus === "saving" ? 0.6 : 1,
                        letterSpacing: "0.01em",
                      }}
                    >
                      {saveStatus === "saving" ? "Saving…" : "Save Draft"}
                    </button>

                    {/* Save & Review — filled purple pill, right-aligned */}
                    {canSubmit ? (
                      <button
                        type="button"
                        className="button-reset"
                        disabled={saving}
                        onClick={() => void handleSubmit()}
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          padding: "11px 32px",
                          borderRadius: 50,
                          border: "none",
                          color: "#fff",
                          background: "var(--brand)",
                          cursor: saving ? "default" : "pointer",
                          opacity: saving ? 0.7 : 1,
                          letterSpacing: "0.01em",
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        {saving ? "Submitting…" : <><span>Save & Review</span><span style={{ fontSize: 16, marginLeft: 2 }}>›</span></>}
                      </button>
                    ) : (
                      <div style={{ width: 160 }} />
                    )}
                  </div>
                )}

                {/* Pending: review actions (senior/admin) */}
                {canReview && !reviewAction && (
                  <>
                    <button
                      type="button"
                      className="primary-action button-reset"
                      style={{ background: "#22a76a", borderColor: "#22a76a" }}
                      onClick={() => setReviewAction("approve")}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="ghost-chip button-reset"
                      style={{ borderColor: "#dc2626", color: "#dc2626" }}
                      onClick={() => setReviewAction("reject")}
                    >
                      Return to clinician
                    </button>
                  </>
                )}

                {reviewAction && (
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <input
                      type="text"
                      className="patient-table-input"
                      style={{ minWidth: 260, fontSize: 13 }}
                      placeholder={reviewAction === "approve" ? "Optional approval note" : "Reason for returning (required)"}
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                    />
                    <button
                      type="button"
                      className="primary-action button-reset"
                      disabled={saving || (reviewAction === "reject" && !reviewComment.trim())}
                      style={reviewAction === "approve" ? { background: "#22a76a", borderColor: "#22a76a" } : undefined}
                      onClick={() => void handleReview(reviewAction === "approve")}
                    >
                      {saving ? "…" : reviewAction === "approve" ? "Confirm approve" : "Confirm return"}
                    </button>
                    <button
                      type="button"
                      className="ghost-chip button-reset"
                      onClick={() => setReviewAction(null)}
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {/* Complete: issue */}
                {canIssue && (
                  <button
                    type="button"
                    className="primary-action button-reset"
                    disabled={saving}
                    onClick={() => void handleIssue()}
                  >
                    {saving ? "Issuing…" : "Issue report to client"}
                  </button>
                )}

                {/* Issued: PDF download */}
                {selectedReport.status === "issued" && (
                  <a
                    href={reportPdfUrl(selectedReport.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ghost-chip"
                    style={{ fontSize: 12 }}
                  >
                    Download PDF
                  </a>
                )}
                {(selectedReport.status === "complete" || selectedReport.status === "pending") && (
                  <a
                    href={reportPdfUrl(selectedReport.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ghost-chip"
                    style={{ fontSize: 12 }}
                  >
                    Preview PDF
                  </a>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
