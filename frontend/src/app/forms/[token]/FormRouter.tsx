"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { browserApiUrl } from "../../../lib/get-api-base";

// ── Shared styles ──────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: "var(--card-bg)",
  borderRadius: "var(--radius-lg)",
  padding: "28px",
  border: "1px solid var(--card-border)",
  marginBottom: "20px",
  boxShadow: "var(--shadow-sm)",
};

const label: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 700,
  color: "var(--ink)",
  marginBottom: 6,
};

const input: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  border: "1px solid var(--card-border)",
  borderRadius: "var(--radius-sm)",
  fontSize: 15,
  boxSizing: "border-box" as const,
  background: "#fff",
  color: "var(--ink)",
  transition: "border-color 150ms ease, box-shadow 150ms ease",
};

const sectionTitle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 800,
  color: "var(--ink)",
  marginBottom: 16,
  paddingBottom: 10,
  borderBottom: "2px solid var(--brand)",
  letterSpacing: "-0.01em",
};

const mutedText: React.CSSProperties = {
  fontSize: 13,
  color: "var(--muted)",
  marginBottom: 16,
  lineHeight: 1.6,
};

const errorText: React.CSSProperties = {
  color: "var(--danger)",
  marginBottom: 16,
  fontSize: 14,
  fontWeight: 600,
  padding: "10px 14px",
  background: "var(--danger-50)",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--danger-100)",
};

const submitButton: React.CSSProperties = {
  background: "var(--brand)",
  color: "#fff",
  border: "none",
  borderRadius: "var(--radius-sm)",
  padding: "14px 32px",
  fontSize: 16,
  fontWeight: 700,
  cursor: "pointer",
  boxShadow: "var(--shadow-brand)",
  transition: "all 180ms ease",
};

function Field({
  label: lbl,
  name,
  type = "text",
  required,
  value,
  onChange,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={label}>
        {lbl}
        {required && <span style={{ color: "var(--danger)" }}> *</span>}
      </label>
      <input
        style={input}
        type={type}
        name={name}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

// 0–3 Likert scale (Conners-style)
const LIKERT_OPTS = ["Not at all", "Just a little", "Pretty much", "Very much"] as const;

function LikertItem({
  n,
  text,
  value,
  onChange,
}: {
  n: number;
  text: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr repeat(4,72px)",
        gap: 8,
        alignItems: "center",
        padding: "10px 0",
        borderBottom: "1px solid var(--muted-100)",
      }}
    >
      <span style={{ fontSize: 14, color: "var(--ink)" }}>
        <strong>{n}.</strong> {text}
      </span>
      {LIKERT_OPTS.map((opt, i) => (
        <label
          key={opt}
          style={{ textAlign: "center", cursor: "pointer", fontSize: 12, color: "var(--muted)" }}
        >
          <input
            type="radio"
            name={`q${n}`}
            value={i}
            checked={value === i}
            onChange={() => onChange(i)}
            style={{ display: "block", margin: "0 auto 2px" }}
          />
          {opt}
        </label>
      ))}
    </div>
  );
}

// Not True / Somewhat True / Certainly True (SDQ-style)
const SDQ_OPTS = ["Not True", "Somewhat True", "Certainly True"] as const;

function SDQItem({
  n,
  text,
  value,
  onChange,
}: {
  n: number;
  text: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr repeat(3,96px)",
        gap: 8,
        alignItems: "center",
        padding: "10px 0",
        borderBottom: "1px solid var(--muted-100)",
      }}
    >
      <span style={{ fontSize: 14, color: "var(--ink)" }}>
        <strong>{n}.</strong> {text}
      </span>
      {SDQ_OPTS.map((opt, i) => (
        <label
          key={opt}
          style={{ textAlign: "center", cursor: "pointer", fontSize: 12, color: "var(--muted)" }}
        >
          <input
            type="radio"
            name={`sdq${n}`}
            value={i}
            checked={value === i}
            onChange={() => onChange(i)}
            style={{ display: "block", margin: "0 auto 2px" }}
          />
          {opt}
        </label>
      ))}
    </div>
  );
}

// ── Universal basic intake (post-payment) ─────────────────────────────────

function BasicIntakeForm({
  token,
  clientName,
  clientEmail,
  prefill = {},
  onSuccess,
}: {
  token: string;
  clientName: string;
  clientEmail?: string | null;
  prefill?: Record<string, string | undefined>;
  onSuccess: () => void;
}) {
  const router = useRouter();
  const [basic, setBasic] = useState({
    full_name: prefill.full_name || clientName,
    dob: prefill.dob || "",
    address: prefill.address || "",
    email: prefill.email || clientEmail || "",
    mobile: prefill.phone || "",
    occupation: "",
    gp_name: prefill.gp_name || "",
    gp_practice: prefill.gp_practice || "",
    gp_email: prefill.gp_email || "",
    medical_concerns: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function setB(key: string, value: string) {
    setBasic((p) => ({ ...p, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!basic.full_name.trim() || !basic.dob.trim() || !basic.email.trim()) {
      setError("Please enter your full name, date of birth, and email.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(browserApiUrl(`/api/v1/forms/submit/${token}`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          responses: { basic },
          gp_email: basic.gp_email || null,
          gp_name: basic.gp_name || null,
        }),
      });
      if (res.ok) {
        // If the backend returned a next_form_token, take the client directly
        // to their clinical questionnaire instead of the generic "submitted" page.
        try {
          const data = await res.json();
          if (data?.next_form_token) {
            router.push(`/forms/${data.next_form_token}`);
            return;
          }
        } catch {
          // ignore parse errors - fall through to onSuccess
        }
        onSuccess();
      } else {
        setError("Submission failed - please try again.");
      }
    } catch {
      setError("Could not connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const taStyle: React.CSSProperties = {
    ...input,
    minHeight: 120,
    resize: "vertical" as const,
    fontFamily: "inherit",
  };

  // Detect whether any field was actually prefilled so we can show a notice
  const hasPrefill = !!(prefill.dob || prefill.phone || prefill.address || prefill.gp_name);

  return (
    <form onSubmit={handleSubmit}>
      {hasPrefill && (
        <div style={{
          background: "var(--teal-50, #f0faf8)",
          border: "1px solid var(--teal, #0d9488)",
          borderRadius: "var(--radius-sm)",
          padding: "12px 16px",
          marginBottom: 20,
          display: "flex",
          gap: 10,
          alignItems: "flex-start",
          fontSize: 14,
          color: "var(--ink)",
          lineHeight: 1.5,
        }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>ℹ️</span>
          <span>
            Some fields have been <strong>pre-filled with the details you provided during booking</strong>.
            Please review everything carefully and make any corrections before submitting.
          </span>
        </div>
      )}
      <div style={card}>
        <div style={sectionTitle}>Your details</div>
        <p style={mutedText}>
          Please check your name and contact details. You can edit anything that needs updating.
          This helps us prepare your assessment for Neuro Flow.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "0 16px",
          }}
        >
          <Field
            label="Full name (as it should appear on records)"
            name="full_name"
            required
            value={basic.full_name}
            onChange={(v) => setB("full_name", v)}
          />
          <Field label="Date of birth" name="dob" type="date" required value={basic.dob} onChange={(v) => setB("dob", v)} />
          <Field label="Email" name="email" type="email" required value={basic.email} onChange={(v) => setB("email", v)} />
          <Field label="Mobile" name="mobile" type="tel" value={basic.mobile} onChange={(v) => setB("mobile", v)} />
          <Field label="Occupation" name="occupation" value={basic.occupation} onChange={(v) => setB("occupation", v)} />
        </div>
        <Field label="Address" name="address" value={basic.address} onChange={(v) => setB("address", v)} />
      </div>

      <div style={card}>
        <div style={sectionTitle}>GP surgery</div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "0 16px",
          }}
        >
          <Field label="GP name" name="gp_name" value={basic.gp_name} onChange={(v) => setB("gp_name", v)} />
          <Field label="Practice name" name="gp_practice" value={basic.gp_practice} onChange={(v) => setB("gp_practice", v)} />
          <Field label="GP email (if known)" name="gp_email" type="email" value={basic.gp_email} onChange={(v) => setB("gp_email", v)} />
        </div>
      </div>

      <div style={card}>
        <div style={sectionTitle}>Medical concerns</div>
        <p style={mutedText}>
          Please tell us about any medical conditions, allergies, or safeguarding concerns we should be aware of before your assessment.
        </p>
        <label style={label}>
          Details (optional but helpful)
        </label>
        <textarea
          style={taStyle}
          name="medical_concerns"
          value={basic.medical_concerns}
          onChange={(e) => setB("medical_concerns", e.target.value)}
          rows={5}
        />
      </div>

      {error && <p style={errorText}>{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="primary-action"
        style={{
          ...submitButton,
          opacity: loading ? 0.7 : 1,
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "Submitting…" : "Submit"}
      </button>
    </form>
  );
}

// ── Adult self-report form ─────────────────────────────────────────────────

// ASRS-v1.1 - 18 items. Part A = items 0-5 (screener), Part B = items 6-17.
// Scale: 0=Never  1=Rarely  2=Sometimes  3=Often  4=Very Often
const ASRS_PART_A: string[] = [
  "How often do you have trouble wrapping up the final details of a project, once the challenging parts have been done?",
  "How often do you have difficulty getting things in order when you have to do a task that requires organisation?",
  "How often do you have problems remembering appointments or obligations?",
  "When you have a task that requires a lot of thought, how often do you avoid or delay getting started?",
  "How often do you fidget or squirm with your hands or feet when you have to sit down for a long time?",
  "How often do you feel overly active and compelled to do things, like you were driven by a motor?",
];
const ASRS_PART_B: string[] = [
  "How often do you make careless mistakes when you have to work on a boring or difficult project?",
  "How often do you have difficulty keeping your attention when you are doing boring or repetitive work?",
  "How often do you have difficulty concentrating on what people say to you, even when they are speaking to you directly?",
  "How often do you misplace or have difficulty finding things at home or at work?",
  "How often are you distracted by activity or noise around you?",
  "How often do you leave your seat in meetings or other situations in which you are expected to remain seated?",
  "How often do you feel restless or fidgety?",
  "How often do you have difficulty unwinding and relaxing when you have time to yourself?",
  "How often do you find yourself talking too much when you are in social situations?",
  "When you're in a conversation, how often do you find yourself finishing the sentences of the people you are talking to, before they can finish them themselves?",
  "How often do you have difficulty waiting your turn in situations when turn taking is required?",
  "How often do you interrupt others when they are busy?",
];
const ASRS_OPTS = ["Never", "Rarely", "Sometimes", "Often", "Very Often"] as const;

// PHQ-9 - 9 items, 0-3 scale
const PHQ9_ITEMS: string[] = [
  "Little interest or pleasure in doing things.",
  "Feeling down, depressed, or hopeless.",
  "Trouble falling or staying asleep, or sleeping too much.",
  "Feeling tired or having little energy.",
  "Poor appetite or overeating.",
  "Feeling bad about yourself - or that you are a failure or have let yourself or your family down.",
  "Trouble concentrating on things, such as reading the newspaper or watching television.",
  "Moving or speaking so slowly that other people could have noticed. Or the opposite - being so fidgety or restless that you have been moving around a lot more than usual.",
  "Thoughts that you would be better off dead, or of hurting yourself in some way.",
];
const PHQ9_OPTS = ["Not at all", "Several days", "More than half the days", "Nearly every day"] as const;

// GAD-7 - 7 items, 0-3 scale
const GAD7_ITEMS: string[] = [
  "Feeling nervous, anxious, or on edge.",
  "Not being able to stop or control worrying.",
  "Worrying too much about different things.",
  "Trouble relaxing.",
  "Being so restless that it's hard to sit still.",
  "Becoming easily annoyed or irritable.",
  "Feeling afraid as if something awful might happen.",
];
const GAD7_OPTS = ["Not at all", "Several days", "Over half the days", "Nearly every day"] as const;

// WFIRS-S - 69 items, 7 domains. Scale 0-3 + N/A (-1)
const WFIRS_DOMAINS: { label: string; items: string[] }[] = [
  {
    label: "A - Family",
    items: [
      "Having problems with family",
      "Having problems with spouse/partner",
      "Relying on others to do things for you",
      "Causing fighting in the family",
      "Makes it hard for the family to have fun together",
      "Problems taking care of your family",
      "Problems balancing your needs against those of your family",
      "Problems losing control with family",
    ],
  },
  {
    label: "B - Work",
    items: [
      "Problems performing required duties",
      "Problems with getting your work done efficiently",
      "Problems with your supervisor",
      "Problems keeping a job",
      "Getting fired from work",
      "Problems working in a team",
      "Problems with your attendance",
      "Problems with being late",
      "Problems taking on new tasks",
      "Problems working to your potential",
      "Poor performance evaluations",
    ],
  },
  {
    label: "C - School",
    items: [
      "Problems taking notes",
      "Problems completing assignments",
      "Problems getting your work done efficiently",
      "Problems with teachers",
      "Problems with school administrators",
      "Problems meeting minimum requirements to stay in school",
      "Problems with attendance",
      "Problems with being late",
      "Problems with working to your potential",
      "Problems with inconsistent grades",
    ],
  },
  {
    label: "D - Life Skills",
    items: [
      "Excessive or inappropriate use of internet, video games or TV",
      "Problems keeping an acceptable appearance",
      "Problems getting ready to leave the house",
      "Problems getting to bed",
      "Problems with nutrition",
      "Problems with sex",
      "Problems with sleeping",
      "Getting hurt or injured",
      "Avoiding exercise",
      "Problems keeping regular appointments with doctor/dentist",
      "Problems keeping up with household chores",
      "Problems managing money",
    ],
  },
  {
    label: "E - Self-Concept",
    items: [
      "Feeling bad about yourself",
      "Feeling frustrated with yourself",
      "Feeling discouraged",
      "Not feeling happy with your life",
      "Feeling incompetent",
    ],
  },
  {
    label: "F - Social",
    items: [
      "Getting into arguments",
      "Trouble cooperating",
      "Trouble getting along with people",
      "Problems having fun with other people",
      "Problems participating in hobbies",
      "Problems making friends",
      "Problems keeping friends",
      "Saying inappropriate things",
      "Complaints from neighbours",
    ],
  },
  {
    label: "G - Risk",
    items: [
      "Aggressive driving",
      "Doing other things while driving",
      "Road rage",
      "Breaking or damaging things",
      "Doing things that are illegal",
      "Being involved with the police",
      "Smoking cigarettes",
      "Smoking marijuana",
      "Drinking alcohol",
      "Taking \"street\" drugs",
      "Sex without protection (birth control, condom)",
      "Sexually inappropriate behaviour",
      "Being physically aggressive",
      "Being verbally aggressive",
    ],
  },
];
const WFIRS_OPTS = ["Never / not at all", "Sometimes / somewhat", "Often / much", "Very often / very much"] as const;

// Generic multi-option rating item (handles any number of options)
function RatingItem({
  n,
  text,
  value,
  options,
  name,
  onChange,
  cols,
}: {
  n: number;
  text: string;
  value: number;
  options: readonly string[];
  name: string;
  onChange: (v: number) => void;
  cols?: number;
}) {
  const colWidth = Math.floor(320 / options.length);
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: `1fr repeat(${options.length}, ${colWidth}px)`,
      gap: 6,
      alignItems: "center",
      padding: "10px 0",
      borderBottom: "1px solid var(--muted-100)",
    }}>
      <span style={{ fontSize: 14, color: "var(--ink)" }}>
        <strong>{n}.</strong> {text}
      </span>
      {options.map((opt, i) => (
        <label key={opt} style={{ textAlign: "center", cursor: "pointer", fontSize: 11, color: "var(--muted)" }}>
          <input type="radio" name={name} value={i} checked={value === i}
            onChange={() => onChange(i)}
            style={{ display: "block", margin: "0 auto 2px" }} />
          {opt}
        </label>
      ))}
    </div>
  );
}

