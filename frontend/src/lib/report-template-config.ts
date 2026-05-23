/**
 * NHS Clinical Assessment Report Template Configuration
 * Defines sections per pathway — matches the PDF report structure.
 *
 * For the full NHS Adult ADHD portal schema (DIVA-5 structured form with
 * Conners 4, checkbox groups, MSE sub-fields, questionnaire table etc.)
 * see: lib/nhs-adhd-report-schema.ts
 */

export type ReportSection = {
  key: string;
  label: string;
  placeholder: string;
  required?: boolean;
  /** Depth: 1=main section, 2=subsection, 3=sub-subsection */
  depth?: 1 | 2 | 3;
};

export type ReportTemplate = {
  id: string;
  label: string;
  pathwayMatch: RegExp;
  sections: ReportSection[];
};

// ── Shared base sections (all pathways) ──────────────────────────────────────

const SHARED_HISTORY: ReportSection[] = [
  {
    key: "reason_for_referral",
    label: "2. Reason for Referral",
    placeholder: "Describe the referral source, presenting concerns, and reason for seeking assessment.",
    required: true,
    depth: 1,
  },
  {
    key: "developmental_history",
    label: "3. Developmental and Background History",
    placeholder: "Describe early development, birth history, milestones, and any significant events.",
    depth: 1,
  },
  {
    key: "childhood_behaviours",
    label: "3.1 Childhood Behaviours and Early Signs",
    placeholder: "Detail observed behaviours in early childhood relevant to the presenting pathway.",
    depth: 2,
  },
  {
    key: "family_history",
    label: "3.2 Family History",
    placeholder: "Note any family history of ADHD, autism, mental health conditions, or neurodevelopmental disorders.",
    depth: 2,
  },
  {
    key: "educational_history",
    label: "4. Educational History",
    placeholder: "School performance, support received (EHCP, SENCO involvement), exclusions, achievements, transitions.",
    depth: 1,
  },
  {
    key: "occupational_history",
    label: "5. Occupational / Vocational History",
    placeholder: "Employment history, difficulties in the workplace, adjustments made or needed.",
    depth: 1,
  },
  {
    key: "medical_history",
    label: "6. Medical History",
    placeholder: "Significant past and current medical conditions, hospitalisations, allergies.",
    depth: 1,
  },
  {
    key: "current_medications",
    label: "6.1 Current Medications",
    placeholder: "List all current medications, doses, and prescribing clinician.",
    depth: 2,
  },
  {
    key: "psychiatric_history",
    label: "7. Psychiatric and Psychological History",
    placeholder: "Previous diagnoses, psychiatric admissions, previous treatments and outcomes.",
    depth: 1,
  },
  {
    key: "substance_use",
    label: "7.1 Substance Use History",
    placeholder: "Describe current and historical use of alcohol, tobacco, recreational drugs.",
    depth: 2,
  },
  {
    key: "social_history",
    label: "8. Social History",
    placeholder: "Living situation, relationships, social support network, housing stability.",
    depth: 1,
  },
];

