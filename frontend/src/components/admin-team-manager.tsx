"use client";

import { useState } from "react";

/* ── Types ─────────────────────────────────────────────────────────────── */
type TeamMember = {
  id: string;
  title: string;
  firstName: string;
  lastName: string;
  preferredName: string;
  dateOfBirth: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  county: string;
  postcode: string;
  jobTitle: string;
  roleType: string;
  contractType: string;
  startDate: string;
  regBody: string;
  regNumber: string;
  regExpiry: string;
  status: "Active" | "Pending";
};

const EMPTY_FORM: Omit<TeamMember, "id" | "status"> = {
  title: "",
  firstName: "",
  lastName: "",
  preferredName: "",
  dateOfBirth: "",
  email: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  county: "",
  postcode: "",
  jobTitle: "Clinician",
  roleType: "clinician",
  contractType: "Full-time",
  startDate: "",
  regBody: "",
  regNumber: "",
  regExpiry: "",
};

const ROLE_TYPE_LABELS: Record<string, string> = {
  "clinician":          "Clinician",
  "senior-clinician":   "Senior Clinician",
  "clinic-admin":       "Clinical Admin",
};

/* ── Helper ─────────────────────────────────────────────────────────────── */
function fullName(m: Pick<TeamMember, "title" | "firstName" | "lastName">) {
  return [m.title, m.firstName, m.lastName].filter(Boolean).join(" ");
}

/* ── Section heading ────────────────────────────────────────────────────── */
function SectionHeading({ number, label }: { number: number; label: string }) {
  return (
    <div className="tm-section-heading">
      <span className="tm-section-num">{number}</span>
      <span className="tm-section-label">{label}</span>
    </div>
  );
}

/* ── Field row helpers ──────────────────────────────────────────────────── */
function FieldRow({ children }: { children: React.ReactNode }) {
  return <div className="tm-field-row">{children}</div>;
}