// WFIRS item with N/A option
function WFIRSItem({
  n,
  text,
  globalIdx,
  value,
  onChange,
}: {
  n: number;
  text: string;
  globalIdx: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "1fr repeat(4,80px) 56px",
      gap: 6,
      alignItems: "center",
      padding: "8px 0",
      borderBottom: "1px solid var(--muted-100)",
    }}>
      <span style={{ fontSize: 13, color: "var(--ink)" }}>
        <strong>{n}.</strong> {text}
      </span>
      {WFIRS_OPTS.map((opt, i) => (
        <label key={opt} style={{ textAlign: "center", cursor: "pointer", fontSize: 10, color: "var(--muted)" }}>
          <input type="radio" name={`wfirs${globalIdx}`} value={i} checked={value === i}
            onChange={() => onChange(i)}
            style={{ display: "block", margin: "0 auto 2px" }} />
          {opt}
        </label>
      ))}
      <label style={{ textAlign: "center", cursor: "pointer", fontSize: 10, color: "var(--muted)" }}>
        <input type="radio" name={`wfirs${globalIdx}`} value={-1} checked={value === -1}
          onChange={() => onChange(-1)}
          style={{ display: "block", margin: "0 auto 2px" }} />
        N/A
      </label>
    </div>
  );
}

function AdultSelfForm({
  token,
  clientName,
  prefill = {},
  onSuccess,
}: {
  token: string;
  clientName: string;
  prefill?: Record<string, string | undefined>;
  onSuccess: () => void;
}) {
  const taStyle: React.CSSProperties = {
    ...input, minHeight: 80, resize: "vertical" as const, fontFamily: "inherit",
  };

  // Consent
  const [consentAssessment, setConsentAssessment] = useState(false);
  const [consentComms, setConsentComms] = useState(false);

  // Personal details - pre-filled where available
  const [personal, setPersonal] = useState({
    dob: prefill.dob || "",
    gender: "",
    phone: prefill.phone || "",
    address: prefill.address || "",
    ethnicity: "", religion: "",
    previous_diagnoses: "", current_medications: "",
    referral_reason: "", goals: "",
  });

  // Instruments - all start unset (-1)
  const ASRS_ALL = [...ASRS_PART_A, ...ASRS_PART_B];
  const [asrs, setAsrs] = useState<number[]>(Array(18).fill(-1));
  const [phq9, setPhq9] = useState<number[]>(Array(9).fill(-1));
  const [gad7, setGad7] = useState<number[]>(Array(7).fill(-1));
  const totalWfirs = WFIRS_DOMAINS.reduce((s, d) => s + d.items.length, 0);
  const [wfirs, setWfirs] = useState<number[]>(Array(totalWfirs).fill(-1));

  // GP - pre-filled where available
  const [gpName, setGpName] = useState(prefill.gp_name || "");
  const [gpPractice, setGpPractice] = useState(prefill.gp_practice || "");
  const [gpEmail, setGpEmail] = useState(prefill.gp_email || "");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function setP(k: string, v: string) { setPersonal((p) => ({ ...p, [k]: v })); }
  function updateAsrs(i: number, v: number) { setAsrs((r) => { const n = [...r]; n[i] = v; return n; }); }
  function updatePhq9(i: number, v: number) { setPhq9((r) => { const n = [...r]; n[i] = v; return n; }); }
  function updateGad7(i: number, v: number) { setGad7((r) => { const n = [...r]; n[i] = v; return n; }); }
  function updateWfirs(i: number, v: number) { setWfirs((r) => { const n = [...r]; n[i] = v; return n; }); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!consentAssessment) {
      setError("You must give consent for Neuro Flow to carry out the assessment before submitting.");
      return;
    }
    if (asrs.some((r) => r === -1)) {
      setError("Please answer all ASRS items (Section 2 & 3).");
      return;
    }
    if (phq9.some((r) => r === -1)) {
      setError("Please answer all PHQ-9 items (Section 4).");
      return;
    }
    if (gad7.some((r) => r === -1)) {
      setError("Please answer all GAD-7 items (Section 5).");
      return;
    }
    // WFIRS allows N/A so we only check it was touched
    if (wfirs.every((r) => r === -1)) {
      setError("Please complete the WFIRS section (Section 6).");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(browserApiUrl(`/api/v1/forms/submit/${token}`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          responses: {
            consent: { assessment: consentAssessment, communications: consentComms },
            personal,
            asrs_ratings: asrs,
            phq9_ratings: phq9,
            gad7_ratings: gad7,
            wfirs_ratings: wfirs,
          },
          gp_name: gpName || null,
          gp_practice: gpPractice || null,
          gp_email: gpEmail || null,
        }),
      });
      if (res.ok) onSuccess();
      else setError("Submission failed - please try again.");
    } catch {
      setError("Could not connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const consentCardStyle: React.CSSProperties = {
    ...card, border: "2px solid var(--brand)", background: "var(--brand-50, #f0f4ff)",
  };
  const consentRowStyle: React.CSSProperties = {
    display: "flex", alignItems: "flex-start", gap: 14,
    padding: "14px 0", borderBottom: "1px solid var(--card-border)",
  };

  // WFIRS cursor tracks global item index across domains
  let wfirsCursor = 0;

  return (
    <form onSubmit={handleSubmit}>

      {/* ── Consent ── */}
      <div style={consentCardStyle}>
        <div style={sectionTitle}>Consent</div>
        <p style={mutedText}>Please read each statement carefully and tick the box to confirm your consent before completing this form.</p>
        <div style={consentRowStyle}>
          <input type="checkbox" id="adult_consent_assessment" checked={consentAssessment}
            onChange={(e) => setConsentAssessment(e.target.checked)}
            style={{ width: 20, height: 20, marginTop: 2, accentColor: "var(--brand)", cursor: "pointer", flexShrink: 0 }} />
          <label htmlFor="adult_consent_assessment" style={{ fontSize: 15, color: "var(--ink)", lineHeight: 1.5, cursor: "pointer" }}>
            <strong>I give consent for Neuro Flow to carry out a neurodevelopmental assessment for me.</strong>
            <span style={{ color: "var(--danger)", marginLeft: 4 }}>*</span>
          </label>
        </div>
        <div style={{ ...consentRowStyle, borderBottom: "none" }}>
          <input type="checkbox" id="adult_consent_comms" checked={consentComms}
            onChange={(e) => setConsentComms(e.target.checked)}
            style={{ width: 20, height: 20, marginTop: 2, accentColor: "var(--brand)", cursor: "pointer", flexShrink: 0 }} />
          <label htmlFor="adult_consent_comms" style={{ fontSize: 15, color: "var(--ink)", lineHeight: 1.5, cursor: "pointer" }}>
            I give consent for Neuro Flow to communicate with and provide letters/reports in relation to my assessment, treatment and progress to other relevant healthcare services or professionals.
          </label>
        </div>
      </div>

      {/* ── Section 1: Personal details ── */}
      <div style={card}>
        <div style={sectionTitle}>Section 1 - Your details</div>
        {(prefill.dob || prefill.phone || prefill.address) && (
          <div style={{
            background: "var(--teal-50, #f0faf8)",
            border: "1px solid var(--teal, #0d9488)",
            borderRadius: "var(--radius-sm)",
            padding: "10px 14px",
            marginBottom: 16,
            fontSize: 13,
            color: "var(--ink)",
            lineHeight: 1.5,
          }}>
            ℹ️ Some fields have been pre-filled from your booking details. Please check and update as needed.
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0 16px" }}>
          <Field label="Date of birth" name="dob" type="date" required value={personal.dob} onChange={(v) => setP("dob", v)} />
          <Field label="Gender" name="gender" required value={personal.gender} onChange={(v) => setP("gender", v)} />
          <Field label="Phone number" name="phone" type="tel" value={personal.phone} onChange={(v) => setP("phone", v)} />
          <Field label="Home address" name="address" value={personal.address} onChange={(v) => setP("address", v)} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0 16px" }}>
          <SelectField label="Ethnicity" name="ethnicity" value={personal.ethnicity} onChange={(v) => setP("ethnicity", v)} options={ETHNICITY_OPTIONS} />
          <SelectField label="Religion" name="religion" value={personal.religion} onChange={(v) => setP("religion", v)} options={RELIGION_OPTIONS} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={label}>Reason for referral - please describe your main concerns <span style={{ color: "var(--danger)" }}>*</span></label>
          <textarea style={taStyle} required name="referral_reason" value={personal.referral_reason} onChange={(e) => setP("referral_reason", e.target.value)} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={label}>What are you hoping to achieve from this assessment?</label>
          <textarea style={{ ...taStyle, minHeight: 70 }} name="goals" value={personal.goals} onChange={(e) => setP("goals", e.target.value)} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0 16px" }}>
          <Field label="Any previous diagnoses (e.g. anxiety, depression)" name="previous_diagnoses" value={personal.previous_diagnoses} onChange={(v) => setP("previous_diagnoses", v)} />
          <Field label="Current medications (if any)" name="current_medications" value={personal.current_medications} onChange={(v) => setP("current_medications", v)} />
        </div>
      </div>

      {/* ── Section 2: ASRS Part A ── */}
      <div style={card}>
        <div style={sectionTitle}>Section 2 - Adult ADHD Self-Report Scale (ASRS-v1.1) - Part A</div>
        <p style={mutedText}>
          Please rate how often you have experienced the following <strong>over the past 6 months</strong>.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: `1fr repeat(5,68px)`, gap: 6, marginBottom: 8 }}>
          <span />
          {ASRS_OPTS.map((h) => <span key={h} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: "var(--muted)" }}>{h}</span>)}
        </div>
        {ASRS_PART_A.map((text, i) => (
          <RatingItem key={i} n={i + 1} text={text} value={asrs[i]} options={ASRS_OPTS}
            name={`asrs_a${i}`} onChange={(v) => updateAsrs(i, v)} />
        ))}
      </div>

      {/* ── Section 3: ASRS Part B ── */}
      <div style={card}>
        <div style={sectionTitle}>Section 3 - ASRS-v1.1 Part B</div>
        <p style={mutedText}>Continue rating yourself over the <strong>past 6 months</strong>.</p>
        <div style={{ display: "grid", gridTemplateColumns: `1fr repeat(5,68px)`, gap: 6, marginBottom: 8 }}>
          <span />
          {ASRS_OPTS.map((h) => <span key={h} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: "var(--muted)" }}>{h}</span>)}
        </div>
        {ASRS_PART_B.map((text, i) => (
          <RatingItem key={i} n={i + 7} text={text} value={asrs[i + 6]} options={ASRS_OPTS}
            name={`asrs_b${i}`} onChange={(v) => updateAsrs(i + 6, v)} />
        ))}
      </div>

      {/* ── Section 4: PHQ-9 ── */}
      <div style={card}>
        <div style={sectionTitle}>Section 4 - Patient Health Questionnaire (PHQ-9)</div>
        <p style={mutedText}>
          Over the <strong>last 2 weeks</strong>, how often have you been bothered by any of the following problems?
        </p>
        <div style={{ display: "grid", gridTemplateColumns: `1fr repeat(4,96px)`, gap: 6, marginBottom: 8 }}>
          <span />
          {PHQ9_OPTS.map((h) => <span key={h} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: "var(--muted)" }}>{h}</span>)}
        </div>
        {PHQ9_ITEMS.map((text, i) => (
          <RatingItem key={i} n={i + 1} text={text} value={phq9[i]} options={PHQ9_OPTS}
            name={`phq9_${i}`} onChange={(v) => updatePhq9(i, v)} />
        ))}
        {phq9[8] > 0 && (
          <div style={{ marginTop: 12, padding: "10px 14px", background: "#fff3cd", border: "1px solid #ffc107", borderRadius: 6, fontSize: 13 }}>
            <strong>⚠ Item 9:</strong> You have indicated thoughts of self-harm. If you are in crisis please contact your GP, call 999, or contact the Samaritans on <strong>116 123</strong> (free, 24/7).
          </div>
        )}
      </div>

      {/* ── Section 5: GAD-7 ── */}
      <div style={card}>
        <div style={sectionTitle}>Section 5 - Generalised Anxiety Disorder Scale (GAD-7)</div>
        <p style={mutedText}>
          Over the <strong>last 2 weeks</strong>, how often have you been bothered by the following?
        </p>
        <div style={{ display: "grid", gridTemplateColumns: `1fr repeat(4,96px)`, gap: 6, marginBottom: 8 }}>
          <span />
          {GAD7_OPTS.map((h) => <span key={h} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: "var(--muted)" }}>{h}</span>)}
        </div>
        {GAD7_ITEMS.map((text, i) => (
          <RatingItem key={i} n={i + 1} text={text} value={gad7[i]} options={GAD7_OPTS}
            name={`gad7_${i}`} onChange={(v) => updateGad7(i, v)} />
        ))}
      </div>

      {/* ── Section 6: WFIRS-S ── */}
      <div style={card}>
        <div style={sectionTitle}>Section 6 - Weiss Functional Impairment Rating Scale (WFIRS-S)</div>
        <p style={mutedText}>
          Please rate how your emotional or behavioural problems have affected each area <strong>in the last month</strong>. Use N/A if an area does not apply to you.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr repeat(4,80px) 56px", gap: 6, marginBottom: 8 }}>
          <span />
          {WFIRS_OPTS.map((h) => <span key={h} style={{ textAlign: "center", fontSize: 9, fontWeight: 700, color: "var(--muted)" }}>{h}</span>)}
          <span style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: "var(--muted)" }}>N/A</span>
        </div>
        {WFIRS_DOMAINS.map((domain) => {
          const domainStart = wfirsCursor;
          wfirsCursor += domain.items.length;
          return (
            <div key={domain.label} style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--brand)", margin: "12px 0 4px", borderBottom: "1px solid var(--brand)", paddingBottom: 4 }}>
                {domain.label}
              </div>
              {domain.items.map((text, j) => (
                <WFIRSItem key={j} n={j + 1} text={text} globalIdx={domainStart + j}
                  value={wfirs[domainStart + j]}
                  onChange={(v) => updateWfirs(domainStart + j, v)} />
              ))}
            </div>
          );
        })}
      </div>

      {/* ── Section 7: GP details ── */}
      <div style={card}>
        <div style={sectionTitle}>Section 7 - GP / family doctor details</div>
        <p style={mutedText}>We will contact your GP to request relevant medical history as part of your assessment.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0 16px" }}>
          <Field label="GP name" name="gp_name" value={gpName} onChange={setGpName} />
          <Field label="GP practice name" name="gp_practice" value={gpPractice} onChange={setGpPractice} />
          <Field label="GP email address" name="gp_email" type="text" value={gpEmail} onChange={setGpEmail} />
        </div>
      </div>

      {/* ── Privacy notice ── */}
      <div style={{ ...card, background: "var(--muted-50, #f8f9fc)", border: "1px solid var(--muted-100)" }}>
        <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.7, margin: 0 }}>
          Neuro Flow handles your personal information in accordance with the Data Protection Act 2018 and the General Data Protection Regulations 2018. For more information please see the Privacy Notice on our website or email <strong>support@neuroflow.app</strong>.
        </p>
      </div>

      {error && <p style={errorText}>{error}</p>}
      <button type="submit" disabled={loading} className="primary-action"
        style={{ ...submitButton, opacity: loading ? 0.7 : 1, cursor: loading ? "not-allowed" : "pointer" }}>
        {loading ? "Submitting…" : "Submit form"}
      </button>
    </form>
  );
}