const SHARED_CLOSING: ReportSection[] = [
  {
    key: "mse",
    label: "10. Mental State Examination",
    placeholder: "Appearance, behaviour, speech, mood and affect, thought content and form, perceptual disturbances, cognition, insight.",
    required: true,
    depth: 1,
  },
  {
    key: "clinical_observations",
    label: "11. Clinical Observations",
    placeholder: "Clinician's direct observations during the assessment session.",
    required: true,
    depth: 1,
  },
  {
    key: "formulation",
    label: "12. Formulation",
    placeholder: "Integrative formulation explaining how predisposing, precipitating, perpetuating, and protective factors contribute to the presentation.",
    required: true,
    depth: 1,
  },
  {
    key: "diagnosis",
    label: "13. Diagnosis",
    placeholder: "Primary diagnosis with ICD-11 code (e.g. F90.0 – Attention Deficit Disorder with Hyperactivity; 6A02 – ADHD). State if criteria met or not met.",
    required: true,
    depth: 1,
  },
  {
    key: "differential_diagnosis",
    label: "13.1 Differential Diagnoses Considered",
    placeholder: "List conditions considered and rationale for inclusion or exclusion.",
    depth: 2,
  },
  {
    key: "recommendations",
    label: "14. Recommendations",
    placeholder: "Overall summary of recommendations arising from this assessment.",
    required: true,
    depth: 1,
  },
  {
    key: "medication_recommendations",
    label: "14.1 Medication",
    placeholder: "Medication recommendations, titration plan, prescribing pathway (NHS / Right to Choose / private).",
    depth: 2,
  },
  {
    key: "psychological_support",
    label: "14.2 Psychological and Behavioural Support",
    placeholder: "Recommended therapies: CBT, coaching, psychoeducation, parenting programmes, etc.",
    depth: 2,
  },
  {
    key: "practical_adjustments",
    label: "14.3 Workplace / Educational Adjustments",
    placeholder: "Recommended adjustments including reasonable adjustments under the Equality Act 2010.",
    depth: 2,
  },
  {
    key: "further_assessment",
    label: "14.4 Further Assessment",
    placeholder: "Any additional assessments recommended (cognitive, sleep, mental health, etc.).",
    depth: 2,
  },
  {
    key: "onward_referrals",
    label: "14.5 Onward Referrals",
    placeholder: "Referrals to GP, CAMHS, IAPT, occupational therapy, speech and language therapy, etc.",
    depth: 2,
  },
  {
    key: "summary",
    label: "15. Summary",
    placeholder: "Concise summary of the assessment, findings, diagnosis, and key recommendations.",
    required: true,
    depth: 1,
  },
  {
    key: "clinician_declaration",
    label: "16. Clinician Declaration",
    placeholder: "I confirm that this report accurately reflects the clinical findings from the assessment conducted. Name, qualifications, registration number (e.g. HCPC/NMC/BPS), and date.",
    required: true,
    depth: 1,
  },
];

// ── Adult ADHD ────────────────────────────────────────────────────────────────
//
// NOTE: The definitive schema for NHS Adult ADHD is in nhs-adhd-report-schema.ts
// (full DIVA-5 portal structure).  This entry is kept as the lightweight
// ReportTemplate used by the simple section renderer / legacy paths.

