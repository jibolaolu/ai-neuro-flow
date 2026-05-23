"use client";

/**
 * ClientFormsPanel - shows all sent/received forms for a client.
 * Visible to clinician, senior-clinician, and clinical-admin.
 * AI scores and predictions are NOT shown here (admin-only via AiClinicalReportCard).
 *
 * Props:
 *   clientId - the client record ID
 *   forms    - FormTokenOut[] already fetched server-side (status + metadata)
 */

import { useState } from "react";
import { FormResponseModal } from "./form-response-modal";

// ── Types ────────────────────────────────────────────────────────────────────

type FormSummary = {
  id: string;
  token: string;
  form_type: string;
  form_label: string;
  recipient_email: string | null;
  recipient_name: string | null;
  status: string;
  sent_at: string | null;
  submitted_at: string | null;
};

// ── Instrument content map ───────────────────────────────────────────────────

const FORM_INSTRUMENTS: Record<string, string[]> = {
  adult_self:         ["ASRS-v1.1 (ADHD)", "PHQ-9 (Depression)", "GAD-7 (Anxiety)", "WFIRS-S (Functional Impairment)"],
  child_parent:       ["SDQ Parent-Report", "Conners Parent Rating Scale (CPRS)"],
  adolescent_self:    ["SDQ Self-Report", "ASRS Adolescent", "PHQ-A (Depression)", "GAD-7 (Anxiety)"],
  child_teacher:      ["Conners Teacher Rating Scale (CTRS)"],
  adolescent_teacher: ["Conners Teacher Rating Scale (CTRS)"],
  basic_intake:       ["Personal & contact details", "Consent"],
  adult_gp:           ["GP background information request"],
  child_gp:           ["GP background information request"],
  adolescent_gp:      ["GP background information request"],
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  submitted: "Received",
  reminded: "Reminded - not returned",
  pending: "Awaiting completion",
};

const STATUS_CLASS: Record<string, string> = {
  submitted: "status-good",
  reminded: "status-warn",
  pending: "status-neutral",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "not set";
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

// ── Form row ─────────────────────────────────────────────────────────────────

function FormRow({
  form,
  onViewFull,
}: {
  form: FormSummary;
  onViewFull: (formId: string, formLabel: string) => void;
}) {
  const isSubmitted = form.status === "submitted";

  return (
    <div style={{
      border: "1px solid var(--card-border)",
      borderRadius: 8,
      marginBottom: 10,
      overflow: "hidden",
      background: "var(--card-bg)",
    }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr auto auto",
        gap: 12,
        padding: "12px 16px",
        alignItems: "center",
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)" }}>{form.form_label}</div>

          {/* Instrument chips */}
          {(FORM_INSTRUMENTS[form.form_type] ?? []).length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
              {(FORM_INSTRUMENTS[form.form_type] ?? []).map((instrument) => (
                <span
                  key={instrument}
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "1px 7px",
                    borderRadius: 10,
                    background: "var(--brand-50, #eff6ff)",
                    color: "var(--brand, #1d4ed8)",
                    border: "1px solid var(--brand-100, #bfdbfe)",
                    letterSpacing: "0.01em",
                  }}
                >
                  {instrument}
                </span>
              ))}
            </div>
          )}

          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
            To: {form.recipient_email ?? "not set"}
            {form.recipient_name && ` (${form.recipient_name})`}
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>
            Sent {fmtDate(form.sent_at)}
            {form.submitted_at && ` · Received ${fmtDate(form.submitted_at)}`}
          </div>
        </div>

        <span className={`inline-badge ${STATUS_CLASS[form.status] ?? "status-neutral"}`}>
          {STATUS_LABEL[form.status] ?? form.status}
        </span>

        {isSubmitted && (
          <button
            type="button"
            className="ghost-chip button-reset"
            style={{ fontSize: 12 }}
            onClick={() => onViewFull(form.id, form.form_label)}
          >
            View full Q&amp;A
          </button>
        )}
      </div>
    </div>
  );
}

// ── Public component ─────────────────────────────────────────────────────────

export function ClientFormsPanel({ forms }: { forms: FormSummary[] }) {
  const [modalFormId, setModalFormId] = useState<string | null>(null);
  const [modalFormLabel, setModalFormLabel] = useState<string>("");

  function openModal(formId: string, formLabel: string) {
    setModalFormId(formId);
    setModalFormLabel(formLabel);
  }

  function closeModal() {
    setModalFormId(null);
    setModalFormLabel("");
  }

  if (forms.length === 0) {
    return (
      <p style={{ color: "var(--muted)", fontSize: 14 }}>No forms dispatched yet for this client.</p>
    );
  }

  const submitted = forms.filter((f) => f.status === "submitted");
  const pending = forms.filter((f) => f.status !== "submitted");

  return (
    <div>
      {submitted.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)", marginBottom: 10 }}>
            Received forms ({submitted.length})
          </div>
          {submitted.map((f) => (
            <FormRow key={f.id} form={f} onViewFull={openModal} />
          ))}
        </div>
      )}
      {pending.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)", marginBottom: 10 }}>
            Awaiting / outstanding forms ({pending.length})
          </div>
          {pending.map((f) => (
            <FormRow key={f.id} form={f} onViewFull={openModal} />
          ))}
        </div>
      )}

      {/* Full Q&A Modal */}
      {modalFormId && (
        <FormResponseModal
          formId={modalFormId}
          formLabel={modalFormLabel}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