// ── Child parent form ──────────────────────────────────────────────────────

// SDQ – Parent/Teacher version P4-17 (exact UK English wording, sdqinfo.org)
// Scale: 0 = Not True  1 = Somewhat True  2 = Certainly True
// Reversed items (score as 2/1/0): 7, 11, 14, 21, 25
const SDQ_ITEMS = [
  "Considerate of other people's feelings",                                          // 1  prosocial
  "Restless, overactive, cannot stay still for long",                               // 2  hyperactivity
  "Often complains of headaches, stomach-aches or sickness",                        // 3  emotional
  "Shares readily with other children (treats, toys, pencils etc.)",                // 4  prosocial
  "Often has temper tantrums or hot tempers",                                       // 5  conduct
  "Rather solitary, tends to play alone",                                           // 6  peer
  "Generally obedient, usually does what adults request",                           // 7  conduct (R)
  "Many worries, often seems worried",                                              // 8  emotional
  "Helpful if someone is hurt, upset or feeling ill",                               // 9  prosocial
  "Constantly fidgeting or squirming",                                              // 10 hyperactivity
  "Has at least one good friend",                                                   // 11 peer (R)
  "Often fights with other children or bullies them",                               // 12 conduct
  "Often unhappy, downhearted or tearful",                                          // 13 emotional
  "Generally liked by other children",                                              // 14 peer (R)
  "Easily distracted, concentration wanders",                                       // 15 hyperactivity
  "Nervous or clingy in new situations, easily loses confidence",                   // 16 emotional
  "Kind to younger children",                                                       // 17 prosocial
  "Often lies or cheats",                                                           // 18 conduct
  "Picked on or bullied by other children",                                         // 19 peer
  "Often volunteers to help others (parents, teachers, other children)",            // 20 prosocial
  "Thinks things out before acting",                                                // 21 hyperactivity (R)
  "Steals from home, school or elsewhere",                                          // 22 conduct
  "Gets on better with adults than with other children",                            // 23 peer
  "Many fears, easily scared",                                                      // 24 emotional
  "Good attention span, sees tasks through to the end",                             // 25 hyperactivity (R)
];

