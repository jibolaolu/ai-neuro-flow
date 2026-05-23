/**
 * Neuro Flow — NHS Adult ADHD Report Schema
 *
 * Exact structural map of the Neuro Flow portal form (DIVA-5 based).
 * Verified page-by-page against the printed PDF template (17 pages).
 *
 * 4-part structure matching portal exactly:
 *   Section I    — Pre-report: Assessment Details (metadata, no input fields in form)
 *   Section II   — Summary of Adult ADHD Assessment
 *   Section III  — Adult ADHD Assessment (auto-generated narrative — no user input fields)
 *   Section IV   — Diagnostic Interview for ADHD in Adults (DIVA-5) + Results
 *
 * Section II numbering (exact portal):
 *   2.1   Clinical Impressions  +  inline "does/does not" dropdown  +  ADHD subtype dropdown
 *   2.2.1 Recommended medication (from today's appointment)
 *   2.2.2 Psychological
 *   2.2.3 Workplace / home adjustments
 *   2.2.4 Lifestyle
 *   2.3   Recommendations for fellow health professionals
 *   2.3.1 General recommendations (non-pharmacological)
 *   2.3.2 Initiating pharmacological treatment
 *   2.4   Plan
 *
 * Section IV numbering (exact portal):
 *   4.1  Presenting difficulties
 *   4.2  History of presenting difficulties
 *   4.3  Emotional regulation
 *   4.4  Other behaviour
 *   4.5  Psychiatric history
 *   4.6  Medical history and allergies  [checkboxes + notes textarea]
 *   4.7  Medication history
 *   4.8  Alcohol, tobacco and substance use history
 *   4.9  Forensic history
 *   4.10 Development history
 *   4.11 Educational history
 *   4.12 Social history
 *   4.12.1 Driving  [boolean + notes textarea]
 *   4.13 Family history  [checkboxes + notes textarea]
 *   4.14 Informant information
 *   4.15.1 Risk — Self health and wellbeing
 *   4.15.2 Risk to others
 *   4.15.3 Safeguarding concerns
 *   4.16 Other reports
 *   4.17 Mental state examination  [8 sub-fields: Appearance · Speech · Thoughts · Mood ·
 *                                    Perceptions · Cognitions · Insight · Capacity]
 *   4.18. DIVA
 *   4.18.1 Attention, concentration and focus  [9 bullet sub-fields]
 *   4.18.2 Activity levels and impulsivity     [9 bullet sub-fields]
 *   4.19.1–4.19.6 DIVA-5 Summary  [booleans + scales]
 *   4.20 Questionnaire results (appendix 2)  [dynamic table]
 *   4.21 Conners questionnaire  [structured T-score table + Conners summary textarea — 5000 chars]
 *   4.22 Results  [inline dropdown: "Please choose" consistent / not consistent]
 *   4.23 Formulation and differential diagnosis  [textarea — 3000 chars]
 *   4.24 Summary  [textarea — 1500 chars]
 *
 * Storage model:
 *   Scalar / text fields      → plain string
 *   Checkbox groups           → comma-separated string  (e.g. "Tics,None")
 *   Boolean (Yes/No)          → "true" | "false"
 *   Scale (1–9)               → numeric string  (e.g. "7")
 *   Dropdown                  → selected option string
 *   Conners structured table  → JSON string  (ConnersData)
 *
 * Character limits are taken exactly from the portal counter (e.g. "171/1000 characters").
 */

// ── Field type taxonomy ───────────────────────────────────────────────────────

export type FieldKind =
  | "textarea"        // Free text with character limit
  | "text"            // Single-line text
  | "checkbox-group"  // Multi-select (stored as comma-separated)
  | "dropdown"        // Single-select dropdown
  | "boolean"         // Yes / No radio pair
  | "scale"           // Numeric selector (e.g. 1–9)
  | "inline-statement"// Sentence with embedded dropdown(s) — e.g. 2.1 diagnosis statement
  | "structured"      // Composite field (stored as JSON) — e.g. Conners table
  | "table"           // Dynamic data table (read-only / populated externally)
  | "auto-text";      // Portal auto-generates this text — display only, no input

export interface BaseField {
  key: string;
  sectionNumber: string;   // Exact portal section number, e.g. "2.3.1", "4.18.1"
  label: string;
  kind: FieldKind;
  required?: boolean;
  depth?: 1 | 2 | 3;      // 1 = section heading, 2 = subsection, 3 = sub-subsection
}

export interface TextareaField extends BaseField {
  kind: "textarea";
  maxChars: number;
  placeholder?: string;
}

export interface TextField extends BaseField {
  kind: "text";
  placeholder?: string;
}

export interface CheckboxGroupField extends BaseField {
  kind: "checkbox-group";
  instruction: string;            // e.g. "select all that apply"
  options: readonly string[];
  notesKey?: string;              // Key of companion textarea below the checkboxes
  notesLabel?: string;
  notesMaxChars?: number;
}

export interface DropdownField extends BaseField {
  kind: "dropdown";
  options: readonly string[];
  placeholder?: string;
}

export interface BooleanField extends BaseField {
  kind: "boolean";
  trueLabel?: string;    // defaults to "Yes"
  falseLabel?: string;   // defaults to "No"
}

export interface ScaleField extends BaseField {
  kind: "scale";
  instruction: string;
  min: number;
  max: number;
}

/**
 * A sentence containing one or more embedded dropdowns.
 * e.g.  "[Patient] {does_dropdown} fulfil the diagnostic criteria for ADHD, subtype: {subtype_dropdown}"
 * templateParts interleaves literal strings with {dropdownKey} tokens.
 */
export interface InlineStatementField extends BaseField {
  kind: "inline-statement";
  templateParts: string[];         // Alternating: literal · {key} · literal · {key} …
  dropdowns: {
    key: string;
    options: readonly string[];
  }[];
  /** When true, renders field.label as a purple heading above the inline sentence */
  showLabel?: boolean;
}

export interface AutoTextField extends BaseField {
  kind: "auto-text";
  description: string;             // Describes what the portal auto-generates here
  /** Actual displayable text. Supports {clientName}, {assessmentDate}, {assessedBy} placeholders. */
  content?: string;
  /** When true, renders the label as a section heading even when content is also present. */
  showLabel?: boolean;
}

export interface StructuredField extends BaseField {
  kind: "structured";
  description?: string;
  subFields: SubField[];
}

export type SubField = {
  key: string;
  label: string;
  kind: "text" | "textarea";
  maxChars?: number;
  placeholder?: string;
};

export interface TableField extends BaseField {
  kind: "table";
  description: string;
  columns: readonly string[];
  rows: TableRowDef[];
}

export type TableRowDef = {
  key: string;
  label: string;
};

