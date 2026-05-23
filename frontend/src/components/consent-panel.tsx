"use client";

import { useEffect, useRef, useState } from "react";

import type { ClientRecord } from "../lib/api";
import { BRAND } from "../lib/branding";
import { fetchConsent, saveConsent } from "../lib/consent-api";

const CLINIC_NAME = BRAND.name;

// ── Consent item definitions ──────────────────────────────────────────────────

type ConsentItem = {
  key: string;
  label: string;
  description: string;
  section: "private" | "keep_in_touch" | "nhs";
};

const CONSENT_ITEMS: ConsentItem[] = [
  // Private / Core
  {
    key: "gdpr_data_processing",
    label: "GDPR Data Processing",
    description:
      `I consent to my personal data being collected, stored, and processed by ${CLINIC_NAME} for the purpose of providing neurodevelopmental assessment and clinical services, in accordance with the UK GDPR and Data Protection Act 2018.`,
    section: "private",
  },
  {
    key: "consent_to_care",
    label: "Consent to Care",
    description:
      "I consent to the assessment and care services described in my referral, including clinical interviews, standardised assessments, and the preparation of a clinical report.",
    section: "private",
  },
  {
    key: "share_with_gp",
    label: "Share with GP",
    description:
      `I consent to ${CLINIC_NAME} sharing a copy of the assessment report and relevant clinical information with my General Practitioner (GP) or referring clinician.`,
    section: "private",
  },
  {
    key: "contact_school",
    label: "Contact School / Employer",
    description:
      `I consent to ${CLINIC_NAME} contacting my school, college, university, or employer to gather supporting information relevant to my assessment, where clinically appropriate.`,
    section: "private",
  },
  // Keep in touch
  {
    key: "keep_in_touch_email",
    label: "Email",
    description:
      `I am happy to receive service updates, appointment reminders, and relevant resources from ${CLINIC_NAME} by email.`,
    section: "keep_in_touch",
  },
  {
    key: "keep_in_touch_sms",
    label: "SMS / Text message",
    description: `I am happy to receive appointment reminders and brief service updates from ${CLINIC_NAME} by SMS.`,
    section: "keep_in_touch",
  },
  // NHS
  {
    key: "nhs_share",
    label: "NHS Data Sharing",
    description:
      `I consent to ${CLINIC_NAME} sharing relevant assessment outcomes and diagnostic information with NHS England services and integrated care boards (ICBs) where this is required for NHS-funded pathways or onward referral.`,
    section: "nhs",
  },
  {
    key: "nhs_consent_to_care",
    label: "NHS Consent to Care",
    description:
      "I understand this assessment has been arranged under an NHS Right to Choose or ICB-funded pathway and I consent to the relevant NHS framework governing this care.",
    section: "nhs",
  },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function ConsentToggle({
  item,
  value,
  onChange,
  disabled,
}: {
  item: ConsentItem;
  value: boolean;
  onChange: (key: string, v: boolean) => void;
  disabled: boolean;
}) {
  return (
    <div className={`consent-item-row ${value ? "consent-item-row--on" : ""}`}>
      <div className="consent-item-body">
        <span className="consent-item-label">{item.label}</span>
        <p className="consent-item-desc">{item.description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        disabled={disabled}
        className={`consent-toggle ${value ? "consent-toggle--on" : ""}`}
        onClick={() => onChange(item.key, !value)}
        aria-label={`${value ? "Withdraw" : "Grant"} consent for ${item.label}`}
      >
        <span className="consent-toggle-thumb" />
        <span className="consent-toggle-label">{value ? "Consented" : "Not consented"}</span>
      </button>
    </div>
  );
}

function ConsentSection({
  title,
  subtitle,
  items,
  consents,
  onChange,
  disabled,
}: {
  title: string;
  subtitle?: string;
  items: ConsentItem[];
  consents: Record<string, boolean>;
  onChange: (key: string, v: boolean) => void;
  disabled: boolean;
}) {
  return (
    <div className="consent-section">
      <div className="consent-section-header">
        <h3 className="consent-section-title">{title}</h3>
        {subtitle ? <p className="consent-section-sub">{subtitle}</p> : null}
      </div>
      <div className="consent-item-list">
        {items.map((item) => (
          <ConsentToggle
            key={item.key}
            item={item}
            value={!!consents[item.key]}
            onChange={onChange}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type SaveState = "idle" | "saving" | "saved" | "error";

export function ConsentPanel({ client }: { client: ClientRecord }) {
  const [consents, setConsents] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load on mount
  useEffect(() => {
    setLoading(true);
    fetchConsent(client.id)
      .then((rec) => {
        setConsents(rec.consents ?? {});
        setLastUpdated(rec.updated_at ?? null);
      })
      .catch(() => {
        // If no record yet, start with empty
        setConsents({});
      })
      .finally(() => setLoading(false));
  }, [client.id]);

  function handleChange(key: string, value: boolean) {
    setConsents((prev) => ({ ...prev, [key]: value }));
    setSaveState("idle");

    // Debounce auto-save by 1.5 seconds
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => doSave({ ...consents, [key]: value }), 1500);
  }

  async function doSave(data: Record<string, boolean>) {
    setSaveState("saving");
    setErrorMsg(null);
    try {
      const rec = await saveConsent(client.id, data);
      setConsents(rec.consents ?? data);
      setLastUpdated(rec.updated_at ?? new Date().toISOString());
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2500);
    } catch (e) {
      setSaveState("error");
      setErrorMsg(e instanceof Error ? e.message : "Save failed");
    }
  }

  async function handleSaveAll() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    await doSave(consents);
  }

  const displayName = client.child_name ?? client.full_name;
  const isNhsPathway =
    client.pathway?.toLowerCase().includes("nhs") || client.paid_service_name?.toLowerCase().includes("nhs");

  const privateItems = CONSENT_ITEMS.filter((i) => i.section === "private");
  const kitItems = CONSENT_ITEMS.filter((i) => i.section === "keep_in_touch");
  const nhsItems = CONSENT_ITEMS.filter((i) => i.section === "nhs");

  return (
    <div className="consent-panel-shell">
      {/* Header */}
      <div className="consent-panel-header">
        <div>
          <span className="panel-label">Consent record</span>
          <h2>{displayName}</h2>
          <p className="consent-panel-meta">
            Consent preferences for this client. Changes auto-save after 1.5 seconds.
            {lastUpdated
              ? ` Last updated: ${new Date(lastUpdated).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}.`
              : " No record yet."}
          </p>
        </div>
        <div className="consent-panel-actions">
          <button
            type="button"
            className="primary-action"
            disabled={saveState === "saving" || loading}
            onClick={handleSaveAll}
          >
            {saveState === "saving" ? "Saving…" : "Save consents"}
          </button>
          {saveState === "saved" && (
            <span className="inline-badge status-good" style={{ alignSelf: "center" }}>
              Saved
            </span>
          )}
          {saveState === "error" && (
            <span className="inline-badge status-risk" style={{ alignSelf: "center" }}>
              {errorMsg ?? "Error"}
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="consent-loading">
          <span className="loading-spinner" aria-label="Loading consent record…" />
          <span>Loading consent record…</span>
        </div>
      ) : (
        <div className="consent-sections-stack">
          {/* Private / Core section */}
          <ConsentSection
            title="Private Assessment Consent"
            subtitle={`Core consents required for ${CLINIC_NAME} private assessment services.`}
            items={privateItems}
            consents={consents}
            onChange={handleChange}
            disabled={saveState === "saving"}
          />

          {/* Keep in touch */}
          <ConsentSection
            title="Keep in Touch — Channel Preferences"
            subtitle="How the client is happy to be contacted for service updates and reminders."
            items={kitItems}
            consents={consents}
            onChange={handleChange}
            disabled={saveState === "saving"}
          />

          {/* NHS section — shown when pathway is NHS, or always for staff */}
          <ConsentSection
            title={isNhsPathway ? "NHS Pathway Consent" : "NHS Consent (if applicable)"}
            subtitle={
              isNhsPathway
                ? "Additional consents required for NHS Right to Choose or ICB-funded pathways."
                : "These consents apply if the client transitions to or is part of an NHS-funded pathway."
            }
            items={nhsItems}
            consents={consents}
            onChange={handleChange}
            disabled={saveState === "saving"}
          />

          {/* Consent summary */}
          <div className="consent-summary-card mini-card">
            <h3>Consent summary</h3>
            <div className="consent-summary-grid">
              {CONSENT_ITEMS.map((item) => (
                <div key={item.key} className="consent-summary-row">
                  <span
                    className={`consent-summary-dot ${consents[item.key] ? "consent-summary-dot--on" : "consent-summary-dot--off"}`}
                    aria-hidden
                  />
                  <span className="consent-summary-label">{item.label}</span>
                  <span className={`inline-badge ${consents[item.key] ? "status-good" : "status-neutral"}`}>
                    {consents[item.key] ? "Yes" : "No"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