// SDQ – Self-report version S11-17 (exact UK English wording)
const SDQ_SELF_ITEMS = [
  "I try to be nice to other people. I care about their feelings",                  // 1
  "I am restless, I cannot stay still for long",                                   // 2
  "I get a lot of headaches, stomach-aches or sickness",                           // 3
  "I usually share with others (food, games, pens etc.)",                          // 4
  "I get very angry and often lose my temper",                                     // 5
  "I would rather be alone than with people of my age",                            // 6
  "I usually do as I am told",                                                     // 7
  "I worry a lot",                                                                 // 8
  "I am helpful if someone is hurt, upset or feeling ill",                         // 9
  "I am constantly fidgeting or squirming",                                        // 10
  "I have one good friend or more",                                                // 11
  "I fight a lot. I can make other people do what I want",                         // 12
  "I am often unhappy, downhearted or tearful",                                    // 13
  "Other people my age generally like me",                                         // 14
  "I am easily distracted, I find it difficult to concentrate",                    // 15
  "I am nervous in new situations. I easily lose confidence",                      // 16
  "I am kind to younger children",                                                 // 17
  "I am often accused of lying or cheating",                                       // 18
  "Other children or young people pick on me or bully me",                         // 19
  "I often offer to help others (parents, teachers, children)",                    // 20
  "I think before I do things",                                                    // 21
  "I take things that are not mine from home, school or elsewhere",                // 22
  "I get on better with adults than with people my own age",                       // 23
  "I have many fears, I am easily scared",                                         // 24
  "I finish the work I'm doing. My attention is good",                             // 25
];

// Conners' Parent Rating Scale – Revised (S)  CPRS-R(S)  27 items
// Scale: 0 = Not True At All  1 = Just A Little True  2 = Pretty Much True  3 = Very Much True
const CPRS_ITEMS = [
  "Inattentive, easily distracted",
  "Angry and resentful",
  "Difficulty doing or completing homework",
  "Is always \"on the go\" or acts as if driven by a motor",
  "Short attention span",
  "Argues with adults",
  "Fidgets with hands or feet or squirms in seat",
  "Fails to complete assignments",
  "Hard to control in malls or while grocery shopping",
  "Messy or disorganized at home or school",
  "Loses temper",
  "Needs close supervision to get through assignments",
  "Only attends if it is something he/she is very interested in",
  "Runs about or climbs excessively in situations where it is inappropriate",
  "Distractibility or attention span a problem",
  "Irritable",
  "Avoids, expresses reluctance about, or has difficulties engaging in tasks that require sustained mental effort (such as schoolwork or homework)",
  "Restless in the \"squirmy\" sense",
  "Gets distracted when given instructions to do something",
  "Actively defies or refuses to comply with adults' requests",
  "Has trouble concentrating in class",
  "Has difficulty waiting in lines or awaiting turn in games or group situations",
  "Leaves seat in classroom or in other situations in which remaining seated is expected",
  "Deliberately does things that annoy other people",
  "Does not follow through on instructions and fails to finish schoolwork, chores or duties (not due to oppositional behaviour or failure to understand instructions)",
  "Has difficulty playing or engaging in leisure activities quietly",
  "Easily frustrated in efforts",
];

// ── Shared screener option lists ───────────────────────────────────────────

const ETHNICITY_OPTIONS = [
  "White - British", "White - Irish", "White - Any other white background",
  "Mixed - White and Black Caribbean", "Mixed - White and Black African",
  "Mixed - White and Asian", "Mixed - Any other mixed background",
  "Asian or Asian British - Indian", "Asian or Asian British - Pakistani",
  "Asian or Asian British - Bangladeshi", "Asian or Asian British - Any other Asian background",
  "Black or Black British - Caribbean", "Black or Black British - African",
  "Black or Black British - Any other Black background",
  "Other ethnic group - Chinese", "Other ethnic group - Any other ethnic group",
  "Prefer not to disclose",
] as const;

const RELIGION_OPTIONS = [
  "No religion", "Christian (all denominations)", "Muslim", "Hindu", "Sikh",
  "Jewish", "Buddhist", "Any other religion", "Prefer not to disclose",
] as const;

const DISABILITY_OPTIONS = [
  "Dyslexia", "Dyscalculia", "Dyspraxia / DCD", "Speech and Language difficulties",
  "Learning disability / Global developmental delay", "Anxiety", "Depression",
  "Autism / ASD (previously diagnosed)", "ADHD (previously diagnosed)",
  "Physical disability", "Sensory impairment (hearing)", "Sensory impairment (vision)",
  "Other",
] as const;

const COMMS_SUPPORT_OPTIONS = [
  "None", "BSL (British Sign Language)", "Easy Read materials",
  "Large print", "Audio / visual support", "Other",
] as const;

// Checkbox group helper
function CheckboxGroup({
  legend,
  options,
  selected,
  onChange,
}: {
  legend: string;
  options: readonly string[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  function toggle(opt: string) {
    onChange(
      selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt],
    );
  }
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ ...label, marginBottom: 10 }}>{legend}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 20px" }}>
        {options.map((opt) => (
          <label key={opt} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, cursor: "pointer", color: "var(--ink)" }}>
            <input
              type="checkbox"
              checked={selected.includes(opt)}
              onChange={() => toggle(opt)}
              style={{ width: 16, height: 16, accentColor: "var(--brand)", cursor: "pointer" }}
            />
            {opt}
          </label>
        ))}
      </div>
    </div>
  );
}

// Select helper
function SelectField({ label: lbl, name, value, onChange, options, required }: {
  label: string; name: string; value: string;
  onChange: (v: string) => void; options: readonly string[]; required?: boolean;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={label}>
        {lbl}{required && <span style={{ color: "var(--danger)" }}> *</span>}
      </label>
      <select
        name={name}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...input, appearance: "auto" }}
      >
        <option value="">- Select -</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

// Yes/No radio helper
function YesNo({ label: lbl, name, value, onChange }: {
  label: string; name: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ ...label, marginBottom: 8 }}>{lbl}</div>
      <div style={{ display: "flex", gap: 24 }}>
        {["Yes", "No"].map((opt) => (
          <label key={opt} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, cursor: "pointer", color: "var(--ink)" }}>
            <input type="radio" name={name} value={opt} checked={value === opt}
              onChange={() => onChange(opt)}
              style={{ width: 16, height: 16, accentColor: "var(--brand)", cursor: "pointer" }} />
            {opt}
          </label>
        ))}
      </div>
    </div>
  );
}

// ── Child parent form (5–10) ────────────────────────────────────────────────

