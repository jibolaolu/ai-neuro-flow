"use client";

import { useState } from "react";

import type { ClientRecord } from "../lib/api";

// ── Personal Details Editor ────────────────────────────────────────────────

export function PersonalDetailsEditor({ client }: { client: ClientRecord }) {
  const [isEditing, setIsEditing] = useState(false);
  const [formState, setFormState] = useState({
    name: client.child_name ?? client.full_name,
    preferredName: "",
    previousName: "",
    dob: client.date_of_birth ?? client.child_dob ?? "",
    gender: "",
    pronouns: "",
    nhsNumber: "",
    registeredGp: client.gp_name ?? "",
    practice: client.gp_practice ?? "",
    personalisedCare: "",
    youngCarer: "No",
    lookedAfterChild: "No",
    parentalResponsibilities: "",
    consentStorage: "",
    consentFlow: "",
    additionalConsent: "",
    address: client.address ?? "",
    accommodationType: "",
    homePhone: "",
    mobilePhone: client.phone ?? client.parent_guardian_phone ?? "",
    smsAllowed: "Yes",
    workPhone: "",
    email: client.email,
    emergencyFirstName: "",
    emergencyLastName: "",
    emergencyRelationship: "",
    emergencyTelephone: "",
    emergencyNotes: "",
    nationality: "",
    ethnicGroup: client.ethnicity ?? "",
    religiousGroup: client.religion_group ?? "",
    preferredLanguage: client.preferred_language ?? "",
    spokenEnglish: "",
    sexuality: "",
    relationshipStatus: "",
    longTermConditions: client.pathway ?? "",
    autismStatus: "",
    learningDisability: "",
    occupation: client.occupation ?? "",
    disability: "",
    disabilityImpact: "",
    disabilityNotes: "",
    school: client.school_name ?? "",
    teacher: client.teacher_name ?? "",
    senco: "",
    homeEducated: "",
    armedForces: "",
    accessibilityStatus: "",
    communicationSupport: "",
    specificContactMethods: "",
    informationFormats: "",
    accessibilityNotes: "",
    reasonableAdjustment: "",
  });

  const multiline = new Set(["practice", "personalisedCare", "address", "emergencyNotes",
    "longTermConditions", "disabilityImpact", "disabilityNotes", "accessibilityNotes",
    "communicationSupport", "informationFormats"]);

  const sections = [
    {
      title: "General Patient Information",
      fields: [
        ["Name", "name"], ["Preferred Name", "preferredName"], ["Maiden / Previous Name", "previousName"],
        ["Date of Birth", "dob"], ["Gender", "gender"], ["Pronouns", "pronouns"],
        ["NHS Number", "nhsNumber"], ["Registered GP", "registeredGp"],
        ["Registered GP Practice", "practice"], ["Personalised Care", "personalisedCare"],
        ["Young Carer Indicator", "youngCarer"], ["Looked After Child Status", "lookedAfterChild"],
        ["Parental Responsibilities", "parentalResponsibilities"],
      ],
    },
    {
      title: "Consent Details",
      fields: [
        ["Consent for Data Storage", "consentStorage"],
        ["Consent for Data to Flow to DoH", "consentFlow"],
        ["Additional Consent Info", "additionalConsent"],
      ],
    },
    {
      title: "Address Details",
      fields: [["Address", "address"], ["Accommodation Type", "accommodationType"]],
    },
    {
      title: "Contact Details",
      fields: [
        ["Home Phone", "homePhone"], ["Mobile Phone", "mobilePhone"],
        ["SMS Allowed?", "smsAllowed"], ["Work Phone", "workPhone"], ["Email", "email"],
      ],
    },
    {
      title: "Emergency Contact Details",
      fields: [
        ["Emergency Contact First Name", "emergencyFirstName"],
        ["Emergency Contact Last Name", "emergencyLastName"],
        ["Emergency Contact Relationship", "emergencyRelationship"],
        ["Emergency Telephone", "emergencyTelephone"],
        ["Emergency Contact Notes", "emergencyNotes"],
      ],
    },
    {
      title: "Demographics",
      fields: [
        ["Nationality", "nationality"], ["Ethnic Group", "ethnicGroup"],
        ["Religious Group", "religiousGroup"], ["Preferred Language", "preferredLanguage"],
        ["Communicates in Spoken English?", "spokenEnglish"], ["Sexuality", "sexuality"],
        ["Relationship Status", "relationshipStatus"], ["Long Term Conditions", "longTermConditions"],
        ["Autism Diagnosis Status", "autismStatus"], ["Learning Disability Status", "learningDisability"],
        ["Occupation", "occupation"],
      ],
    },
    {
      title: "Disability Information",
      fields: [
        ["Disability", "disability"], ["Disability Impact", "disabilityImpact"],
        ["Disability Notes", "disabilityNotes"],
      ],
    },
    {
      title: "Education Details",
      fields: [
        ["School", "school"], ["Teacher", "teacher"], ["SENCO", "senco"], ["Home Educated", "homeEducated"],
      ],
    },
    {
      title: "Military Details",
      fields: [["British Armed Forces Indicator", "armedForces"]],
    },
    {
      title: "Accessibility",
      fields: [
        ["Accessibility Information Status", "accessibilityStatus"],
        ["Requires Communication Support", "communicationSupport"],
        ["Specific Information Formats", "informationFormats"],
        ["Accessibility Information Notes", "accessibilityNotes"],
        ["Requires Reasonable Adjustment?", "reasonableAdjustment"],
      ],
    },
  ];

  return (
    <article className="mini-card patient-registration-shell">
      <div className="workspace-card-header">
        <div>
          <span className="panel-label">Patient Details</span>
          <h3>Editable registration and demographic record</h3>
        </div>
        <div className="button-strip">
          <button className="ghost-chip button-reset" onClick={() => setIsEditing((v) => !v)} type="button">
            {isEditing ? "Stop editing" : "Edit"}
          </button>
          <button className="primary-action button-reset" type="button">Save personal details</button>
        </div>
      </div>
      <p className="registration-note">
        Core details auto-populated from payment and submitted intake forms. Complete remaining fields as information becomes available.
      </p>
      <div className="patient-registration-grid">
        {sections.map((section) => (
          <section className="patient-section-card" key={section.title}>
            <div className="patient-section-heading">{section.title}</div>
            <div className="patient-section-table">
              {section.fields.map(([label, key]) => {
                const value = formState[key as keyof typeof formState];
                return (
                  <div className="patient-table-row" key={label}>
                    <strong>{label}</strong>
                    {isEditing ? (
                      multiline.has(key) ? (
                        <textarea
                          className="patient-table-textarea"
                          onChange={(e) => setFormState((s) => ({ ...s, [key]: e.target.value }))}
                          rows={3}
                          value={String(value)}
                        />
                      ) : (
                        <input
                          className="patient-table-input"
                          onChange={(e) => setFormState((s) => ({ ...s, [key]: e.target.value }))}
                          type="text"
                          value={String(value)}
                        />
                      )
                    ) : (
                      <span>{String(value) || "-"}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}


// ── Referral Data Panel ────────────────────────────────────────────────────

export function ReferralDataPanel({ client }: { client: ClientRecord }) {
  const receivedDate = client.created_at
    ? new Date(client.created_at).toLocaleDateString("en-GB")
    : "-";

  const sections = [
    {
      title: "Dates & Service",
      rows: [
        ["Date Received", receivedDate],
        ["Service", "Neuro Flow ADHD / Autism Pathway"],
        ["Team", "Neurodevelopment Team"],
        ["Team Type", client.age_group === "Child" ? "Child ADHD & Autism" : "Adult ADHD & Autism"],
      ],
    },
    {
      title: "Referral Source",
      rows: [
        ["Referral Source", client.source ?? "-"],
        ["Referring Care Professional Staff Group", "-"],
        ["Referral GP", client.gp_name ?? "-"],
        ["Referral GP Practice", client.gp_practice ?? "-"],
      ],
    },
    {
      title: "CYP Information",
      rows: [
        ["Local Authority", client.age_group === "Child" ? "-" : "N/A"],
        ["Tier of Service", client.age_group === "Child" ? "CAMHS / RTC" : "Adult RTC"],
        ["CAMHS Action", client.age_group === "Child" ? "-" : "N/A"],
      ],
    },
    {
      title: "Referral Notes",
      rows: [
        ["Clinical Response Priority Type", "Routine"],
        ["Primary Reason for Referral", client.pathway ?? "-"],
        ["Other Reason for Referral", "-"],
        ["Referral Accepted", "Yes"],
        ["Notes", "-"],
      ],
    },
  ];

  return (
    <article className="mini-card patient-registration-shell">
      <div className="workspace-card-header">
        <div>
          <span className="panel-label">Referral Data</span>
          <h3>Referral source, service, and intake context</h3>
        </div>
      </div>
      <div className="referral-stage-strip">
        <strong>CURRENT STAGE:</strong>
        <span>{client.status}</span>
        <strong>Stage:</strong>
        <span>{client.stage}</span>
      </div>
      <p className="registration-note">
        Referral data auto-populated from payment and intake submissions. Update remaining referral details as they are received.
      </p>
      <div className="patient-registration-grid">
        {sections.map((section) => (
          <section className="patient-section-card" key={section.title}>
            <div className="patient-section-heading">{section.title}</div>
            <div className="patient-section-table">
              {section.rows.map(([label, value]) => (
                <div className="patient-table-row" key={label}>
                  <strong>{label}</strong>
                  <span>{value || "-"}</span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}


// ── Risk Assessment Panel ──────────────────────────────────────────────────

export function RiskAssessmentPanel({ client }: { client: ClientRecord }) {
  const [riskRating, setRiskRating] = useState("Risk not assessed");
  const [problemSummary, setProblemSummary] = useState("");
  const [patientExpectation, setPatientExpectation] = useState("");
  const [riskSummary, setRiskSummary] = useState("");
  const [managementPlan, setManagementPlan] = useState("");

  return (
    <article className="mini-card risk-form-shell">
      <div className="workspace-card-header">
        <div>
          <span className="panel-label">Risk Assessment</span>
          <h3>Assessment summary and risk form - {client.full_name}</h3>
        </div>
        <button className="primary-action button-reset" type="button">Save assessment form</button>
      </div>
      <p className="registration-note">
        Complete this form during or after the clinical assessment. It can be updated by clinic admin as information is clarified.
      </p>
      <div className="risk-form-grid">
        <label className="risk-field">
          <span>Problem Summary</span>
          <textarea onChange={(e) => setProblemSummary(e.target.value)} placeholder="Describe the presenting problem..." rows={5} value={problemSummary} />
        </label>
        <label className="risk-field">
          <span>Patient Expectation</span>
          <textarea onChange={(e) => setPatientExpectation(e.target.value)} placeholder="What does the patient hope to achieve..." rows={5} value={patientExpectation} />
        </label>
      </div>
      <div className="risk-rating-group">
        <span>Risk Rating</span>
        <div className="risk-rating-options">
          {["Risk not assessed", "High", "Medium", "Low", "No Risk"].map((option) => (
            <label className="risk-radio" key={option}>
              <input checked={riskRating === option} name="risk-rating" onChange={() => setRiskRating(option)} type="radio" />
              <span>{option}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="risk-form-grid risk-form-grid-single">
        <label className="risk-field">
          <span>Risk Summary</span>
          <textarea onChange={(e) => setRiskSummary(e.target.value)} placeholder="Summary of identified risks..." rows={6} value={riskSummary} />
        </label>
        <label className="risk-field">
          <span>Management Plan</span>
          <textarea onChange={(e) => setManagementPlan(e.target.value)} placeholder="Agreed risk management steps..." rows={6} value={managementPlan} />
        </label>
      </div>
    </article>
  );
}
