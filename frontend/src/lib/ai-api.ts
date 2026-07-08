import { browserApiUrl } from "./get-api-base";

/* ── Types ─────────────────────────────────────────────────────────────────── */

export type ReportSectionDraft = {
  section: string;
  draft: string;
  sources: number;
};

export type SOAPNote = {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  error?: string;
};

export type QAIssue = {
  section: string;
  issue: string;
  severity: "low" | "medium" | "high";
};

export type QAReview = {
  passed: boolean;
  issues: QAIssue[];
  missing_sections: string[];
  score: number;
  error?: string;
};

export type SynthesisDiscrepancy = {
  raters: string[];
  domain: string;
  difference: string;
  clinical_note: string;
};

export type CrossInformantSynthesis = {
  summary: string;
  discrepancies: SynthesisDiscrepancy[];
  flags: string[];
  error?: string;
};

export type RiskStratification = {
  client_id: string;
  overall_risk: "low" | "moderate" | "high" | "critical";
  risk_factors: string[];
  protective_factors: string[];
  immediate_actions: string[];
  monitoring_recommendations: string[];
  error?: string;
};

export type SmartAssignRanked = {
  clinician_id: string;
  name: string;
  score: number;
  rationale: string;
};

export type SmartAssignment = {
  ranked: SmartAssignRanked[];
  top_recommendation: string;
  summary: string;
  error?: string;
};

export type FormReminderAnalysis = {
  token_id: string;
  form_type: string;
  days_since_sent: number;
  reminders_already_sent: number;
  completion_probability: number;
  recommended_action: "wait" | "send_reminder" | "escalate_to_clinician" | "close_token";
  urgency: "low" | "medium" | "high";
  reasoning: string;
  error?: string;
};

export type FormReminderAnalyses = {
  client_id: string;
  analyses: FormReminderAnalysis[];
  message?: string;
};

/* ── Helpers ─────────────────────────────────────────────────────────────────── */

async function aiPost<T>(path: string, body: object): Promise<T | null> {
  try {
    const res = await fetch(browserApiUrl(`/api/v1${path}`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch {
    return null;
  }
}

async function aiGet<T>(path: string, params?: Record<string, string>): Promise<T | null> {
  try {
    const base = browserApiUrl(`/api/v1${path}`);
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    const res = await fetch(`${base}${qs}`, { credentials: "include" });
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch {
    return null;
  }
}

/* ── API functions ──────────────────────────────────────────────────────────── */

export async function suggestReportSection(
  clientId: string,
  sectionName: string,
  caseNotes = ""
): Promise<ReportSectionDraft | null> {
  return aiPost("/ai/report-section", {
    client_id: clientId,
    section_name: sectionName,
    case_notes: caseNotes,
  });
}

export async function suggestSoapNotes(
  clientId: string,
  context: string
): Promise<SOAPNote | null> {
  return aiPost("/ai/soap-notes", { client_id: clientId, context });
}

export async function runPreSubmissionQA(
  clientId: string,
  reportText: string
): Promise<QAReview | null> {
  return aiPost("/ai/pre-submission-qa", { client_id: clientId, report_text: reportText });
}

export async function crossInformantSynthesis(
  clientId: string
): Promise<CrossInformantSynthesis | null> {
  return aiPost("/ai/cross-informant-synthesis", { client_id: clientId });
}

export async function riskStratification(
  clientId: string,
  caseNotes = ""
): Promise<RiskStratification | null> {
  return aiPost("/ai/risk-stratification", { client_id: clientId, case_notes: caseNotes });
}

export async function smartAssignClinician(
  clientId: string
): Promise<SmartAssignment | null> {
  return aiPost("/ai/smart-assign", { client_id: clientId });
}

export async function getFormReminderAnalysis(
  clientId: string
): Promise<FormReminderAnalyses | null> {
  return aiGet("/ai/form-reminder-analysis", { client_id: clientId });
}

export async function clientChat(
  token: string,
  message: string
): Promise<{ reply: string } | null> {
  return aiPost("/ai/client-chat", { token, message });
}