function ChildParentForm({
  token,
  clientName,
  prefill = {},
  onSuccess,
}: {
  token: string;
  clientName: string;
  prefill?: Record<string, string | undefined>;
  onSuccess: () => void;
}) {
  const taStyle: React.CSSProperties = {
    ...input, minHeight: 100, resize: "vertical" as const, fontFamily: "inherit",
  };

  // ── Consent ──
  const [consentAssessment, setConsentAssessment] = useState(false);
  const [consentComms, setConsentComms] = useState(false);

  // ── Child + parent basics - pre-filled where available ──
  const [child, setChild] = useState({
    dob: prefill.child_dob || "",
    gender: "", ethnicity: "", religion: "",
    school: prefill.school_name || "", school_year: "",
    parent_name: prefill.parent_name || "",
    relationship: "",
    parent_phone: prefill.parent_phone || prefill.phone || "",
    parent_email: prefill.email || "",
    home_address: prefill.address || "",
    primary_language: "",
    child_needs_interpreter: "", parent_needs_interpreter: "",
  });

  // ── Screener / questionnaire ──
  const [questionnaire, setQuestionnaire] = useState({
    reason_for_referral: "",
    goals_of_assessment: "",
    when_concerns_started: "",
    pregnancy_concerns: "",
    developmental_milestones: "",
    previous_assessments: "",
    family_history_neurodev: "",
    current_medications: "",
    other_medical_conditions: "",
    how_child_reacts_to_others: "",
    agencies_involved: "",
    safeguarding_concerns: "",
    parental_responsibility_holders: "",
    is_looked_after_child: "",
    special_guardianship_order: "",
    other_court_order: "",
    is_adopted: "",
    anything_else: "",
  });
  const [diagnosedDisabilities, setDiagnosedDisabilities] = useState<string[]>([]);
  const [commsSupport, setCommsSupport] = useState<string[]>(["None"]);

  const [sdq, setSdq] = useState<number[]>(Array(SDQ_ITEMS.length).fill(-1));
  const [cprs, setCprs] = useState<number[]>(Array(CPRS_ITEMS.length).fill(-1));
  const [teacherName, setTeacherName] = useState(prefill.teacher_name || "");
  const [teacherEmail, setTeacherEmail] = useState(prefill.teacher_email || "");
  const [gpName, setGpName] = useState(prefill.gp_name || "");
  const [gpPractice, setGpPractice] = useState(prefill.gp_practice || "");
  const [gpEmail, setGpEmail] = useState(prefill.gp_email || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function setC(k: string, v: string) { setChild((p) => ({ ...p, [k]: v })); }
  function setQ(k: string, v: string) { setQuestionnaire((p) => ({ ...p, [k]: v })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!consentAssessment) {
      setError("You must give consent for Neuro Flow to carry out the neurodevelopmental assessment before submitting.");
      return;
    }
    if (sdq.some((r) => r === -1)) {
      setError("Please answer all SDQ items (Section 4).");
      return;
    }
    if (cprs.some((r) => r === -1)) {
      setError("Please answer all Conners Parent Rating Scale items (Section 5).");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(browserApiUrl(`/api/v1/forms/submit/${token}`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          responses: {
            consent: { assessment: consentAssessment, communications: consentComms },
            child_details: child,
            diagnosed_disabilities: diagnosedDisabilities,
            comms_support_needs: commsSupport,
            parent_questionnaire: questionnaire,
            sdq_parent_ratings: sdq,
            cprs_ratings: cprs,
          },
          teacher_name: teacherName || null,
          teacher_email: teacherEmail || null,
          gp_name: gpName || null,
          gp_practice: gpPractice || null,
          gp_email: gpEmail || null,
        }),
      });
      if (res.ok) onSuccess();
      else setError("Submission failed - please try again.");
    } catch {
      setError("Could not connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const consentCardStyle: React.CSSProperties = {
    ...card,
    border: "2px solid var(--brand)",
    background: "var(--brand-50, #f0f4ff)",
  };

  const consentRowStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "flex-start",
    gap: 14,
    padding: "14px 0",
    borderBottom: "1px solid var(--card-border)",
  };

  return (
    <form onSubmit={handleSubmit}>

      {/* ── Consent (must be first) ── */}
      <div style={consentCardStyle}>
        <div style={sectionTitle}>Consent</div>
        <p style={mutedText}>
          Please read each statement carefully and tick the box to confirm your consent before completing the rest of this form.
        </p>

        <div style={consentRowStyle}>
          <input
            type="checkbox"
            id="consent_assessment"
            checked={consentAssessment}
            onChange={(e) => setConsentAssessment(e.target.checked)}
            style={{ width: 20, height: 20, marginTop: 2, accentColor: "var(--brand)", cursor: "pointer", flexShrink: 0 }}
          />
          <label htmlFor="consent_assessment" style={{ fontSize: 15, color: "var(--ink)", lineHeight: 1.5, cursor: "pointer" }}>
            <strong>I give consent for Neuro Flow to carry out a neurodevelopmental assessment for my child.</strong>
            <span style={{ color: "var(--danger)", marginLeft: 4 }}>*</span>
          </label>
        </div>

        <div style={{ ...consentRowStyle, borderBottom: "none" }}>
          <input
            type="checkbox"
            id="consent_comms"
            checked={consentComms}
            onChange={(e) => setConsentComms(e.target.checked)}
            style={{ width: 20, height: 20, marginTop: 2, accentColor: "var(--brand)", cursor: "pointer", flexShrink: 0 }}
          />
          <label htmlFor="consent_comms" style={{ fontSize: 15, color: "var(--ink)", lineHeight: 1.5, cursor: "pointer" }}>
            I give consent for Neuro Flow to communicate with and provide letters/reports in relation to my child&apos;s assessment, treatment and progress to other relevant healthcare services or professionals.
          </label>
        </div>
      </div>

      {/* ── Section 1: Child & parent contact details ── */}
      <div style={card}>
        <div style={sectionTitle}>Section 1 - Child&apos;s details</div>
        <p style={mutedText}>Please complete all fields as accurately as possible.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0 16px" }}>
          <Field label="Child's date of birth" name="dob" type="date" required value={child.dob} onChange={(v) => setC("dob", v)} />
          <Field label="Gender" name="gender" required value={child.gender} onChange={(v) => setC("gender", v)} />
          <Field label="Home address" name="home_address" value={child.home_address} onChange={(v) => setC("home_address", v)} />
          <Field label="School name" name="school" value={child.school} onChange={(v) => setC("school", v)} />
          <Field label="School year / class" name="school_year" value={child.school_year} onChange={(v) => setC("school_year", v)} />
          <Field label="Parent / guardian name" name="parent_name" required value={child.parent_name} onChange={(v) => setC("parent_name", v)} />
          <Field label="Relationship to child" name="relationship" required value={child.relationship} onChange={(v) => setC("relationship", v)} />
          <Field label="Contact phone" name="parent_phone" type="tel" value={child.parent_phone} onChange={(v) => setC("parent_phone", v)} />
          <Field label="Contact email" name="parent_email" type="email" value={child.parent_email} onChange={(v) => setC("parent_email", v)} />
          <Field label="Primary language spoken at home" name="primary_language" value={child.primary_language} onChange={(v) => setC("primary_language", v)} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0 16px" }}>
          <SelectField label="Child's ethnicity" name="ethnicity" value={child.ethnicity} onChange={(v) => setC("ethnicity", v)} options={ETHNICITY_OPTIONS} />
          <SelectField label="Child's religion" name="religion" value={child.religion} onChange={(v) => setC("religion", v)} options={RELIGION_OPTIONS} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0 16px" }}>
          <YesNo label="Does your child require a language translator / interpreter?" name="child_interp" value={child.child_needs_interpreter} onChange={(v) => setC("child_needs_interpreter", v)} />
          <YesNo label="Do you (parent/guardian) require a language translator / interpreter?" name="parent_interp" value={child.parent_needs_interpreter} onChange={(v) => setC("parent_needs_interpreter", v)} />
        </div>
      </div>

      {/* ── Section 2: Parent / guardian questionnaire ── */}
      <div style={card}>
        <div style={sectionTitle}>Section 2 - Parent / guardian questionnaire</div>
        <p style={mutedText}>Please work through each question in as much detail as possible. This information will help your assessing clinician understand your child&apos;s presenting difficulties.</p>

        <div style={{ marginBottom: 16 }}>
          <label style={label}>What is the reason for this referral? Please describe any concerns about your child&apos;s behaviour, any concerns from school, and any other relevant information. <span style={{ color: "var(--danger)" }}>*</span></label>
          <textarea style={taStyle} required name="reason_for_referral" value={questionnaire.reason_for_referral} onChange={(e) => setQ("reason_for_referral", e.target.value)} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={label}>What are you hoping to achieve from this assessment?</label>
          <textarea style={{ ...taStyle, minHeight: 80 }} name="goals" value={questionnaire.goals_of_assessment} onChange={(e) => setQ("goals_of_assessment", e.target.value)} />
        </div>

        <Field label="When did you first notice these concerns?" name="when_started" value={questionnaire.when_concerns_started} onChange={(v) => setQ("when_concerns_started", v)} />

        <CheckboxGroup legend="Does your child have any diagnosed disability? (tick all that apply)" options={DISABILITY_OPTIONS} selected={diagnosedDisabilities} onChange={setDiagnosedDisabilities} />

        <CheckboxGroup legend="Does your child have any communication support needs?" options={COMMS_SUPPORT_OPTIONS} selected={commsSupport} onChange={setCommsSupport} />

        <div style={{ marginBottom: 16 }}>
          <label style={label}>Please list ALL people who hold parental responsibility for your child (i.e. legal rights and responsibilities as a parent)</label>
          <textarea style={{ ...taStyle, minHeight: 80 }} name="parental_responsibility" value={questionnaire.parental_responsibility_holders} onChange={(e) => setQ("parental_responsibility_holders", e.target.value)} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0 16px" }}>
          <YesNo label="Is the child a 'Looked After Child'? (the local authority has sole or shared parental responsibility)" name="lac" value={questionnaire.is_looked_after_child} onChange={(v) => setQ("is_looked_after_child", v)} />
          <YesNo label="Is the child under a special guardianship order?" name="sgo" value={questionnaire.special_guardianship_order} onChange={(v) => setQ("special_guardianship_order", v)} />
          <YesNo label="Is the child under any other type of court order?" name="court_order" value={questionnaire.other_court_order} onChange={(v) => setQ("other_court_order", v)} />
          <YesNo label="Is the child adopted?" name="adopted" value={questionnaire.is_adopted} onChange={(v) => setQ("is_adopted", v)} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={label}>Any concerns during pregnancy or birth?</label>
          <textarea style={{ ...taStyle, minHeight: 80 }} name="pregnancy" value={questionnaire.pregnancy_concerns} onChange={(e) => setQ("pregnancy_concerns", e.target.value)} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={label}>Developmental milestones - please describe your child&apos;s development (walking, talking, toilet training, socialising etc.)</label>
          <textarea style={taStyle} name="milestones" value={questionnaire.developmental_milestones} onChange={(e) => setQ("developmental_milestones", e.target.value)} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={label}>Any previous assessments, diagnoses or professional involvement? (e.g. CAMHS, Educational Psychology, Speech and Language Therapy, OT)</label>
          <textarea style={{ ...taStyle, minHeight: 80 }} name="prev_assess" value={questionnaire.previous_assessments} onChange={(e) => setQ("previous_assessments", e.target.value)} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={label}>Are there any diagnosed neurodevelopmental conditions in the family? (e.g. ADHD, autism, dyslexia)</label>
          <textarea style={{ ...taStyle, minHeight: 80 }} name="family_hx" value={questionnaire.family_history_neurodev} onChange={(e) => setQ("family_history_neurodev", e.target.value)} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0 16px" }}>
          <Field label="Current medications (if any)" name="medications" value={questionnaire.current_medications} onChange={(v) => setQ("current_medications", v)} />
          <Field label="Any other health diagnoses or medical conditions" name="medical" value={questionnaire.other_medical_conditions} onChange={(v) => setQ("other_medical_conditions", v)} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={label}>How does your child react to other children?</label>
          <textarea style={{ ...taStyle, minHeight: 80 }} name="peer_reactions" value={questionnaire.how_child_reacts_to_others} onChange={(e) => setQ("how_child_reacts_to_others", e.target.value)} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={label}>Are there any agencies or professionals currently involved with your child? (e.g. social worker, family support worker, SALT, educational psychologist) If yes, please list their name and contact details.</label>
          <textarea style={{ ...taStyle, minHeight: 80 }} name="agencies" value={questionnaire.agencies_involved} onChange={(e) => setQ("agencies_involved", e.target.value)} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={label}>Are you worried about your child&apos;s safety, their behaviour, or that they might cause harm to themselves or someone else? If yes, please provide details.</label>
          <textarea style={{ ...taStyle, minHeight: 80 }} name="safeguarding" value={questionnaire.safeguarding_concerns} onChange={(e) => setQ("safeguarding_concerns", e.target.value)} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={label}>Is there anything else you would like to add that might be relevant to your child&apos;s neurodevelopmental assessment at Neuro Flow?</label>
          <textarea style={{ ...taStyle, minHeight: 80 }} name="anything_else" value={questionnaire.anything_else} onChange={(e) => setQ("anything_else", e.target.value)} />
        </div>
      </div>

      {/* ── Section 3: SDQ Parent ── */}
      <div style={card}>
        <div style={sectionTitle}>Section 3 - Strengths and Difficulties Questionnaire (SDQ)</div>
        <p style={mutedText}>
          For each item, please mark the box that best describes your child over the <strong>last six months</strong>. Answer all items as best you can even if you are not absolutely certain.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr repeat(3,96px)", gap: 8, marginBottom: 8 }}>
          <span />
          {["Not True", "Somewhat True", "Certainly True"].map((h) => (
            <span key={h} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "var(--muted)" }}>{h}</span>
          ))}
        </div>
        {SDQ_ITEMS.map((text, i) => (
          <SDQItem key={i} n={i + 1} text={text} value={sdq[i]}
            onChange={(v) => setSdq((r) => { const n = [...r]; n[i] = v; return n; })} />
        ))}
      </div>

      {/* ── Section 4: Conners Parent Rating Scale ── */}
      <div style={card}>
        <div style={sectionTitle}>Section 4 - Conners&apos; Parent Rating Scale – Revised (S)</div>
        <p style={mutedText}>
          Below are a number of common problems that children have. Please rate each item according to your child&apos;s behaviour in the <strong>last month</strong>. For each item, ask yourself &ldquo;How much of a problem has this been in the last month?&rdquo; and select the best answer.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr repeat(4,72px)", gap: 8, marginBottom: 8 }}>
          <span />
          {["Not true at all", "Just a little true", "Pretty much true", "Very much true"].map((h) => (
            <span key={h} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "var(--muted)" }}>{h}</span>
          ))}
        </div>
        {CPRS_ITEMS.map((text, i) => (
          <LikertItem key={i} n={i + 1} text={text} value={cprs[i]}
            onChange={(v) => setCprs((r) => { const n = [...r]; n[i] = v; return n; })} />
        ))}
      </div>

      {/* ── Section 5: Teacher details ── */}
      <div style={card}>
        <div style={sectionTitle}>Section 5 - School / teacher details</div>
        <p style={mutedText}>
          As part of your child&apos;s assessment, it is necessary to liaise with a professional who knows your child well. We will send your child&apos;s teacher the <strong>Conners&apos; Teacher Rating Scale</strong> to complete on your child&apos;s behalf.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0 16px" }}>
          <Field label="Teacher's name" name="teacher_name" value={teacherName} onChange={setTeacherName} />
          <Field label="Teacher's email address" name="teacher_email" type="text" value={teacherEmail} onChange={setTeacherEmail} />
        </div>
      </div>

      {/* ── Section 6: GP details ── */}
      <div style={card}>
        <div style={sectionTitle}>Section 6 - GP / family doctor details</div>
        <p style={mutedText}>We will contact your child&apos;s GP to request relevant medical history as part of the assessment.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0 16px" }}>
          <Field label="GP name" name="gp_name" value={gpName} onChange={setGpName} />
          <Field label="GP practice name" name="gp_practice" value={gpPractice} onChange={setGpPractice} />
          <Field label="GP email address" name="gp_email" type="text" value={gpEmail} onChange={setGpEmail} />
        </div>
      </div>

      {/* ── Privacy notice ── */}
      <div style={{ ...card, background: "var(--muted-50, #f8f9fc)", border: "1px solid var(--muted-100)" }}>
        <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.7, margin: 0 }}>
          Neuro Flow handles your personal information in accordance with the Data Protection Act 2018 and the General Data Protection Regulations 2018. We will process personal information in ways that respect your individual rights and in line with our company values, exercising the highest standards of confidentiality, integrity and trust. For more information please see the Privacy Notice on our website or email <strong>support@neuroflow.app</strong>.
        </p>
      </div>

      {error && <p style={errorText}>{error}</p>}
      <button type="submit" disabled={loading} className="primary-action"
        style={{ ...submitButton, opacity: loading ? 0.7 : 1, cursor: loading ? "not-allowed" : "pointer" }}>
        {loading ? "Submitting…" : "Submit form"}
      </button>
    </form>
  );
}