export const ADULT_ADHD_TEMPLATE: ReportTemplate = {
  id: "nhs_adult_adhd",
  label: "NHS Adult ADHD",
  pathwayMatch: /adult.*adhd|adhd.*adult/i,
  sections: [
    // ── Section II — Summary ───────────────────────────────────────────────
    {
      key: "2_1_clinical_impressions",
      label: "2.1 Clinical impressions",
      placeholder: "Provide a summary of the clinical impression from this assessment.",
      required: true,
      depth: 1,
    },
    {
      key: "2_2_heading",
      label: "2.2. Recommendations",
      placeholder: "",
      depth: 1,
    },
    {
      key: "2_2_1_medication",
      label: "2.2.1 Recommended medication (from today's appointment)",
      placeholder: "Detail any medication recommended following today's appointment.",
      depth: 2,
    },
    {
      key: "2_2_2_psychological",
      label: "2.2.2 Psychological",
      placeholder: "Psychological recommendations: CBT, coaching, psychoeducation.",
      depth: 2,
    },
    {
      key: "2_2_3_workplace_home",
      label: "2.2.3 Workplace / Home adjustments",
      placeholder: "Recommended adjustments under the Equality Act 2010.",
      depth: 2,
    },
    {
      key: "2_2_4_lifestyle",
      label: "2.2.4 Lifestyle",
      placeholder: "Lifestyle recommendations: sleep, exercise, diet, routine.",
      depth: 2,
    },
    {
      key: "2_3_heading",
      label: "2.3. Recommendations for fellow health professionals",
      placeholder: "",
      depth: 1,
    },
    {
      key: "2_3_1_general_recommendations",
      label: "2.3.1 General recommendations (non-pharmacological)",
      placeholder: "General onward recommendations for GP, IAPT, occupational health.",
      depth: 2,
    },
    {
      key: "2_3_2_pharmacological",
      label: "2.3.2 Initiating pharmacological treatment",
      placeholder: "Pharmacological treatment pathway, Right to Choose, titration process.",
      depth: 2,
    },
    {
      key: "2_4_plan",
      label: "2.4 Plan",
      placeholder: "E.g. discharge from our service back to NHS",
      required: true,
      depth: 1,
    },
    // ── Section III — Assessment ───────────────────────────────────────────
    {
      key: "3_1_diagnostic_criteria",
      label: "3.1 Diagnostic Criteria for ADHD",
      placeholder: "How the presentation aligns with DSM-5 ADHD criteria.",
      required: true,
      depth: 1,
    },
    // ── Section IV — DIVA-5 interview ──────────────────────────────────────
    {
      key: "4_1_presenting_difficulties",
      label: "4.1 Presenting difficulties",
      placeholder: "Presenting difficulties as reported in the clinical interview.",
      required: true,
      depth: 1,
    },
    {
      key: "4_2_history_presenting",
      label: "4.2 History of presenting difficulties",
      placeholder: "Chronological account of difficulties, progression, impact.",
      depth: 1,
    },
    {
      key: "4_3_emotional_regulation",
      label: "4.3 Emotional regulation",
      placeholder: "Emotional dysregulation, mood instability, rejection sensitivity.",
      depth: 1,
    },
    {
      key: "4_4_other_behaviour",
      label: "4.4 Other behaviour",
      placeholder: "Additional behavioural observations.",
      depth: 1,
    },
    {
      key: "4_5_psychiatric_history",
      label: "4.5 Psychiatric history",
      placeholder: "Previous diagnoses, admissions, treatments.",
      depth: 1,
    },
    {
      key: "4_6_medical_history_notes",
      label: "4.6 Medical history and allergies",
      placeholder: "Medical conditions, allergies. Flags: Tics / Heart disease / High blood pressure / Head injuries / Epilepsy / Liver disease / None.",
      depth: 1,
    },
    {
      key: "4_7_medication_history",
      label: "4.7 Medication history",
      placeholder: "Current and previous medications.",
      depth: 1,
    },
    {
      key: "4_8_substance_use",
      label: "4.8 Alcohol, tobacco and substance use history",
      placeholder: "Alcohol, tobacco, illicit substance use.",
      depth: 1,
    },
    {
      key: "4_9_forensic_history",
      label: "4.9 Forensic history",
      placeholder: "Contact with the criminal justice system.",
      depth: 1,
    },
    {
      key: "4_10_development_history",
      label: "4.10 Development history",
      placeholder: "Pregnancy, birth, milestones, childhood diagnoses.",
      depth: 1,
    },
    {
      key: "4_11_educational_history",
      label: "4.11 Educational history",
      placeholder: "School performance, SENCO/EHCP, qualifications.",
      depth: 1,
    },
    {
      key: "4_12_social_history",
      label: "4.12 Social history",
      placeholder: "Living situation, relationships, employment, support.",
      depth: 1,
    },
    {
      key: "4_12_1_driving_notes",
      label: "4.12.1 Driving",
      placeholder: "Patient drives: Yes / No. DVLA declaration discussed.",
      depth: 2,
    },
    {
      key: "4_13_family_history_notes",
      label: "4.13 Family history",
      placeholder: "Flags: Cardiovascular disease / Sudden death before 55 / None.",
      depth: 1,
    },
    {
      key: "4_14_informant_information",
      label: "4.14 Informant information",
      placeholder: "Details provided by the informant; corroboration of symptoms.",
      depth: 1,
    },
    {
      key: "4_15_1_self_health",
      label: "4.15.1 Risk — Self health and wellbeing",
      placeholder: "Self-harm, suicidal ideation, current risk level.",
      required: true,
      depth: 2,
    },
    {
      key: "4_15_2_risk_to_others",
      label: "4.15.2 Risk to others",
      placeholder: "Any risk posed to others.",
      required: true,
      depth: 2,
    },
    {
      key: "4_15_3_safeguarding",
      label: "4.15.3 Safeguarding concerns",
      placeholder: "Safeguarding concerns regarding children or vulnerable adults.",
      required: true,
      depth: 2,
    },
    {
      key: "4_16_other_reports",
      label: "4.16 Other reports",
      placeholder: "Other relevant reports reviewed.",
      depth: 1,
    },
    // ── 4.17 MSE ──────────────────────────────────────────────────────────
    {
      key: "4_17_mse_appearance",
      label: "4.17 Mental state examination — Appearance and behaviour",
      placeholder: "Appearance, dress, hygiene, eye contact, motor behaviour, rapport.",
      required: true,
      depth: 2,
    },
    {
      key: "4_17_mse_speech",
      label: "Speech",
      placeholder: "Rate, volume, tone, prosody, coherence.",
      depth: 2,
    },
    {
      key: "4_17_mse_thoughts",
      label: "Thoughts",
      placeholder: "Thought form, content, obsessional or intrusive thoughts.",
      depth: 2,
    },
    {
      key: "4_17_mse_mood",
      label: "Mood",
      placeholder: "Subjective and objective mood. Affect, reactivity, range.",
      depth: 2,
    },
    {
      key: "4_17_mse_perceptions",
      label: "Perceptions",
      placeholder: "Hallucinations, illusions, depersonalisation.",
      depth: 2,
    },
    {
      key: "4_17_mse_cognitions",
      label: "Cognitions",
      placeholder: "Orientation, concentration, memory, executive function.",
      depth: 2,
    },
    {
      key: "4_17_mse_insight",
      label: "Insight",
      placeholder: "Patient's understanding of their difficulties.",
      depth: 2,
    },
    {
      key: "4_17_mse_capacity",
      label: "Capacity",
      placeholder: "Capacity to consent to assessment and act on recommendations.",
      depth: 2,
    },
    // ── 4.18.1 DIVA — Attention, concentration and focus (9 criteria) ────────
    {
      key: "4_18_1_attention_detail",
      label: "4.18.1 DIVA — Attention to detail",
      placeholder: "Careless mistakes in work or daily activities. Examples (adult + childhood).",
      depth: 2,
    },
    {
      key: "4_18_1_sustained_attention",
      label: "Sustained attention",
      placeholder: "Difficulty maintaining attention in tasks or activities.",
      depth: 2,
    },
    {
      key: "4_18_1_listening",
      label: "Listening",
      placeholder: "Appears not to listen when spoken to directly.",
      depth: 2,
    },
    {
      key: "4_18_1_follow_instructions",
      label: "Follow instructions / completing tasks",
      placeholder: "Difficulty following through on instructions and completing tasks.",
      depth: 2,
    },
    {
      key: "4_18_1_organisational_ability",
      label: "Organisational ability",
      placeholder: "Difficulty organising tasks, activities, or managing time.",
      depth: 2,
    },
    {
      key: "4_18_1_avoids_sustained_tasks",
      label: "Avoids or dislikes tasks that require sustained attention",
      placeholder: "Avoidance or reluctance to engage in tasks requiring sustained mental effort.",
      depth: 2,
    },
    {
      key: "4_18_1_losing_items",
      label: "Losing items",
      placeholder: "Frequently loses objects necessary for tasks (keys, phone, documents).",
      depth: 2,
    },
    {
      key: "4_18_1_distractibility",
      label: "Distractibility",
      placeholder: "Easily distracted by extraneous stimuli or unrelated thoughts.",
      depth: 2,
    },
    {
      key: "4_18_1_forgetfulness",
      label: "Forgetfulness",
      placeholder: "Forgetfulness in daily activities — appointments, chores, returning calls.",
      depth: 2,
    },
    // ── 4.18.2 DIVA — Activity levels and impulsivity (9 criteria) ───────────
    {
      key: "4_18_2_fidgeting",
      label: "4.18.2 DIVA — Fidgeting",
      placeholder: "Fidgeting with hands or feet, doodling, tapping. Difficulty sitting still.",
      depth: 2,
    },
    {
      key: "4_18_2_remaining_seated",
      label: "Remaining seated",
      placeholder: "Leaves seat in situations where remaining seated is expected.",
      depth: 2,
    },
    {
      key: "4_18_2_restlessness",
      label: "Restlessness",
      placeholder: "Significant sense of internal restlessness. Always needs to be moving.",
      depth: 2,
    },
    {
      key: "4_18_2_noise_level_leisure",
      label: "Noise level when engaging in leisure activities",
      placeholder: "Difficulty engaging in leisure activities quietly.",
      depth: 2,
    },
    {
      key: "4_18_2_on_the_go",
      label: "Being \"on the go\"",
      placeholder: "Acts as if driven by a motor. Mind always whirring, constantly doing things.",
      depth: 2,
    },
    {
      key: "4_18_2_talking_excessively",
      label: "Talking excessively",
      placeholder: "Talks a lot, dominates conversations, difficulty stopping once started.",
      depth: 2,
    },
    {
      key: "4_18_2_blurting_out",
      label: "Blurting out answers",
      placeholder: "Blurts out answers before questions are completed.",
      depth: 2,
    },
    {
      key: "4_18_2_taking_turns",
      label: "Taking turns and waiting",
      placeholder: "Significant difficulty waiting turn. Cannot wait in queues.",
      depth: 2,
    },
    {
      key: "4_18_2_interrupting",
      label: "Interrupting or intruding on others",
      placeholder: "Interrupts conversations, intrudes on others' activities.",
      depth: 2,
    },
    // ── 4.22 Results · 4.23 Formulation · 4.24 Summary ───────────────────────
    // 4.22: inline dropdown — "The results of this assessment are: [Please choose]
    //        with a diagnosis of Attention Deficit Hyperactivity Disorder."
    // (stored as key "4_22_results_consistent" = "consistent" | "not consistent")
    {
      key: "4_22_results_consistent",
      label: "4.22 Results — consistent / not consistent with diagnosis",
      placeholder: "consistent",
      required: true,
      depth: 1,
    },
    {
      key: "4_23_formulation",
      label: "4.23 Formulation and differential diagnosis",
      placeholder: "Integrative clinical formulation. Differential diagnoses considered. (3000 chars)",
      required: true,
      depth: 1,
    },
    {
      key: "4_24_summary",
      label: "4.24 Summary",
      placeholder: "Concise summary of findings, diagnosis, and key recommendations. (1500 chars)",
      required: true,
      depth: 1,
    },
  ],
};