export type NHSReportField =
  | TextareaField
  | TextField
  | CheckboxGroupField
  | DropdownField
  | BooleanField
  | ScaleField
  | InlineStatementField
  | AutoTextField
  | StructuredField
  | TableField;

export type ReportSectionGroup = {
  sectionNumber: string;
  sectionLabel: string;
  autoGenerated?: boolean;   // true = Section III — no user input fields
  fields: NHSReportField[];
};

export type NHSAdhdReportSchema = {
  id: "nhs_adult_adhd_diva5";
  label: "NHS Adult ADHD";
  version: string;
  sections: ReportSectionGroup[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

export function flatFields(schema: NHSAdhdReportSchema): NHSReportField[] {
  return schema.sections.flatMap((s) => s.fields);
}

export function fieldByKey(
  schema: NHSAdhdReportSchema,
  key: string,
): NHSReportField | undefined {
  return flatFields(schema).find((f) => f.key === key);
}

// ── Option constants ──────────────────────────────────────────────────────────

export const ADHD_FULFILS_OPTIONS = ["does", "does not"] as const;

export const ADHD_SUBTYPE_OPTIONS = [
  "combined",
  "predominantly inattentive",
  "predominantly hyperactive-impulsive",
  "other specified",
  "unspecified",
] as const;

export const MEDICAL_HISTORY_OPTIONS = [
  "Tics",
  "Heart disease",
  "High blood pressure",
  "Head injuries / concussion",
  "Epilepsy / seizures",
  "Liver disease",
  "None",
] as const;

export const FAMILY_HISTORY_OPTIONS = [
  "Cardiovascular disease",
  "Sudden death before age of 55",
  "None",
] as const;

export const RESULTS_CONSISTENT_OPTIONS = [
  "consistent",
  "not consistent",
] as const;

// ── Conners 4 types ───────────────────────────────────────────────────────────

/**
 * T-score row in either the Content Scales or Functional Outcome Scales tables.
 * Colour bands: green ≤59 | yellow 60–69 | red ≥70
 */
export type ConnersScaleRow = {
  scale: string;
  child?: number | null;
  parent?: number | null;
  teacher?: number | null;    // null = not applicable (e.g. Family Life)
  flags?: string[];
};

/** Conners 4-ADHD Index summary rows */
export type ConnersIndexRow = {
  label: "Raw Score" | "Probability Score" | "Guideline";
  child?: string | number | null;
  parent?: string | number | null;
  teacher?: string | number | null;
};

/**
 * Full Conners 4 data stored as JSON string under section key "4_21_conners_data".
 *
 * Content Scales (4 rows × 3 raters):
 *   Inattention/Executive Dysfunction · Hyperactivity · Impulsivity · Emotional Dysregulation
 *
 * Impairment & Functional Outcome Scales (3 rows):
 *   Schoolwork · Peer Interactions · Family Life  (Family Life has no Teacher column)
 *
 * Conners 4-ADHD Index (3 rows):
 *   Raw Score · Probability Score · Guideline
 */
export type ConnersData = {
  content_scales: ConnersScaleRow[];
  functional_scales: ConnersScaleRow[];
  adhd_index: ConnersIndexRow[];
  summary: string;    // Free text — maxChars: 5000
};

export const CONNERS_CONTENT_SCALE_KEYS = [
  "inattention_executive",
  "hyperactivity",
  "impulsivity",
  "emotional_dysregulation",
] as const;

export const CONNERS_CONTENT_SCALE_LABELS: Record<
  (typeof CONNERS_CONTENT_SCALE_KEYS)[number],
  string
> = {
  inattention_executive: "Inattention / Executive Dysfunction",
  hyperactivity:         "Hyperactivity",
  impulsivity:           "Impulsivity",
  emotional_dysregulation: "Emotional Dysregulation",
};

export const CONNERS_FUNCTIONAL_SCALE_KEYS = [
  "schoolwork",
  "peer_interactions",
  "family_life",
] as const;

export const CONNERS_FUNCTIONAL_SCALE_LABELS: Record<
  (typeof CONNERS_FUNCTIONAL_SCALE_KEYS)[number],
  string
> = {
  schoolwork:       "Schoolwork",
  peer_interactions:"Peer Interactions",
  family_life:      "Family Life",
};

/** Family Life has no Teacher column */
export const CONNERS_NO_TEACHER_SCALES: string[] = ["family_life"];

export function emptyConnersData(): ConnersData {
  return {
    content_scales: CONNERS_CONTENT_SCALE_KEYS.map((key) => ({
      scale: CONNERS_CONTENT_SCALE_LABELS[key],
      child: null,
      parent: null,
      teacher: null,
      flags: [],
    })),
    functional_scales: CONNERS_FUNCTIONAL_SCALE_KEYS.map((key) => ({
      scale: CONNERS_FUNCTIONAL_SCALE_LABELS[key],
      child: null,
      parent: null,
      teacher: CONNERS_NO_TEACHER_SCALES.includes(key) ? null : null,
      flags: [],
    })),
    adhd_index: [
      { label: "Raw Score",         child: null, parent: null, teacher: null },
      { label: "Probability Score", child: null, parent: null, teacher: null },
      { label: "Guideline",         child: null, parent: null, teacher: null },
    ],
    summary: "",
  };
}

/** Returns CSS colour class for a Conners T-score */
export function connersScoreColor(
  tscore: number | null | undefined,
): "green" | "yellow" | "red" | "none" {
  if (tscore == null) return "none";
  if (tscore >= 70)   return "red";
  if (tscore >= 60)   return "yellow";
  return "green";
}

// ─────────────────────────────────────────────────────────────────────────────
//  NHS Adult ADHD — Full schema
// ─────────────────────────────────────────────────────────────────────────────

export const NHS_ADULT_ADHD_SCHEMA: NHSAdhdReportSchema = {
  id: "nhs_adult_adhd_diva5",
  label: "NHS Adult ADHD",
  version: "2.0.0",

  sections: [

    // =========================================================================
    // SECTION I — Pre-report / Assessment Details
    // (Shown on the "Continue Report" screen before the report form opens)
    // =========================================================================
    {
      sectionNumber: "I",
      sectionLabel: "Assessment Details",
      fields: [
        {
          key: "report_type",
          sectionNumber: "I",
          label: "Report type",
          kind: "text",
          placeholder: "NHS Adult ADHD",
          required: true,
          depth: 1,
        } satisfies TextField,

        {
          key: "place_of_assessment",
          sectionNumber: "I",
          label: "Place of assessment",
          kind: "text",
          placeholder: "e.g. Neuro Flow NHS, Video assessment",
          depth: 1,
        } satisfies TextField,

        {
          key: "assessed_by",
          sectionNumber: "I",
          label: "Assessed by",
          kind: "text",
          placeholder: "Clinician name and credentials",
          depth: 1,
        } satisfies TextField,
      ],
    },

    // =========================================================================
    // SECTION II — Summary of Adult ADHD Assessment
    // =========================================================================
    {
      sectionNumber: "II",
      sectionLabel: "Summary of Adult ADHD Assessment",
      fields: [

        // ── 2.1 Clinical Impressions ──────────────────────────────────────
        {
          key: "2_1_preamble",
          sectionNumber: "2.1",
          label: "Clinical impressions preamble",
          kind: "auto-text",
          depth: 1,
          description: "Auto-populated opening sentence for section 2.1.",
          content:
            "On {assessmentDate}, I met with {clientName} to carry out an ADHD assessment. " +
            "During the interview, {clientName} shared the following information.",
        } satisfies AutoTextField,

        {
          key: "2_1_clinical_impressions",
          sectionNumber: "2.1",
          label: "Clinical impressions",
          kind: "textarea",
          maxChars: 3000,
          required: true,
          depth: 1,
          placeholder:
            "Provide a clinical summary of the presenting picture, core difficulties, " +
            "and relevant background observed during the assessment.",
        } satisfies TextareaField,

        {
          key: "2_1_post_text",
          sectionNumber: "2.1",
          label: "Assessment methodology note",
          kind: "auto-text",
          depth: 1,
          description: "Auto-generated bridge sentence before the diagnosis inline statement.",
          content:
            "The assessment included a DIVA-5 diagnostic interview and relevant assessment " +
            "measures completed by the patient's informant (Mother). Based on this information " +
            "and my own clinical observations, I conclude that",
        } satisfies AutoTextField,

        /**
         * Inline sentence at the bottom of section 2.1:
         * "[Patient] [does ▼] fulfil the diagnostic criteria for
         *  Attention Deficit Hyperactivity Disorder (ADHD), subtype: [combined ▼]"
         *
         * Two embedded dropdowns:
         *   - fulfils_criteria  : "does" | "does not"
         *   - adhd_subtype      : "combined" | "predominantly inattentive" | …
         */
        {
          key: "2_1_diagnosis_statement",
          sectionNumber: "2.1",
          label: "Diagnostic criteria statement",
          kind: "inline-statement",
          required: true,
          depth: 1,
          templateParts: [
            "[Patient] ",
            " fulfil the diagnostic criteria for Attention Deficit Hyperactivity Disorder (ADHD), subtype: ",
            ".",
          ],
          dropdowns: [
            {
              key: "fulfils_criteria",
              options: ADHD_FULFILS_OPTIONS,
            },
            {
              key: "adhd_subtype",
              options: ADHD_SUBTYPE_OPTIONS,
            },
          ],
        } satisfies InlineStatementField,

        // ── 2.2 Recommendations ───────────────────────────────────────────
        {
          key: "2_2_heading",
          sectionNumber: "2.2",
          label: "2.2. Recommendations",
          kind: "auto-text",
          depth: 1,
          description: "Section 2.2 heading — rendered as a purple heading in the portal.",
        } satisfies AutoTextField,

        {
          key: "2_2_1_medication",
          sectionNumber: "2.2.1",
          label: "Recommended medication (from today's appointment)",
          kind: "textarea",
          maxChars: 1000,
          depth: 2,
          placeholder:
            "Detail any medication recommended following today's appointment.",
        } satisfies TextareaField,

        {
          key: "2_2_2_psychological",
          sectionNumber: "2.2.2",
          label: "Psychological",
          kind: "textarea",
          maxChars: 1000,
          depth: 2,
          placeholder:
            "Psychological recommendations including CBT, ADHD coaching, " +
            "psychoeducation, DBT-informed emotion regulation skills.",
        } satisfies TextareaField,

        {
          key: "2_2_3_workplace_home",
          sectionNumber: "2.2.3",
          label: "Workplace / home adjustments",
          kind: "textarea",
          maxChars: 1000,
          depth: 2,
          placeholder:
            "Recommended workplace and home adjustments. Include reasonable adjustments " +
            "under the Equality Act 2010. Environmental and organisational strategies.",
        } satisfies TextareaField,

        {
          key: "2_2_4_lifestyle",
          sectionNumber: "2.2.4",
          label: "Lifestyle",
          kind: "textarea",
          maxChars: 1000,
          depth: 2,
          placeholder:
            "Lifestyle recommendations including sleep hygiene, exercise, diet, " +
            "routine structures, and mindfulness.",
        } satisfies TextareaField,

        // ── 2.3 Recommendations for fellow health professionals ───────────
        {
          key: "2_3_heading",
          sectionNumber: "2.3",
          label: "2.3. Recommendations for fellow health professionals",
          kind: "auto-text",
          depth: 1,
          description: "Section 2.3 heading — rendered as a purple heading in the portal.",
        } satisfies AutoTextField,

        {
          key: "2_3_1_general_recommendations",
          sectionNumber: "2.3.1",
          label: "General recommendations (non-pharmacological)",
          kind: "textarea",
          maxChars: 1000,
          depth: 2,
          placeholder:
            "General onward recommendations for GP, IAPT, occupational health, and other " +
            "fellow health professionals. Non-pharmacological interventions.",
        } satisfies TextareaField,

        {
          key: "2_3_2_pharmacological",
          sectionNumber: "2.3.2",
          label: "Initiating pharmacological treatment",
          kind: "auto-text",
          depth: 2,
          showLabel: true,
          description: "Auto-generated pharmacological treatment bullets with client name.",
          content:
            "• Medication is one option for managing ADHD symptoms. If {clientName} chooses to " +
            "explore this route, they will begin titration, the first step in the medication " +
            "process. This process is designed to find the most effective medication and dose " +
            "with minimal side effects\n" +
            "• As a diagnosis has been made and medication is recommended, {clientName} will be " +
            "invited to join our NHS Right to Choose medication waiting list within one week of " +
            "this report being issued. {clientName} may choose to accept this invitation or " +
            "explore other ADHD treatment services with their GP.\n" +
            "• {clientName} can learn more about the medication titration process and check " +
            "up-to-date wait times here:\n" +
            "https://www.neuroflow.app/resources/nhs-right-to-choose",
        } satisfies AutoTextField,

        // ── 2.4 Plan ──────────────────────────────────────────────────────
        {
          key: "2_4_plan",
          sectionNumber: "2.4",
          label: "Plan",
          kind: "textarea",
          maxChars: 1000,
          required: true,
          depth: 1,
          placeholder: "E.g. discharge from our service back to NHS",
        } satisfies TextareaField,
      ],
    },

    // =========================================================================
    // SECTION III — Adult ADHD Assessment
    // Auto-generated narrative section — no user input fields.
    // Portal renders methodology text + boilerplate DSM-5 criteria description.
    // =========================================================================
    {
      sectionNumber: "III",
      sectionLabel: "Adult ADHD Assessment",
      autoGenerated: true,
      fields: [
        {
          key: "3_auto_methodology",
          sectionNumber: "III",
          label: "Assessment methodology",
          kind: "auto-text",
          depth: 1,
          description: "Auto-generated assessment methodology paragraph.",
          content:
            "The ADHD Assessment carried out by Neuro Flow involves combining information " +
            "about {clientName} from a number of sources, including the use of structured and " +
            "highly regarded diagnostic tools.\n\n" +
            "The assessment comprised of:\n" +
            "• The Diagnostic Interview for ADHD in adults (DIVA-5) was administered by " +
            "{assessedBy} with {clientName} which helped to assess core symptoms of inattention, " +
            "hyperactivity and impulsivity. The instrument is a clinical interview designed " +
            "specifically to examine the presence of core symptoms of ADHD during both childhood " +
            "and adulthood as well as associated impairments.\n" +
            "• Questionnaires completed by {clientName} and an informant (Mother). " +
            "A summary of these measures is shown in Appendix 3.",
        } satisfies AutoTextField,

        {
          key: "3_1_diagnostic_criteria",
          sectionNumber: "3.1",
          label: "Diagnostic criteria for Attention Deficit Hyperactivity Disorder (ADHD)",
          kind: "auto-text",
          depth: 1,
          showLabel: true,
          description: "Auto-generated DSM-5 criteria explanation.",
          content:
            "The ADHD assessment was conducted by evaluating {clientName}'s performance and " +
            "behaviour in correspondence with the diagnostic criteria set out by the Diagnostic " +
            "and Statistical Manual of Mental Disorders, 5th Edition: (DSM-5).\n\n" +
            "The manual diagnoses ADHD based on a persistent pattern of inattention and/or " +
            "hyperactivity-impulsivity that interferes with functioning or development. The DSM-5 " +
            "criteria include three subtypes of ADHD: predominantly inattentive, predominantly " +
            "hyperactive/impulsive, and combined presentation.\n\n" +
            "Because ADHD is a lifelong condition that starts in childhood, it is essential to " +
            "assess core symptoms, their trajectory and the extent to which they have impaired " +
            "functioning across multiple settings.",
        } satisfies AutoTextField,
      ],
    },

    // =========================================================================
    // SECTION IV — Diagnostic Interview for ADHD in Adults (DIVA-5)
    // =========================================================================
    {
      sectionNumber: "IV",
      sectionLabel: "Diagnostic Interview for ADHD in Adults (DIVA-5)",
      fields: [

        // ── IV Preamble (auto-generated) ──────────────────────────────────
        {
          key: "4_0_preamble",
          sectionNumber: "IV",
          label: "DIVA-5 preamble",
          kind: "auto-text",
          depth: 1,
          description: "Auto-generated DIVA-5 introduction paragraph.",
          content:
            "In order to clarify the diagnosis, the DIVA-5 diagnostic interview for ADHD in " +
            "adults was conducted by {assessedBy}. The DIVA-5 is a structured clinical interview " +
            "designed to support healthcare practitioners in assessing ADHD in adults. The " +
            "DIVA-5 interview focuses on core diagnostic symptoms of ADHD (inattention, " +
            "hyperactivity and impulsivity) in adulthood as well as childhood, and significant " +
            "impairments due to these symptoms.\n\n" +
            "Information gathered from questionnaires, \"Your Background\" form completed by " +
            "{clientName} and her informant (Mother), and the clinical interview with {clientName} " +
            "included:",
        } satisfies AutoTextField,

        // ── 4.1 Presenting difficulties ──────────────────────────────────
        {
          key: "4_1_presenting_difficulties",
          sectionNumber: "4.1",
          label: "Presenting difficulties",
          kind: "textarea",
          maxChars: 1000,
          required: true,
          depth: 1,
          placeholder:
            "Describe the patient's presenting difficulties as reported during the clinical interview.",
        } satisfies TextareaField,

        // ── 4.2 History of presenting difficulties ────────────────────────
        {
          key: "4_2_history_presenting",
          sectionNumber: "4.2",
          label: "History of presenting difficulties",
          kind: "textarea",
          maxChars: 1000,
          depth: 1,
          placeholder:
            "Chronological account of when difficulties first arose, their progression, " +
            "and current functional impact.",
        } satisfies TextareaField,

        // ── 4.3 Emotional regulation ──────────────────────────────────────
        {
          key: "4_3_emotional_regulation",
          sectionNumber: "4.3",
          label: "Emotional regulation",
          kind: "textarea",
          maxChars: 1000,
          depth: 1,
          placeholder:
            "Describe emotional dysregulation, mood lability, rejection sensitive dysphoria, " +
            "frustration tolerance, and emotional reactivity.",
        } satisfies TextareaField,

        // ── 4.4 Other behaviour ───────────────────────────────────────────
        {
          key: "4_4_other_behaviour",
          sectionNumber: "4.4",
          label: "Other behaviour",
          kind: "textarea",
          maxChars: 1000,
          depth: 1,
          placeholder: "Any additional behavioural observations not captured in other sections.",
        } satisfies TextareaField,

        // ── 4.5 Psychiatric history ───────────────────────────────────────
        {
          key: "4_5_psychiatric_history",
          sectionNumber: "4.5",
          label: "Psychiatric history",
          kind: "textarea",
          maxChars: 1000,
          depth: 1,
          placeholder:
            "Previous psychiatric diagnoses, admissions, treatments, and mental health history.",
        } satisfies TextareaField,

        // ── 4.6 Medical history and allergies ─────────────────────────────
        {
          key: "4_6_medical_flags",
          sectionNumber: "4.6",
          label: "Medical history and allergies",
          kind: "checkbox-group",
          instruction: "select all that apply",
          options: MEDICAL_HISTORY_OPTIONS,
          notesKey: "4_6_medical_notes",
          notesLabel: "Medical history notes",
          notesMaxChars: 1500,
          depth: 1,
        } satisfies CheckboxGroupField,

        // ── 4.7 Medication history ────────────────────────────────────────
        {
          key: "4_7_medication_history",
          sectionNumber: "4.7",
          label: "Medication history",
          kind: "textarea",
          maxChars: 3000,
          depth: 1,
          placeholder:
            "Current and previous medications including psychiatric and non-psychiatric. " +
            "Note doses and prescribing clinician.",
        } satisfies TextareaField,

        // ── 4.8 Alcohol, tobacco and substance use history ────────────────
        {
          key: "4_8_substance_use",
          sectionNumber: "4.8",
          label: "Alcohol, tobacco and substance use history",
          kind: "textarea",
          maxChars: 3000,
          depth: 1,
          placeholder:
            "Current and historical use of alcohol, tobacco, and illicit or recreational substances.",
        } satisfies TextareaField,

        // ── 4.9 Forensic history ──────────────────────────────────────────
        {
          key: "4_9_forensic_history",
          sectionNumber: "4.9",
          label: "Forensic history",
          kind: "textarea",
          maxChars: 3000,
          depth: 1,
          placeholder:
            "Any contact with the criminal justice system. " +
            "State 'No forensic history.' if none.",
        } satisfies TextareaField,

        // ── 4.10 Development history ──────────────────────────────────────
        {
          key: "4_10_development_history",
          sectionNumber: "4.10",
          label: "Development history",
          kind: "textarea",
          maxChars: 1000,
          depth: 1,
          placeholder:
            "Pregnancy, birth, early developmental milestones, delays, and childhood diagnoses.",
        } satisfies TextareaField,

        // ── 4.11 Educational history ──────────────────────────────────────
        {
          key: "4_11_educational_history",
          sectionNumber: "4.11",
          label: "Educational history",
          kind: "textarea",
          maxChars: 1000,
          depth: 1,
          placeholder:
            "School performance, SENCO / EHCP involvement, exclusions, " +
            "higher education, qualifications.",
        } satisfies TextareaField,

        // ── 4.12 Social history ───────────────────────────────────────────
        {
          key: "4_12_social_history",
          sectionNumber: "4.12",
          label: "Social history",
          kind: "textarea",
          maxChars: 1000,
          depth: 1,
          placeholder:
            "Current living situation, relationships, family, employment, " +
            "and social support network.",
        } satisfies TextareaField,

        // ── 4.12.1 Driving ────────────────────────────────────────────────
        {
          key: "4_12_1_patient_drives",
          sectionNumber: "4.12.1",
          label: "Patient drives",
          kind: "boolean",
          depth: 2,
        } satisfies BooleanField,

        {
          key: "4_12_1_driving_auto",
          sectionNumber: "4.12.1",
          label: "Driving DVLA discussion",
          kind: "auto-text",
          depth: 2,
          description: "Auto-generated DVLA declaration text — shown when patient drives.",
          content:
            "{clientName} does drive, and we discussed the possible effect on driving and that " +
            "people with ADHD must declare their diagnosis to the DVLA if their ADHD symptoms, " +
            "or medication affect their ability to drive safely.",
        } satisfies AutoTextField,

        {
          key: "4_12_1_driving_notes",
          sectionNumber: "4.12.1",
          label: "Driving notes",
          kind: "textarea",
          maxChars: 1000,
          depth: 2,
          placeholder: "Note any driving-related concerns or additional DVLA discussion.",
        } satisfies TextareaField,

        // ── 4.13 Family history ───────────────────────────────────────────
        {
          key: "4_13_family_flags",
          sectionNumber: "4.13",
          label: "Family history",
          kind: "checkbox-group",
          instruction: "select all that apply",
          options: FAMILY_HISTORY_OPTIONS,
          notesKey: "4_13_family_notes",
          notesLabel: "Family history notes",
          notesMaxChars: 1500,
          depth: 1,
        } satisfies CheckboxGroupField,

        // ── 4.14 Informant information ────────────────────────────────────
        {
          key: "4_14_informant_information",
          sectionNumber: "4.14",
          label: "Informant information",
          kind: "textarea",
          maxChars: 3000,
          depth: 1,
          placeholder:
            "Details provided by the informant (e.g. parent, partner, sibling). " +
            "Corroboration of symptoms across adulthood and childhood.",
        } satisfies TextareaField,

        // ── 4.15 Risk ─────────────────────────────────────────────────────
        {
          key: "4_15_risk",
          sectionNumber: "4.15",
          label: "Risk",
          kind: "textarea",
          maxChars: 1500,
          required: true,
          depth: 1,
          placeholder: "Please provide more information if required.",
        } satisfies TextareaField,

        {
          key: "4_15_1_self_health",
          sectionNumber: "4.15.1",
          label: "Self: health and wellbeing",
          kind: "textarea",
          maxChars: 1500,
          required: true,
          depth: 2,
          placeholder:
            "Self-harm history, suicidal ideation, current risk level. " +
            "State 'None reported.' if applicable.",
        } satisfies TextareaField,

        {
          key: "4_15_2_risk_to_others",
          sectionNumber: "4.15.2",
          label: "Risk to others",
          kind: "textarea",
          maxChars: 1500,
          required: true,
          depth: 2,
          placeholder:
            "Any risk the patient poses to others. " +
            "State 'None reported.' if applicable.",
        } satisfies TextareaField,

        {
          key: "4_15_3_safeguarding",
          sectionNumber: "4.15.3",
          label: "Safeguarding concerns",
          kind: "textarea",
          maxChars: 1500,
          required: true,
          depth: 2,
          placeholder:
            "Safeguarding concerns regarding children, vulnerable adults, or the patient. " +
            "State 'None reported.' if applicable.",
        } satisfies TextareaField,

        // ── 4.16 Other reports ────────────────────────────────────────────
        {
          key: "4_16_other_reports",
          sectionNumber: "4.16",
          label: "Other reports",
          kind: "textarea",
          maxChars: 1500,
          depth: 1,
          placeholder:
            "Other relevant reports reviewed (previous assessments, GP letters, school reports). " +
            "State 'None reported.' if applicable.",
        } satisfies TextareaField,

        // ── 4.17 Mental state examination ─────────────────────────────────
        // 8 individual sub-fields as shown in the portal
        {
          key: "4_17_mse_appearance",
          sectionNumber: "4.17",
          label: "Mental state examination — Appearance and behaviour",
          kind: "textarea",
          maxChars: 1000,
          required: true,
          depth: 1,
          placeholder:
            "Appearance, dress, hygiene, eye contact, motor behaviour, engagement, rapport.",
        } satisfies TextareaField,

        {
          key: "4_17_mse_speech",
          sectionNumber: "4.17",
          label: "Speech",
          kind: "textarea",
          maxChars: 1000,
          depth: 2,
          placeholder: "Rate, volume, tone, prosody, coherence.",
        } satisfies TextareaField,

        {
          key: "4_17_mse_thoughts",
          sectionNumber: "4.17",
          label: "Thoughts",
          kind: "textarea",
          maxChars: 1000,
          depth: 2,
          placeholder: "Thought form, content, obsessional or intrusive thoughts.",
        } satisfies TextareaField,

        {
          key: "4_17_mse_mood",
          sectionNumber: "4.17",
          label: "Mood",
          kind: "textarea",
          maxChars: 1000,
          depth: 2,
          placeholder: "Subjective and objective mood. Affect, reactivity, range.",
        } satisfies TextareaField,

        {
          key: "4_17_mse_perceptions",
          sectionNumber: "4.17",
          label: "Perceptions",
          kind: "textarea",
          maxChars: 1000,
          depth: 2,
          placeholder: "Presence or absence of hallucinations, illusions, depersonalisation.",
        } satisfies TextareaField,

        {
          key: "4_17_mse_cognitions",
          sectionNumber: "4.17",
          label: "Cognitions",
          kind: "textarea",
          maxChars: 1000,
          depth: 2,
          placeholder: "Orientation, concentration, memory, executive function observations.",
        } satisfies TextareaField,

        {
          key: "4_17_mse_insight",
          sectionNumber: "4.17",
          label: "Insight",
          kind: "textarea",
          maxChars: 1000,
          depth: 2,
          placeholder: "Patient's understanding of their difficulties and the assessment.",
        } satisfies TextareaField,

        {
          key: "4_17_mse_capacity",
          sectionNumber: "4.17",
          label: "Capacity",
          kind: "textarea",
          maxChars: 1000,
          depth: 2,
          placeholder:
            "Statement of capacity to consent to the assessment and act on recommendations.",
        } satisfies TextareaField,
      ],
    },

    // =========================================================================
    // SECTION 4.18 — DIVA Part A: Attention, concentration and focus
    // 9 bullet sub-fields — exact labels from portal (verified against PDF)
    // All fields: textarea, maxChars 5000
    // =========================================================================
    {
      sectionNumber: "4.18.1",
      sectionLabel: "4.18.1 Attention, concentration and focus",
      fields: [
        {
          key: "4_18_diva_heading",
          sectionNumber: "4.18",
          label: "4.18. DIVA",
          kind: "auto-text",
          depth: 1,
          description: "4.18 DIVA section heading",
        } satisfies AutoTextField,

        {
          key: "4_18_1_attention_detail",
          sectionNumber: "4.18.1",
          label: "Attention to detail",
          kind: "textarea",
          maxChars: 1000,
          depth: 3,
          placeholder:
            "Does the patient make careless mistakes in work or other activities? " +
            "Examples from adulthood and childhood.",
        } satisfies TextareaField,

        {
          key: "4_18_1_sustained_attention",
          sectionNumber: "4.18.1",
          label: "Sustained attention",
          kind: "textarea",
          maxChars: 1000,
          depth: 3,
          placeholder:
            "Does the patient have difficulty maintaining attention in tasks or activities? Examples.",
        } satisfies TextareaField,

        {
          key: "4_18_1_listening",
          sectionNumber: "4.18.1",
          label: "Listening",
          kind: "textarea",
          maxChars: 1000,
          depth: 3,
          placeholder:
            "Does the patient often appear not to listen when spoken to directly? Examples.",
        } satisfies TextareaField,

        {
          key: "4_18_1_follow_instructions",
          sectionNumber: "4.18.1",
          label: "Follow instructions / completing tasks",
          kind: "textarea",
          maxChars: 1000,
          depth: 3,
          placeholder:
            "Difficulty following through on instructions and completing tasks. " +
            "Examples from adulthood and childhood.",
        } satisfies TextareaField,

        {
          key: "4_18_1_organisational_ability",
          sectionNumber: "4.18.1",
          label: "Organisational ability",
          kind: "textarea",
          maxChars: 1000,
          depth: 3,
          placeholder:
            "Difficulty organising tasks, activities, time management. Examples.",
        } satisfies TextareaField,

        {
          key: "4_18_1_avoids_sustained_tasks",
          sectionNumber: "4.18.1",
          label: "Avoids or dislikes tasks that require sustained attention",
          kind: "textarea",
          maxChars: 1000,
          depth: 3,
          placeholder:
            "Avoidance or reluctance to engage in tasks requiring sustained mental effort. Examples.",
        } satisfies TextareaField,

        {
          key: "4_18_1_losing_items",
          sectionNumber: "4.18.1",
          label: "Losing items",
          kind: "textarea",
          maxChars: 1000,
          depth: 3,
          placeholder:
            "Frequently loses objects necessary for tasks or activities (keys, phone, documents). Examples.",
        } satisfies TextareaField,

        {
          key: "4_18_1_distractibility",
          sectionNumber: "4.18.1",
          label: "Distractibility",
          kind: "textarea",
          maxChars: 1000,
          depth: 3,
          placeholder:
            "Easily distracted by extraneous stimuli or unrelated thoughts. Examples.",
        } satisfies TextareaField,

        {
          key: "4_18_1_forgetfulness",
          sectionNumber: "4.18.1",
          label: "Forgetfulness",
          kind: "textarea",
          maxChars: 1000,
          depth: 3,
          placeholder:
            "Forgetfulness in daily activities — appointments, chores, returning calls. Examples.",
        } satisfies TextareaField,
      ],
    },

    // =========================================================================
    // SECTION 4.18.2 — DIVA Part B: Activity levels and impulsivity
    // 9 bullet sub-fields — exact labels from portal (verified against PDF page 13–14)
    // All fields: textarea, maxChars 5000
    // =========================================================================
    {
      sectionNumber: "4.18.2",
      sectionLabel: "4.18.2 Activity levels and impulsivity",
      fields: [
        {
          key: "4_18_2_fidgeting",
          sectionNumber: "4.18.2",
          label: "Fidgeting",
          kind: "textarea",
          maxChars: 1000,
          depth: 3,
          placeholder:
            "Fidgeting with hands or feet, doodling, tapping. Difficulty sitting still. Examples.",
        } satisfies TextareaField,

        {
          key: "4_18_2_remaining_seated",
          sectionNumber: "4.18.2",
          label: "Remaining seated",
          kind: "textarea",
          maxChars: 1000,
          depth: 3,
          placeholder:
            "Leaves seat in situations where remaining seated is expected. " +
            "Paces around, sits on the floor. Examples.",
        } satisfies TextareaField,

        {
          key: "4_18_2_restlessness",
          sectionNumber: "4.18.2",
          label: "Restlessness",
          kind: "textarea",
          maxChars: 1000,
          depth: 3,
          placeholder:
            "Significant sense of internal restlessness. Always needs to be moving, " +
            "feels uncomfortable when not busy. Examples.",
        } satisfies TextareaField,

        {
          key: "4_18_2_noise_level_leisure",
          sectionNumber: "4.18.2",
          label: "Noise level when engaging in leisure activities",
          kind: "textarea",
          maxChars: 1000,
          depth: 3,
          placeholder:
            "Difficulty engaging in leisure activities quietly. Described as loud or \"the clown\". Examples.",
        } satisfies TextareaField,

        {
          key: "4_18_2_on_the_go",
          sectionNumber: "4.18.2",
          label: "Being \"on the go\"",
          kind: "textarea",
          maxChars: 1000,
          depth: 3,
          placeholder:
            "Acts as if driven by a motor. Always on the go, constantly doing things, " +
            "mind always whirring. Examples.",
        } satisfies TextareaField,

        {
          key: "4_18_2_talking_excessively",
          sectionNumber: "4.18.2",
          label: "Talking excessively",
          kind: "textarea",
          maxChars: 1000,
          depth: 3,
          placeholder:
            "Talks a lot, dominates conversations, difficulty stopping once started, " +
            "goes \"down a rabbit hole\". Examples.",
        } satisfies TextareaField,

        {
          key: "4_18_2_blurting_out",
          sectionNumber: "4.18.2",
          label: "Blurting out answers",
          kind: "textarea",
          maxChars: 1000,
          depth: 3,
          placeholder:
            "Blurts out answers before questions are completed. Difficulty controlling impulse to respond. Examples.",
        } satisfies TextareaField,

        {
          key: "4_18_2_taking_turns",
          sectionNumber: "4.18.2",
          label: "Taking turns and waiting",
          kind: "textarea",
          maxChars: 1000,
          depth: 3,
          placeholder:
            "Significant difficulty waiting turn. Cannot wait in queues. Internal frustration. Examples.",
        } satisfies TextareaField,

        {
          key: "4_18_2_interrupting",
          sectionNumber: "4.18.2",
          label: "Interrupting or intruding on others",
          kind: "textarea",
          maxChars: 1000,
          depth: 3,
          placeholder:
            "Interrupts conversations, especially if they have something to add. " +
            "Intrudes on others' activities. Examples.",
        } satisfies TextareaField,
      ],
    },

    // =========================================================================
    // SECTION 4.19–4.24 — DIVA-5 Summary, Questionnaires, Conners, Results, Formulation, Summary
    // =========================================================================
    {
      sectionNumber: "4.19–4.24",
      sectionLabel: "DIVA-5 Summary, Questionnaire Results and Formulation",
      fields: [

        // ── 4.19 Summary of Diagnostic Interview for ADHD ────────────────
        {
          key: "4_19_heading",
          sectionNumber: "4.19",
          label: "4.19. Summary of Diagnostic Interview for ADHD",
          kind: "auto-text",
          depth: 1,
          description: "Section 4.19 heading",
        } satisfies AutoTextField,

        {
          key: "4_19_1_frequency_severity",
          sectionNumber: "4.19.1",
          label:
            "Does {clientName} have more symptoms of hyperactivity & impulsivity than " +
            "other people, or do they experience these more frequently than other people of their age?",
          kind: "boolean",
          depth: 2,
        } satisfies BooleanField,

        {
          key: "4_19_2_inattentive_count",
          sectionNumber: "4.19.2",
          label: "Number of inattentive characteristics",
          kind: "scale",
          instruction: "select one option",
          min: 0,
          max: 9,
          depth: 2,
        } satisfies ScaleField,

        {
          key: "4_19_3_hyperactive_count",
          sectionNumber: "4.19.3",
          label: "Number of hyperactive/impulsive characteristics",
          kind: "scale",
          instruction: "select one option",
          min: 0,
          max: 9,
          depth: 2,
        } satisfies ScaleField,

        {
          key: "4_19_4_impairment",
          sectionNumber: "4.19.4",
          label:
            "Are the characteristics causing moderate to severe impairments in at least 2 areas of their life?",
          kind: "boolean",
          depth: 2,
        } satisfies BooleanField,

        {
          key: "4_19_5_childhood_onset",
          sectionNumber: "4.19.5",
          label: "Were several symptoms of ADHD present before the age of 12?",
          kind: "boolean",
          depth: 2,
        } satisfies BooleanField,

        {
          key: "4_19_6_other_disorder",
          sectionNumber: "4.19.6",
          label: "Are the symptoms better explained by another disorder?",
          kind: "boolean",
          depth: 2,
        } satisfies BooleanField,

        // ── 4.20 Questionnaire results (appendix 3) ───────────────────────
        {
          key: "4_20_heading",
          sectionNumber: "4.20",
          label: "4.20. Questionnaire results (appendix 3)",
          kind: "auto-text",
          depth: 1,
          description: "Section 4.20 heading",
        } satisfies AutoTextField,

        {
          key: "4_20_questionnaire_results",
          sectionNumber: "4.20",
          label: "Questionnaire results (appendix 3)",
          kind: "table",
          description:
            "Lists all questionnaires completed for this assessment. " +
            "Each row shows: Questionnaire Name and Status | Completion Date | Score or Output | Remove. " +
            "A description of each instrument appears below its row.",
          columns: [
            "Questionnaire Name and Status",
            "Completion Date",
            "Score or Output",
            "Remove",
          ],
          rows: [
            { key: "aq10_self",        label: "AQ-10 (Self)" },
            { key: "asrs18_self",      label: "ASRS-18 (Self)" },
            { key: "asrs18_informant", label: "ASRS-18 (Informant)" },
            { key: "bgiiv_self",       label: "BGIIv (Self)" },
            { key: "hads_self",        label: "HADS (Self)" },
            { key: "mhaq_self",        label: "MHAQ (Self)" },
          ],
          depth: 1,
        } satisfies TableField,

        // ── 4.20 elaborate ───────────────────────────────────────────────
        {
          key: "4_20_elaborate",
          sectionNumber: "4.20",
          label: "Please elaborate the result highlighted in the questionnaire",
          kind: "textarea",
          maxChars: 5000,
          depth: 1,
          placeholder: "Please elaborate the result highlighted in the questionnaire",
        } satisfies TextareaField,

        // ── 4.21 Conners questionnaire ────────────────────────────────────
        // Stored as JSON string. Use ConnersData type + emptyConnersData().
        //
        // Layout (from portal screenshot):
        //   ┌─────────────────────────────────────────────────────────────┐
        //   │ ▼ Content Scales                                            │
        //   │   Inattention/Executive Dysfunction  Child Parent Teacher ⚑ │
        //   │   Hyperactivity                      Child Parent Teacher ⚑ │
        //   │   Impulsivity                        Child Parent Teacher ⚑ │
        //   │   Emotional Dysregulation            Child Parent Teacher ⚑ │
        //   │ ▼ Impairment & Functional Outcome Scales                    │
        //   │   Schoolwork        Child Parent Teacher ⚑                  │
        //   │   Peer Interactions Child Parent Teacher ⚑                  │
        //   │   Family Life       Child Parent  –     ⚑                   │
        //   │ ▼ Conners 4-ADHD Index                                      │
        //   │   Raw Score         Child Parent Teacher                    │
        //   │   Probability Score Child% Parent% Teacher%                 │
        //   │   Guideline         Very High / High / Average …            │
        //   │ > Info [expandable]                                         │
        //   └─────────────────────────────────────────────────────────────┘
        //   Conners summary  [ textarea — 5000 chars ]
        {
          key: "4_21_conners_data",
          sectionNumber: "4.21",
          label: "Conners questionnaire",
          kind: "structured",
          depth: 1,
          description:
            "Conners 4 structured results table. " +
            "Scores are T-scores: green ≤59 (within limits) | yellow 60–69 (mild) | red ≥70 (elevated). " +
            "Flags indicate clinically elevated scores. Store as ConnersData JSON.",
          subFields: [
            // Content Scales × 3 raters (Child / Parent / Teacher)
            { key: "cs_inattention_child",   label: "Inattention/Executive Dysfunction — Child",   kind: "text" },
            { key: "cs_inattention_parent",  label: "Inattention/Executive Dysfunction — Parent",  kind: "text" },
            { key: "cs_inattention_teacher", label: "Inattention/Executive Dysfunction — Teacher", kind: "text" },
            { key: "cs_hyperactivity_child",   label: "Hyperactivity — Child",   kind: "text" },
            { key: "cs_hyperactivity_parent",  label: "Hyperactivity — Parent",  kind: "text" },
            { key: "cs_hyperactivity_teacher", label: "Hyperactivity — Teacher", kind: "text" },
            { key: "cs_impulsivity_child",   label: "Impulsivity — Child",   kind: "text" },
            { key: "cs_impulsivity_parent",  label: "Impulsivity — Parent",  kind: "text" },
            { key: "cs_impulsivity_teacher", label: "Impulsivity — Teacher", kind: "text" },
            { key: "cs_emotional_child",   label: "Emotional Dysregulation — Child",   kind: "text" },
            { key: "cs_emotional_parent",  label: "Emotional Dysregulation — Parent",  kind: "text" },
            { key: "cs_emotional_teacher", label: "Emotional Dysregulation — Teacher", kind: "text" },
            // Functional Outcome Scales
            { key: "fs_schoolwork_child",   label: "Schoolwork — Child",   kind: "text" },
            { key: "fs_schoolwork_parent",  label: "Schoolwork — Parent",  kind: "text" },
            { key: "fs_schoolwork_teacher", label: "Schoolwork — Teacher", kind: "text" },
            { key: "fs_peer_child",   label: "Peer Interactions — Child",   kind: "text" },
            { key: "fs_peer_parent",  label: "Peer Interactions — Parent",  kind: "text" },
            { key: "fs_peer_teacher", label: "Peer Interactions — Teacher", kind: "text" },
            { key: "fs_family_child",  label: "Family Life — Child",  kind: "text" },
            { key: "fs_family_parent", label: "Family Life — Parent", kind: "text" },
            // Family Life has no Teacher column
            // Conners 4-ADHD Index
            { key: "idx_raw_child",   label: "ADHD Index Raw Score — Child",   kind: "text" },
            { key: "idx_raw_parent",  label: "ADHD Index Raw Score — Parent",  kind: "text" },
            { key: "idx_raw_teacher", label: "ADHD Index Raw Score — Teacher", kind: "text" },
            { key: "idx_prob_child",   label: "ADHD Index Probability — Child (%)",   kind: "text" },
            { key: "idx_prob_parent",  label: "ADHD Index Probability — Parent (%)",  kind: "text" },
            { key: "idx_prob_teacher", label: "ADHD Index Probability — Teacher (%)", kind: "text" },
            { key: "idx_guide_child",   label: "ADHD Index Guideline — Child",   kind: "text", placeholder: "e.g. Very High" },
            { key: "idx_guide_parent",  label: "ADHD Index Guideline — Parent",  kind: "text", placeholder: "e.g. Very High" },
            { key: "idx_guide_teacher", label: "ADHD Index Guideline — Teacher", kind: "text", placeholder: "e.g. High" },
            // Conners summary free text
            {
              key: "conners_summary",
              label: "Conners summary",
              kind: "textarea",
              maxChars: 5000,
              placeholder:
                "Provide a clinical summary and interpretation of the Conners 4 results.",
            },
          ],
        } satisfies StructuredField,

        // ── 4.22 Results (inline statement with dropdown) ────────────────
        // Portal shows: "The results of this assessment are: [Please choose ▼]
        //  with a diagnosis of Attention Deficit Hyperactivity Disorder."
        // Followed by auto-text: "However, the results of the DIVA-5 should
        //  not be taken in isolation and further information about [patient's]
        //  behaviour should be taken into consideration."
        // This is the LAST page of the portal (11 of 11).
        {
          key: "4_22_results_statement",
          sectionNumber: "4.22",
          label: "Results",
          kind: "inline-statement",
          required: true,
          depth: 1,
          showLabel: true,
          templateParts: [
            "The results of this assessment are: ",
            " with a diagnosis of Attention Deficit Hyperactivity Disorder.",
            "",
          ],
          dropdowns: [
            {
              key: "results_consistent",
              options: RESULTS_CONSISTENT_OPTIONS,
            },
          ],
        } satisfies InlineStatementField,

        // ── 4.22 post-statement caveat (auto-text) ────────────────────────
        {
          key: "4_22_diva_caveat",
          sectionNumber: "4.22",
          label: "DIVA-5 caveat",
          kind: "auto-text",
          depth: 2,
          description: "Portal auto-generates caveat text below the results inline statement.",
          content:
            "However, the results of the DIVA-5 should not be taken in isolation and further " +
            "information about {clientName}'s behaviour should be taken into consideration.",
        } satisfies AutoTextField,

        // ── 4.23 Formulation and differential diagnosis ───────────────────
        {
          key: "4_23_formulation",
          sectionNumber: "4.23",
          label: "Formulation and differential diagnosis",
          kind: "textarea",
          maxChars: 3000,
          required: true,
          depth: 1,
          placeholder:
            "Integrative clinical formulation. Include predisposing, precipitating, " +
            "perpetuating, and protective factors. Address differential diagnoses " +
            "considered and rationale for inclusion or exclusion.",
        } satisfies TextareaField,

        // ── 4.24 Summary ──────────────────────────────────────────────────
        {
          key: "4_24_summary",
          sectionNumber: "4.24",
          label: "Summary",
          kind: "textarea",
          maxChars: 1500,
          required: true,
          depth: 1,
          placeholder:
            "Concise summary of the assessment, findings, diagnosis, and key recommendations.",
        } satisfies TextareaField,
      ],
    },
  ],
};

// ── Blank sections map — initialise a new report ──────────────────────────────

export const NHS_ADHD_BLANK_SECTIONS: Record<string, string> = Object.fromEntries(
  flatFields(NHS_ADULT_ADHD_SCHEMA)
    .filter((f) => f.kind !== "auto-text" && f.kind !== "table")
    .map((f) => [f.key, ""]),
);

// ── Default export ────────────────────────────────────────────────────────────

export default NHS_ADULT_ADHD_SCHEMA;