// ── Adolescent form (11–17) - SDQ self-report + Parent questionnaire + Conners Parent ──

function AdolescentSelfForm({
  token,
  clientName,
  prefill = {},
  onSuccess,
}: {
  token: string;
  clientName: string;
  prefill?: Record<string, string | undefined>;
  onSuccess: () => void;
}) {
  const taStyle: React.CSSProperties = {
    ...input, minHeight: 100, resize: "vertical" as const, fontFamily: "inherit",
  };

  // ── Consent ──
  const [consentAssessment, setConsentAssessment] = useState(false);
  const [consentComms, setConsentComms] = useState(false);

  // ── Young person details - pre-filled where available ──
  const [youngPerson, setYoungPerson] = useState({
    dob: prefill.child_dob || "",
    gender: "", ethnicity: "", religion: "",
    school: prefill.school_name || "",
    school_year: "",
    home_address: prefill.address || "",
    primary_language: "",
    previous_assessments: "", current_medications: "",
    child_needs_interpreter: "", parent_needs_interpreter: "",
  });
  const [parent, setParent] = useState({
    parent_name: prefill.parent_name || "",
    relationship: "",
    parent_phone: prefill.parent_phone || prefill.phone || "",
    parent_email: prefill.email || "",
    main_concerns: "", goals_of_assessment: "", when_concerns_started: "",
    pregnancy_concerns: "", developmental_milestones: "",
    family_history_neurodev: "", other_medical_conditions: "",
    parental_responsibility_holders: "",
    is_looked_after_child: "", special_guardianship_order: "",
    other_court_order: "", is_adopted: "",
    agencies_involved: "", safeguarding_concerns: "", anything_else: "",
  });
  const [diagnosedDisabilities, setDiagnosedDisabilities] = useState<string[]>([]);
  const [commsSupport, setCommsSupport] = useState<string[]>(["None"]);
  const [sdqSelf, setSdqSelf] = useState<number[]>(Array(SDQ_SELF_ITEMS.length).fill(-1));
  const [cprs, setCprs] = useState<number[]>(Array(CPRS_ITEMS.length).fill(-1));
  const [teacherName, setTeacherName] = useState(prefill.teacher_name || "");
  const [teacherEmail, setTeacherEmail] = useState(prefill.teacher_email || "");
  const [gpName, setGpName] = useState(prefill.gp_name || "");
  const [gpPractice, setGpPractice] = useState(prefill.gp_practice || "");
  const [gpEmail, setGpEmail] = useState(prefill.gp_email || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function setYP(k: string, v: string) { setYoungPerson((p) => ({ ...p, [k]: v })); }
  function setP(k: string, v: string) { setParent((p) => ({ ...p, [k]: v })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!consentAssessment) {
      setError("You must give consent for Neuro Flow to carry out the neurodevelopmental assessment before submitting.");
      return;
    }
    if (sdqSelf.some((r) => r === -1)) {
      setError("Please complete all SDQ items in Section 3 (young person self-report).");
      return;
    }
    if (cprs.some((r) => r === -1)) {
      setError("Please complete all Conners Parent Rating Scale items in Section 4.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(browserApiUrl(`/api/v1/forms/submit/${token}`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          responses: {
            consent: { assessment: consentAssessment, communications: consentComms },
            young_person: youngPerson,
            parent_details: parent,
            diagnosed_disabilities: diagnosedDisabilities,
            comms_support_needs: commsSupport,
            sdq_self_ratings: sdqSelf,
            cprs_ratings: cprs,
          },
          teacher_name: teacherName || null,
          teacher_email: teacherEmail || null,
          gp_name: gpName || null,
          gp_practice: gpPractice || null,
          gp_email: gpEmail || null,
        }),
      });
      if (res.ok) onSuccess();
      else setError("Submission failed - please try again.");
    } catch {
      setError("Could not connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const consentCardStyle: React.CSSProperties = {
    ...card, border: "2px solid var(--brand)", background: "var(--brand-50, #f0f4ff)",
  };
  const consentRowStyle: React.CSSProperties = {
    display: "flex", alignItems: "flex-start", gap: 14,
    padding: "14px 0", borderBottom: "1px solid var(--card-border)",
  };

  return (
    <form onSubmit={handleSubmit}>

      {/* ── Consent ── */}
      <div style={consentCardStyle}>
        <div style={sectionTitle}>Consent</div>
        <p style={mutedText}>Please read each statement carefully and tick the box to confirm your consent before completing the rest of this form.</p>
        <div style={consentRowStyle}>
          <input type="checkbox" id="adol_consent_assessment" checked={consentAssessment}
            onChange={(e) => setConsentAssessment(e.target.checked)}
            style={{ width: 20, height: 20, marginTop: 2, accentColor: "var(--brand)", cursor: "pointer", flexShrink: 0 }} />
          <label htmlFor="adol_consent_assessment" style={{ fontSize: 15, color: "var(--ink)", lineHeight: 1.5, cursor: "pointer" }}>
            <strong>I give consent for Neuro Flow to carry out a neurodevelopmental assessment for my child.</strong>
            <span style={{ color: "var(--danger)", marginLeft: 4 }}>*</span>
          </label>
        </div>
        <div style={{ ...consentRowStyle, borderBottom: "none" }}>
          <input type="checkbox" id="adol_consent_comms" checked={consentComms}
            onChange={(e) => setConsentComms(e.target.checked)}
            style={{ width: 20, height: 20, marginTop: 2, accentColor: "var(--brand)", cursor: "pointer", flexShrink: 0 }} />
          <label htmlFor="adol_consent_comms" style={{ fontSize: 15, color: "var(--ink)", lineHeight: 1.5, cursor: "pointer" }}>
            I give consent for Neuro Flow to communicate with and provide letters/reports in relation to my child&apos;s assessment, treatment and progress to other relevant healthcare services or professionals.
          </label>
        </div>
      </div>

      {/* ── Section 1: Young person's details ── */}
      <div style={card}>
        <div style={sectionTitle}>Section 1 - Young person&apos;s details</div>
        <p style={mutedText}>To be completed by the parent or guardian together with the young person where possible.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0 16px" }}>
          <Field label="Date of birth" name="dob" type="date" required value={youngPerson.dob} onChange={(v) => setYP("dob", v)} />
          <Field label="Gender" name="gender" required value={youngPerson.gender} onChange={(v) => setYP("gender", v)} />
          <Field label="Home address" name="home_address" value={youngPerson.home_address} onChange={(v) => setYP("home_address", v)} />
          <Field label="School name" name="school" value={youngPerson.school} onChange={(v) => setYP("school", v)} />
          <Field label="School year" name="school_year" value={youngPerson.school_year} onChange={(v) => setYP("school_year", v)} />
          <Field label="Primary language spoken at home" name="primary_language" value={youngPerson.primary_language} onChange={(v) => setYP("primary_language", v)} />
          <Field label="Any previous assessments or diagnoses" name="prev_assess" value={youngPerson.previous_assessments} onChange={(v) => setYP("previous_assessments", v)} />
          <Field label="Current medications (if any)" name="medications" value={youngPerson.current_medications} onChange={(v) => setYP("current_medications", v)} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0 16px" }}>
          <SelectField label="Ethnicity" name="ethnicity" value={youngPerson.ethnicity} onChange={(v) => setYP("ethnicity", v)} options={ETHNICITY_OPTIONS} />
          <SelectField label="Religion" name="religion" value={youngPerson.religion} onChange={(v) => setYP("religion", v)} options={RELIGION_OPTIONS} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0 16px" }}>
          <YesNo label="Does the young person require a language translator / interpreter?" name="child_interp" value={youngPerson.child_needs_interpreter} onChange={(v) => setYP("child_needs_interpreter", v)} />
          <YesNo label="Do you (parent/guardian) require a language translator / interpreter?" name="parent_interp" value={youngPerson.parent_needs_interpreter} onChange={(v) => setYP("parent_needs_interpreter", v)} />
        </div>
      </div>

      {/* ── Section 2: Parent/guardian questionnaire ── */}
      <div style={card}>
        <div style={sectionTitle}>Section 2 - Parent / guardian questionnaire</div>
        <p style={mutedText}>Please work through each question in as much detail as possible.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0 16px" }}>
          <Field label="Parent / guardian name" name="parent_name" required value={parent.parent_name} onChange={(v) => setP("parent_name", v)} />
          <Field label="Relationship to young person" name="relationship" required value={parent.relationship} onChange={(v) => setP("relationship", v)} />
          <Field label="Contact phone" name="parent_phone" type="tel" value={parent.parent_phone} onChange={(v) => setP("parent_phone", v)} />
          <Field label="Contact email" name="parent_email" type="email" value={parent.parent_email} onChange={(v) => setP("parent_email", v)} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={label}>What is the reason for this referral? Please describe any concerns about your child&apos;s behaviour, any concerns from school, and any other relevant information. <span style={{ color: "var(--danger)" }}>*</span></label>
          <textarea style={taStyle} required name="main_concerns" value={parent.main_concerns} onChange={(e) => setP("main_concerns", e.target.value)} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={label}>What are you hoping to achieve from this assessment?</label>
          <textarea style={{ ...taStyle, minHeight: 80 }} name="goals" value={parent.goals_of_assessment} onChange={(e) => setP("goals_of_assessment", e.target.value)} />
        </div>
        <Field label="When did you first notice these concerns?" name="when_started" value={parent.when_concerns_started} onChange={(v) => setP("when_concerns_started", v)} />

        <CheckboxGroup legend="Does your child have any diagnosed disability? (tick all that apply)" options={DISABILITY_OPTIONS} selected={diagnosedDisabilities} onChange={setDiagnosedDisabilities} />
        <CheckboxGroup legend="Does your child have any communication support needs?" options={COMMS_SUPPORT_OPTIONS} selected={commsSupport} onChange={setCommsSupport} />

        <div style={{ marginBottom: 16 }}>
          <label style={label}>Please list ALL people who hold parental responsibility for your child</label>
          <textarea style={{ ...taStyle, minHeight: 80 }} name="parental_resp" value={parent.parental_responsibility_holders} onChange={(e) => setP("parental_responsibility_holders", e.target.value)} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0 16px" }}>
          <YesNo label="Is the child a 'Looked After Child'?" name="lac" value={parent.is_looked_after_child} onChange={(v) => setP("is_looked_after_child", v)} />
          <YesNo label="Is the child under a special guardianship order?" name="sgo" value={parent.special_guardianship_order} onChange={(v) => setP("special_guardianship_order", v)} />
          <YesNo label="Is the child under any other type of court order?" name="court_order" value={parent.other_court_order} onChange={(v) => setP("other_court_order", v)} />
          <YesNo label="Is the child adopted?" name="adopted" value={parent.is_adopted} onChange={(v) => setP("is_adopted", v)} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={label}>Developmental milestones (walking, talking, socialising, schooling)</label>
          <textarea style={{ ...taStyle, minHeight: 80 }} name="milestones" value={parent.developmental_milestones} onChange={(e) => setP("developmental_milestones", e.target.value)} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0 16px" }}>
          <Field label="Any concerns during pregnancy or birth" name="pregnancy" value={parent.pregnancy_concerns} onChange={(v) => setP("pregnancy_concerns", v)} />
          <Field label="Any diagnosed neurodevelopmental conditions in the family?" name="family_hx" value={parent.family_history_neurodev} onChange={(v) => setP("family_history_neurodev", v)} />
          <Field label="Any other health diagnoses or medical conditions" name="medical" value={parent.other_medical_conditions} onChange={(v) => setP("other_medical_conditions", v)} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={label}>Are there any agencies or professionals currently involved? (e.g. social worker, SALT, CAMHS) Please list name and contact details.</label>
          <textarea style={{ ...taStyle, minHeight: 80 }} name="agencies" value={parent.agencies_involved} onChange={(e) => setP("agencies_involved", e.target.value)} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={label}>Are you worried about your child&apos;s safety or that they might cause harm to themselves or others? If yes, please provide details.</label>
          <textarea style={{ ...taStyle, minHeight: 80 }} name="safeguarding" value={parent.safeguarding_concerns} onChange={(e) => setP("safeguarding_concerns", e.target.value)} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={label}>Is there anything else you would like to add that might be relevant to this neurodevelopmental assessment?</label>
          <textarea style={{ ...taStyle, minHeight: 80 }} name="anything_else" value={parent.anything_else} onChange={(e) => setP("anything_else", e.target.value)} />
        </div>
      </div>

      {/* ── Section 3: SDQ Self-report (young person) ── */}
      <div style={card}>
        <div style={sectionTitle}>Section 3 - Strengths and Difficulties Questionnaire (SDQ) - Young person self-report</div>
        <p style={mutedText}>
          <strong>This section is for the young person to complete.</strong> For each item, mark the box that best describes you over the <strong>last six months</strong>. Answer all items as best you can.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr repeat(3,96px)", gap: 8, marginBottom: 8 }}>
          <span />
          {["Not True", "Somewhat True", "Certainly True"].map((h) => (
            <span key={h} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "var(--muted)" }}>{h}</span>
          ))}
        </div>
        {SDQ_SELF_ITEMS.map((text, i) => (
          <SDQItem key={i} n={i + 1} text={text} value={sdqSelf[i]}
            onChange={(v) => setSdqSelf((r) => { const n = [...r]; n[i] = v; return n; })} />
        ))}
      </div>

      {/* ── Section 4: Conners Parent Rating Scale ── */}
      <div style={card}>
        <div style={sectionTitle}>Section 4 - Conners&apos; Parent Rating Scale – Revised (S)</div>
        <p style={mutedText}>
          <strong>This section is for the parent / guardian to complete.</strong> Please rate each item according to your child&apos;s behaviour in the <strong>last month</strong>. For each item, ask yourself &ldquo;How much of a problem has this been in the last month?&rdquo;
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr repeat(4,72px)", gap: 8, marginBottom: 8 }}>
          <span />
          {["Not true at all", "Just a little true", "Pretty much true", "Very much true"].map((h) => (
            <span key={h} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "var(--muted)" }}>{h}</span>
          ))}
        </div>
        {CPRS_ITEMS.map((text, i) => (
          <LikertItem key={i} n={i + 1} text={text} value={cprs[i]}
            onChange={(v) => setCprs((r) => { const n = [...r]; n[i] = v; return n; })} />
        ))}
      </div>

      {/* ── Section 5: Teacher details ── */}
      <div style={card}>
        <div style={sectionTitle}>Section 5 - School / teacher details</div>
        <p style={mutedText}>
          As part of the assessment, it is necessary to liaise with a professional in another context who knows the young person well. We will send their teacher the <strong>Conners&apos; Teacher Rating Scale</strong> to complete.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0 16px" }}>
          <Field label="Teacher's name" name="teacher_name" value={teacherName} onChange={setTeacherName} />
          <Field label="Teacher's email address" name="teacher_email" type="text" value={teacherEmail} onChange={setTeacherEmail} />
        </div>
      </div>

      {/* ── Section 6: GP details ── */}
      <div style={card}>
        <div style={sectionTitle}>Section 6 - GP / family doctor details</div>
        <p style={mutedText}>We will contact the GP to request relevant medical history as part of the assessment.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0 16px" }}>
          <Field label="GP name" name="gp_name" value={gpName} onChange={setGpName} />
          <Field label="GP practice name" name="gp_practice" value={gpPractice} onChange={setGpPractice} />
          <Field label="GP email address" name="gp_email" type="text" value={gpEmail} onChange={setGpEmail} />
        </div>
      </div>

      {/* ── Privacy notice ── */}
      <div style={{ ...card, background: "var(--muted-50, #f8f9fc)", border: "1px solid var(--muted-100)" }}>
        <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.7, margin: 0 }}>
          Neuro Flow handles your personal information in accordance with the Data Protection Act 2018 and the General Data Protection Regulations 2018. We will process personal information in ways that respect your individual rights and in line with our company values, exercising the highest standards of confidentiality, integrity and trust. For more information please see the Privacy Notice on our website or email <strong>support@neuroflow.app</strong>.
        </p>
      </div>

      {error && <p style={errorText}>{error}</p>}
      <button type="submit" disabled={loading} className="primary-action"
        style={{ ...submitButton, opacity: loading ? 0.7 : 1, cursor: loading ? "not-allowed" : "pointer" }}>
        {loading ? "Submitting…" : "Submit form"}
      </button>
    </form>
  );
}