// ── Adult Autism ──────────────────────────────────────────────────────────────

export const ADULT_AUTISM_TEMPLATE: ReportTemplate = {
  id: "nhs_adult_autism",
  label: "NHS Adult Autism",
  pathwayMatch: /adult.*autis|autis.*adult/i,
  sections: [
    ...SHARED_HISTORY,
    {
      key: "assessment_tools",
      label: "9. Autism Assessment Tools and Results",
      placeholder: "Tools used: ADOS-2 (Autism Diagnostic Observation Schedule), AQ-10, AQ-50, RAADS-R. Interview-based: ADI-R (if administered).",
      required: true,
      depth: 1,
    },
    {
      key: "self_report_scores",
      label: "9.1 Standardised Scores",
      placeholder: "AQ-10 score: /10 (cut-off ≥6). AQ-50 score: /50. RAADS-R total: /240 (cut-off ≥65). ADOS-2 CSS (Comparison Score): / Module: / Algorithm totals: Communication / Social Interaction / RRB.",
      depth: 2,
    },
    {
      key: "social_communication",
      label: "9.2 Social Communication and Interaction",
      placeholder: "Observations regarding social reciprocity, non-verbal communication, relationship development, and use of language in context.",
      depth: 2,
    },
    {
      key: "rrb",
      label: "9.3 Restricted and Repetitive Behaviours",
      placeholder: "Observations of restricted interests, repetitive behaviours, sensory sensitivities, need for sameness.",
      depth: 2,
    },
    ...SHARED_CLOSING,
  ],
};