function Field({
  id,
  label,
  required,
  hint,
  children,
  span,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
  span?: "half" | "third" | "quarter" | "full";
}) {
  return (
    <div className={`tm-field tm-field-${span ?? "half"}`}>
      <label htmlFor={id}>
        {label}
        {required && <span className="tm-required" aria-hidden>*</span>}
      </label>
      {children}
      {hint && <small className="tm-hint">{hint}</small>}
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────────────── */
export function AdminTeamManager({
  initialTeam,
}: {
  initialTeam: TeamMember[];
}) {
  const [team, setTeam]   = useState<TeamMember[]>(initialTeam);
  const [form, setForm]   = useState(EMPTY_FORM);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  function set<K extends keyof typeof EMPTY_FORM>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function validate(): string[] {
    const errs: string[] = [];
    if (!form.firstName.trim()) errs.push("First name is required.");
    if (!form.lastName.trim())  errs.push("Last name is required.");
    if (!form.email.trim())     errs.push("Work email is required.");
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errs.push("Please enter a valid email address.");
    if (form.postcode && !/^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i.test(form.postcode.trim()))
      errs.push("Please enter a valid UK postcode (e.g. SW1A 1AA).");
    if (!form.jobTitle.trim()) errs.push("Job title is required.");
    if (!form.roleType)        errs.push("Role type is required.");
    return errs;
  }

  function handleAdd() {
    const errs = validate();
    if (errs.length) { setErrors(errs); return; }
    setErrors([]);

    setTeam((prev) => [
      {
        ...form,
        id: `TM-${Date.now()}`,
        status: "Pending",
      },
      ...prev,
    ]);
    setForm(EMPTY_FORM);
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  }

  function removeMember(id: string) {
    setTeam((prev) => prev.filter((m) => m.id !== id));
  }

  return (
    <section className="workspace-grid">

      {/* ── Left: form ── */}
      <article className="workspace-card">
        <div className="workspace-card-header">
          <div>
            <span className="panel-label">Add Team Member</span>
            <h2>New staff record</h2>
          </div>
        </div>

        {/* Error summary */}
        {errors.length > 0 && (
          <div className="tm-error-summary" role="alert">
            <strong>Please correct the following before continuing:</strong>
            <ul>
              {errors.map((e) => <li key={e}>{e}</li>)}
            </ul>
          </div>
        )}

        {submitted && (
          <div className="tm-success" role="status">
            ✓ Team member added successfully.
          </div>
        )}

        {/* ── Section 1: Personal details ── */}
        <SectionHeading number={1} label="Personal details" />

        <FieldRow>
          <Field id="tm-title" label="Title" span="quarter">
            <select id="tm-title" value={form.title} onChange={(e) => set("title", e.target.value)}>
              <option value="">— Select —</option>
              <option>Dr</option>
              <option>Prof</option>
              <option>Mr</option>
              <option>Mrs</option>
              <option>Ms</option>
              <option>Miss</option>
              <option>Mx</option>
            </select>
          </Field>

          <Field id="tm-first-name" label="First name" required span="half">
            <input
              id="tm-first-name"
              type="text"
              autoComplete="given-name"
              value={form.firstName}
              onChange={(e) => set("firstName", e.target.value)}
              placeholder="First name"
            />
          </Field>

          <Field id="tm-last-name" label="Last name" required span="half">
            <input
              id="tm-last-name"
              type="text"
              autoComplete="family-name"
              value={form.lastName}
              onChange={(e) => set("lastName", e.target.value)}
              placeholder="Last name"
            />
          </Field>
        </FieldRow>

        <FieldRow>
          <Field id="tm-preferred" label="Preferred name" hint="If different from first name" span="half">
            <input
              id="tm-preferred"
              type="text"
              value={form.preferredName}
              onChange={(e) => set("preferredName", e.target.value)}
              placeholder="e.g. Alex"
            />
          </Field>

          <Field id="tm-dob" label="Date of birth" span="half">
            <input
              id="tm-dob"
              type="date"
              value={form.dateOfBirth}
              onChange={(e) => set("dateOfBirth", e.target.value)}
            />
          </Field>
        </FieldRow>

        {/* ── Section 2: Contact information ── */}
        <SectionHeading number={2} label="Contact information" />

        <FieldRow>
          <Field id="tm-email" label="Work email" required span="half">
            <input
              id="tm-email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="name@clinic.co.uk"
            />
          </Field>

          <Field id="tm-phone" label="Mobile / direct phone" span="half">
            <input
              id="tm-phone"
              type="tel"
              autoComplete="tel"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="07700 000000"
            />
          </Field>
        </FieldRow>

        <FieldRow>
          <Field id="tm-addr1" label="Address line 1" span="full">
            <input
              id="tm-addr1"
              type="text"
              autoComplete="address-line1"
              value={form.addressLine1}
              onChange={(e) => set("addressLine1", e.target.value)}
              placeholder="House number and street name"
            />
          </Field>
        </FieldRow>

        <FieldRow>
          <Field id="tm-addr2" label="Address line 2" span="full">
            <input
              id="tm-addr2"
              type="text"
              autoComplete="address-line2"
              value={form.addressLine2}
              onChange={(e) => set("addressLine2", e.target.value)}
              placeholder="Flat, suite, building (optional)"
            />
          </Field>
        </FieldRow>

        <FieldRow>
          <Field id="tm-city" label="Town / city" span="third">
            <input
              id="tm-city"
              type="text"
              autoComplete="address-level2"
              value={form.city}
              onChange={(e) => set("city", e.target.value)}
              placeholder="e.g. Manchester"
            />
          </Field>

          <Field id="tm-county" label="County" span="third">
            <input
              id="tm-county"
              type="text"
              value={form.county}
              onChange={(e) => set("county", e.target.value)}
              placeholder="e.g. Greater Manchester"
            />
          </Field>

          <Field id="tm-postcode" label="Postcode" span="third" hint="UK format e.g. M1 1AE">
            <input
              id="tm-postcode"
              type="text"
              autoComplete="postal-code"
              value={form.postcode}
              onChange={(e) => set("postcode", e.target.value.toUpperCase())}
              placeholder="SW1A 1AA"
              style={{ textTransform: "uppercase" }}
            />
          </Field>
        </FieldRow>

        {/* ── Section 3: Employment details ── */}
        <SectionHeading number={3} label="Employment details" />

        <FieldRow>
          <Field id="tm-job-title" label="Job title" required span="half">
            <select
              id="tm-job-title"
              value={form.jobTitle}
              onChange={(e) => set("jobTitle", e.target.value)}
            >
              <optgroup label="Clinical">
                <option>Consultant Psychiatrist</option>
                <option>Clinical Psychologist</option>
                <option>Neuropsychologist</option>
                <option>Clinician</option>
                <option>Senior Clinician</option>
                <option>Specialist Nurse (ADHD)</option>
                <option>Occupational Therapist</option>
                <option>Speech and Language Therapist</option>
                <option>Counsellor / Psychotherapist</option>
              </optgroup>
              <optgroup label="Administration">
                <option>Clinical Admin</option>
                <option>Practice Manager</option>
                <option>Receptionist / Coordinator</option>
                <option>Finance Officer</option>
              </optgroup>
              <optgroup label="Other">
                <option>Supervisor / Lead</option>
                <option>Trainee Clinician</option>
                <option>Other</option>
              </optgroup>
            </select>
          </Field>

          <Field id="tm-role-type" label="Platform role" required span="half" hint="Controls dashboard access">
            <select
              id="tm-role-type"
              value={form.roleType}
              onChange={(e) => set("roleType", e.target.value)}
            >
              <option value="clinician">Clinician</option>
              <option value="senior-clinician">Senior Clinician</option>
              <option value="clinic-admin">Clinical Admin</option>
            </select>
          </Field>
        </FieldRow>

        <FieldRow>
          <Field id="tm-contract" label="Contract type" span="half">
            <select
              id="tm-contract"
              value={form.contractType}
              onChange={(e) => set("contractType", e.target.value)}
            >
              <option>Full-time</option>
              <option>Part-time</option>
              <option>Locum</option>
              <option>Bank / Zero-hours</option>
              <option>Fixed term</option>
              <option>Voluntary</option>
            </select>
          </Field>

          <Field id="tm-start-date" label="Start date" span="half">
            <input
              id="tm-start-date"
              type="date"
              value={form.startDate}
              onChange={(e) => set("startDate", e.target.value)}
            />
          </Field>
        </FieldRow>

        {/* ── Section 4: Professional registration ── */}
        <SectionHeading number={4} label="Professional registration" />

        <FieldRow>
          <Field id="tm-reg-body" label="Registration body" span="half" hint="e.g. HCPC, GMC, NMC, BPS">
            <select
              id="tm-reg-body"
              value={form.regBody}
              onChange={(e) => set("regBody", e.target.value)}
            >
              <option value="">— Not applicable —</option>
              <option>HCPC (Health and Care Professions Council)</option>
              <option>GMC (General Medical Council)</option>
              <option>NMC (Nursing and Midwifery Council)</option>
              <option>BPS (British Psychological Society)</option>
              <option>BABCP (British Association for Behavioural and Cognitive Psychotherapies)</option>
              <option>BACP (British Association for Counselling and Psychotherapy)</option>
              <option>RCOT (Royal College of Occupational Therapists)</option>
              <option>RCSLT (Royal College of Speech and Language Therapists)</option>
              <option>Other</option>
            </select>
          </Field>

          <Field id="tm-reg-number" label="Registration number" span="half">
            <input
              id="tm-reg-number"
              type="text"
              value={form.regNumber}
              onChange={(e) => set("regNumber", e.target.value)}
              placeholder="e.g. PYL12345"
            />
          </Field>
        </FieldRow>

        <FieldRow>
          <Field id="tm-reg-expiry" label="Registration expiry date" span="half">
            <input
              id="tm-reg-expiry"
              type="date"
              value={form.regExpiry}
              onChange={(e) => set("regExpiry", e.target.value)}
            />
          </Field>
        </FieldRow>

        {/* ── Actions ── */}
        <div className="tm-actions">
          <button
            type="button"
            className="primary-action"
            onClick={handleAdd}
          >
            Add team member
          </button>
          <button
            type="button"
            className="secondary-action"
            onClick={() => { setForm(EMPTY_FORM); setErrors([]); }}
          >
            Clear form
          </button>
        </div>

        {/* ── Info note ── */}
        <div className="tm-info-note">
          <strong>What happens next?</strong>
          <ul>
            <li>The new member will receive a platform invitation email to set up their login.</li>
            <li>Their availability will appear in the admin calendar once their account is activated.</li>
            <li>Deactivating a member removes them from the rota; historical records are retained.</li>
          </ul>
          <p className="tm-info-legal">
            Personal data is processed in accordance with UK GDPR. Staff records are retained per
            your clinic's data retention policy.
          </p>
        </div>
      </article>

      {/* ── Right: team directory ── */}
      <article className="workspace-card workspace-detail">
        <div className="workspace-card-header">
          <div>
            <span className="panel-label">Team Directory</span>
            <h2>Current team</h2>
          </div>
          <span className="tm-count">{team.filter((m) => m.status === "Active").length} active</span>
        </div>

        {team.length === 0 ? (
          <p className="tm-empty">No team members added yet. Use the form to add your first member.</p>
        ) : (
          <div className="tm-directory">
            {team.map((member) => (
              <div className="tm-member-card" key={member.id}>
                <div className="tm-member-avatar">
                  {member.firstName.charAt(0)}{member.lastName.charAt(0)}
                </div>
                <div className="tm-member-body">
                  <div className="tm-member-name">
                    {fullName(member)}
                    {member.preferredName && (
                      <span className="tm-preferred-name">"{member.preferredName}"</span>
                    )}
                    <span className={`tm-status-chip tm-status-${member.status.toLowerCase()}`}>
                      {member.status}
                    </span>
                  </div>
                  <div className="tm-member-role">
                    {member.jobTitle}
                    {member.contractType && (
                      <span className="tm-meta-sep">·</span>
                    )}
                    {member.contractType}
                    <span className="tm-meta-sep">·</span>
                    <span className="tm-role-badge">{ROLE_TYPE_LABELS[member.roleType] ?? member.roleType}</span>
                  </div>
                  <div className="tm-member-contact">
                    <span>{member.email}</span>
                    {member.phone && (
                      <>
                        <span className="tm-meta-sep">·</span>
                        <span>{member.phone}</span>
                      </>
                    )}
                  </div>
                  {(member.city || member.postcode) && (
                    <div className="tm-member-address">
                      {[member.addressLine1, member.city, member.postcode]
                        .filter(Boolean)
                        .join(", ")}
                    </div>
                  )}
                  {member.regBody && (
                    <div className="tm-member-reg">
                      {member.regBody.split(" ")[0]}
                      {member.regNumber && ` · ${member.regNumber}`}
                      {member.regExpiry && ` · expires ${member.regExpiry}`}
                    </div>
                  )}
                  {member.startDate && (
                    <div className="tm-member-start">
                      Start date: {new Date(member.startDate).toLocaleDateString("en-GB", {
                        day: "numeric", month: "long", year: "numeric",
                      })}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="secondary-action tm-remove-btn"
                  onClick={() => removeMember(member.id)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </article>
    </section>
  );
}