// ── Teacher / GP third-party form ──────────────────────────────────────────

// Conners' Teacher Rating Scale – Revised (S)  CTRS-R(S)  28 items
// Scale: 0 = Not True At All  1 = Just A Little True  2 = Pretty Much True  3 = Very Much True
const CTRS_ITEMS = [
  "Inattentive, easily distracted",
  "Defiant",
  "Restless in the \"squirmy\" sense",
  "Forgets things he/she has already learned",
  "Disturbs other children",
  "Actively defies or refuses to comply with adults' requests",
  "Is always \"on the go\" or acts as if driven by a motor",
  "Poor in spelling",
  "Cannot remain still",
  "Spiteful or vindictive",
  "Leaves seat in classroom or in other situations in which remaining seated is expected",
  "Fidgets with hands or feet or squirms in seat",
  "Not reading up to par",
  "Short attention span",
  "Argues with adults",
  "Only pays attention to things he/she is really interested in",
  "Has difficulty waiting his/her turn",
  "Lacks interest in schoolwork",
  "Distractibility or attention span a problem",
  "Temper outbursts; explosive, unpredictable behaviour",
  "Runs about or climbs excessively in situations where it is inappropriate",
  "Poor in arithmetic",
  "Interrupts or intrudes on others (e.g., butts into others' conversations or games)",
  "Has difficulty playing or engaging in leisure activities quietly",
  "Fails to finish things he/she starts",
  "Does not follow through on instructions and fails to finish schoolwork (not due to oppositional behaviour or failure to understand instructions)",
  "Excitable, impulsive",
  "Restless, always up and on the go",
];