// ── Adolescent ADHD ───────────────────────────────────────────────────────────

export const ADOLESCENT_ADHD_TEMPLATE: ReportTemplate = {
  id: "nhs_adolescent_adhd",
  label: "NHS Adolescent ADHD",
  pathwayMatch: /adolescent.*adhd|adhd.*adolescent/i,
  sections: [
    ...SHARED_HISTORY,
    {
      key: "school_observations",
      label: "9. School and Educational Observations",
      placeholder: "Teacher observations, SENCO reports, classroom behaviours. Include Conners Teacher Rating Scale results if available.",
      depth: 1,
    },
    {
      key: "assessment_tools",
      label: "9.1 ADHD Assessment Tools and Results",
      placeholder: "Tools: Conners 3rd Edition (Parent/Teacher/Self), SNAP-IV, DIVA-5 (Adolescent version). Scores and clinical threshold.",
      required: true,
      depth: 2,
    },
    {
      key: "self_report_scores",
      label: "9.2 Standardised Scores",
      placeholder: "Conners 3 Parent T-scores: Inattention / Hyperactivity-Impulsivity / Learning Problems. Conners 3 Teacher T-scores: as above. Self-report if administered.",
      depth: 2,
    },
    ...SHARED_CLOSING,
  ],
};

// ── Child ADHD ────────────────────────────────────────────────────────────────