function ThirdPartyForm({
  token,
  clientName,
  formType,
  onSuccess,
}: {
  token: string;
  clientName: string;
  formType: string;
  onSuccess: () => void;
}) {
  const isTeacher = formType === "child_teacher" || formType === "adolescent_teacher";
  const [info, setInfo] = useState({
    respondent_name: "",
    respondent_role: isTeacher ? "Teacher" : "GP",
    relationship_to_client: "",
  });
  const [ratings, setRatings] = useState<number[]>(
    Array(isTeacher ? CTRS_ITEMS.length : 8).fill(-1),
  );
  const [gpNotes, setGpNotes] = useState({
    relevant_history: "",
    current_medications: "",
    previous_referrals: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function setI(k: string, v: string) {
    setInfo((p) => ({ ...p, [k]: v }));
  }
  function setG(k: string, v: string) {
    setGpNotes((p) => ({ ...p, [k]: v }));
  }

  const GP_ITEMS = [
    "The patient has a history of attention or concentration difficulties",
    "The patient has a history of hyperactivity or impulsivity",
    "There are known coexisting conditions relevant to this assessment",
    "The patient is currently on medication that may affect behaviour or cognition",
    "There have been previous referrals for similar concerns",
    "The patient has a family history of ADHD or autism",
    "There are any safeguarding concerns I am aware of",
    "I support this assessment referral",
  ];

  const items = isTeacher ? CTRS_ITEMS : GP_ITEMS;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (ratings.some((r) => r === -1)) {
      setError("Please answer all items.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(browserApiUrl(`/api/v1/forms/submit/${token}`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          responses: isTeacher
            ? { respondent: info, conners_ratings: ratings }
            : { respondent: info, gp_checklist: ratings, notes: gpNotes },
        }),
      });
      if (res.ok) onSuccess();
      else setError("Submission failed - please try again.");
    } catch {
      setError("Could not connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={card}>
        <div style={sectionTitle}>Your details</div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "0 16px",
          }}
        >
          <Field
            label="Your name"
            name="name"
            required
            value={info.respondent_name}
            onChange={(v) => setI("respondent_name", v)}
          />
          <Field
            label="Your role"
            name="role"
            value={info.respondent_role}
            onChange={(v) => setI("respondent_role", v)}
          />
        </div>
      </div>

      <div style={card}>
        <div style={sectionTitle}>
          {isTeacher
            ? `Conners Teacher Rating Scale - ${clientName}`
            : `Clinical checklist - ${clientName}`}
        </div>
        <p style={mutedText}>
          {isTeacher
            ? "Rate each item based on the child's behaviour over the last month."
            : "For each item, indicate how much it applies based on your knowledge of this patient."}
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr repeat(4,72px)",
            gap: 8,
            marginBottom: 8,
          }}
        >
          <span />
          {["Not at all", "Just a little", "Pretty much", "Very much"].map(
            (h) => (
              <span
                key={h}
                style={{
                  textAlign: "center",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--muted)",
                }}
              >
                {h}
              </span>
            ),
          )}
        </div>
        {items.map((text, i) => (
          <LikertItem
            key={i}
            n={i + 1}
            text={text}
            value={ratings[i]}
            onChange={(v) =>
              setRatings((r) => {
                const n = [...r];
                n[i] = v;
                return n;
              })
            }
          />
        ))}
      </div>

      {!isTeacher && (
        <div style={card}>
          <div style={sectionTitle}>Additional notes</div>
          <Field
            label="Relevant medical history"
            name="history"
            value={gpNotes.relevant_history}
            onChange={(v) => setG("relevant_history", v)}
          />
          <Field
            label="Current medications"
            name="meds"
            value={gpNotes.current_medications}
            onChange={(v) => setG("current_medications", v)}
          />
          <Field
            label="Previous psychiatric or psychological referrals"
            name="referrals"
            value={gpNotes.previous_referrals}
            onChange={(v) => setG("previous_referrals", v)}
          />
        </div>
      )}

      {error && <p style={errorText}>{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="primary-action"
        style={{
          ...submitButton,
          opacity: loading ? 0.7 : 1,
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "Submitting…" : "Submit"}
      </button>
    </form>
  );
}

// ── Router ─────────────────────────────────────────────────────────────────

// ── Prefill type ──────────────────────────────────────────────────────────
interface Prefill {
  full_name?: string;
  email?: string;
  phone?: string;
  dob?: string;
  address?: string;
  gp_name?: string;
  gp_practice?: string;
  gp_email?: string;
  child_name?: string;
  child_dob?: string;
  parent_name?: string;
  parent_phone?: string;
  teacher_name?: string;
  teacher_email?: string;
  school_name?: string;
  [key: string]: string | undefined;
}

export function FormRouter({
  token,
  formType,
  clientName,
  clientEmail,
  prefill = {},
}: {
  token: string;
  formType: string;
  clientName: string;
  clientEmail?: string | null;
  prefill?: Prefill;
}) {
  const router = useRouter();

  function onSuccess() {
    router.push("/forms/submitted");
  }

  if (formType === "basic_intake")
    return (
      <BasicIntakeForm
        token={token}
        clientName={clientName}
        clientEmail={clientEmail}
        prefill={prefill}
        onSuccess={onSuccess}
      />
    );
  if (formType === "adult_self")
    return (
      <AdultSelfForm
        token={token}
        clientName={clientName}
        prefill={prefill}
        onSuccess={onSuccess}
      />
    );
  if (formType === "child_parent")
    return (
      <ChildParentForm
        token={token}
        clientName={clientName}
        prefill={prefill}
        onSuccess={onSuccess}
      />
    );
  if (formType === "adolescent_self")
    return (
      <AdolescentSelfForm
        token={token}
        clientName={clientName}
        prefill={prefill}
        onSuccess={onSuccess}
      />
    );
  if (
    formType === "child_teacher" ||
    formType === "child_gp" ||
    formType === "adult_gp" ||
    formType === "adolescent_gp" ||
    formType === "adolescent_teacher"
  )
    return (
      <ThirdPartyForm
        token={token}
        clientName={clientName}
        formType={formType}
        onSuccess={onSuccess}
      />
    );

  return <p style={{ color: "var(--danger)", fontWeight: 700 }}>Unknown form type: {formType}</p>;
}