export const CHILD_ADHD_TEMPLATE: ReportTemplate = {
  id: "nhs_child_adhd",
  label: "NHS Child ADHD",
  pathwayMatch: /child.*adhd|adhd.*child/i,
  sections: [
    ...SHARED_HISTORY,
    {
      key: "parent_observations",
      label: "9. Parent / Guardian Observations",
      placeholder: "Summary of parent-reported behaviours at home, during homework, social settings. Include Parent Pack questionnaire responses.",
      depth: 1,
    },
    {
      key: "assessment_tools",
      label: "9.1 ADHD Assessment Tools and Results",
      placeholder: "Tools: Conners 3rd Edition, SDQ (Strengths and Difficulties Questionnaire), SNAP-IV. Report parent and teacher versions.",
      required: true,
      depth: 2,
    },
    {
      key: "self_report_scores",
      label: "9.2 Standardised Scores",
      placeholder: "Conners 3 Parent T-scores: Inattention / Hyperactivity-Impulsivity. SDQ Total Difficulties: /40. Teacher SDQ: /40. Subscale scores as appropriate.",
      depth: 2,
    },
    ...SHARED_CLOSING,
  ],
};

// ── Child / Adolescent Autism ─────────────────────────────────────────────────

export const CHILD_AUTISM_TEMPLATE: ReportTemplate = {
  id: "nhs_child_autism",
  label: "NHS Child / Adolescent Autism",
  pathwayMatch: /child.*autis|autis.*child|adolescent.*autis|autis.*adolescent/i,
  sections: [
    ...SHARED_HISTORY,
    {
      key: "school_observations",
      label: "9. School Observations and Reports",
      placeholder: "School support, SENCO involvement, EHCP status, observed social and communication behaviours, sensory needs in the classroom.",
      depth: 1,
    },
    {
      key: "assessment_tools",
      label: "9.1 Autism Assessment Tools and Results",
      placeholder: "Tools: ADOS-2 (Module 1/2/3 as appropriate), SCQ (Social Communication Questionnaire), SDQ, CAST. ADI-R if administered.",
      required: true,
      depth: 2,
    },
    {
      key: "self_report_scores",
      label: "9.2 Standardised Scores",
      placeholder: "ADOS-2 CSS: / Module: / Algorithm totals. SCQ Lifetime score: /40 (cut-off ≥15). SDQ Total Difficulties: /40 (parent and teacher).",
      depth: 2,
    },
    {
      key: "social_communication",
      label: "9.3 Social Communication and Interaction",
      placeholder: "Eye contact, joint attention, play, friendships, turn-taking, flexibility.",
      depth: 2,
    },
    {
      key: "rrb",
      label: "9.4 Restricted and Repetitive Behaviours",
      placeholder: "Special interests, routines, sensory sensitivities, repetitive movements.",
      depth: 2,
    },
    ...SHARED_CLOSING,
  ],
};

// ── Generic (fallback) ────────────────────────────────────────────────────────

export const GENERIC_TEMPLATE: ReportTemplate = {
  id: "generic",
  label: "Clinical Assessment Report",
  pathwayMatch: /.*/,
  sections: [
    ...SHARED_HISTORY,
    {
      key: "assessment_tools",
      label: "9. Assessment Tools and Results",
      placeholder: "List tools administered, scores obtained, and clinical thresholds.",
      required: true,
      depth: 1,
    },
    {
      key: "self_report_scores",
      label: "9.1 Standardised Scores",
      placeholder: "Scores and normative comparisons for each administered measure.",
      depth: 2,
    },
    ...SHARED_CLOSING,
  ],
};

export const ALL_TEMPLATES: ReportTemplate[] = [
  ADULT_ADHD_TEMPLATE,
  ADULT_AUTISM_TEMPLATE,
  ADOLESCENT_ADHD_TEMPLATE,
  CHILD_ADHD_TEMPLATE,
  CHILD_AUTISM_TEMPLATE,
  GENERIC_TEMPLATE,
];

export function getTemplateForPathway(reportType: string): ReportTemplate {
  return ALL_TEMPLATES.find((t) => t.pathwayMatch.test(reportType)) ?? GENERIC_TEMPLATE;
}

export const REPORT_TYPE_OPTIONS = [
  "NHS Adult ADHD",
  "NHS Adult Autism",
  "NHS Adolescent ADHD",
  "NHS Child ADHD",
  "NHS Child / Adolescent Autism",
  "Private Adult ADHD",
  "Private Adult Autism",
  "Private Adolescent ADHD",
  "Private Child ADHD",
  "Private Child / Adolescent Autism",
  "Combined ADHD and Autism Assessment",
  "Other Clinical Assessment",
];

/**
 * Returns a filtered subset of REPORT_TYPE_OPTIONS based on the client's pathway
 * and age_group. Always includes "Combined" and "Other" as escape hatches.
 *
 * Examples:
 *   pathway="Adult ADHD" → adult + ADHD options only
 *   pathway="Child Autism", age_group="Child" → child + autism options only
 *   pathway=null, age_group=null → full list
 */
export function getReportOptionsForClient(
  pathway: string | null | undefined,
  ageGroup: string | null | undefined,
): string[] {
  const p = (pathway ?? "").toLowerCase();
  const a = (ageGroup ?? "").toLowerCase();

  const isAdhd = /adhd|attention/.test(p) && !/autis|asd/.test(p);
  const isAutism = /autis|asd/.test(p) && !/adhd/.test(p);
  const isCombined = /adhd/.test(p) && /autis|asd/.test(p);

  const isAdult = /adult/.test(p) || a === "adult";
  const isChild = /child/.test(p) || a === "child";
  const isAdolescent = /adolescent/.test(p) || a === "adolescent";

  // Always include these regardless of pathway
  const always = ["Combined ADHD and Autism Assessment", "Other Clinical Assessment"];

  // If we can't infer anything specific, return full list
  if (!isAdhd && !isAutism && !isCombined && !isAdult && !isChild && !isAdolescent) {
    return REPORT_TYPE_OPTIONS;
  }

  return REPORT_TYPE_OPTIONS.filter((opt) => {
    if (always.includes(opt)) return true;

    const lo = opt.toLowerCase();

    // Condition filter
    if (isAdhd && /autis/.test(lo)) return false;
    if (isAutism && /adhd/.test(lo)) return false;

    // Age group filter (only if we have a clear signal)
    if (isAdult && !isChild && !isAdolescent) {
      if (/child|adolescent/.test(lo)) return false;
    }
    if (isChild && !isAdult && !isAdolescent) {
      if (/adult|adolescent/.test(lo) && !/child/.test(lo)) return false;
    }
    if (isAdolescent && !isAdult && !isChild) {
      if (/adult/.test(lo) && !/adolescent/.test(lo)) return false;
      if (/child/.test(lo) && !/adolescent/.test(lo)) return false;
    }

    return true;
  });
}
