export type HealthResponse = {
  status: string;
  environment: string;
};

export type Assessment = {
  id: string;
  client_id: string;
  client_name: string;
  screening_type: string;
  pathway: string;
  status: string;
  stage: string;
  clinician_name: string;
  appointment_date: string;
  report_due_date: string;
  evidence_completeness: number;
  note_summary_status: string;
  risk_level: string;
  next_action: string;
};

export type AssessmentDetail = Assessment & {
  referral_source: string;
  client_age_group: string;
  forms_received: string[];
  missing_items: string[];
  timeline: string[];
  key_observations: string[];
  draft_sections_ready: string[];
  downstream_tasks: BookingWorkflowStep[];
  session_brief: {
    case_id: string;
    client_name: string;
    clinician_name: string;
    session_time: string;
    summary: string;
  };
  report_handoff: {
    case_id: string;
    assessment_status: string;
    report_status: string;
    handoff_note: string;
    nice_check_status: string;
  };
};

export type BookingWorkflowStep = {
  key: string;
  title: string;
  status: string;
  detail: string;
};

export type Booking = {
  id: string;
  case_id: string;
  client_id: string;
  client_name: string;
  client_email: string;
  clinician_id: string;
  clinician_name: string;
  pathway: string;
  booking_status: string;
  payment_status: string;
  room_status: string;
  confirmation_status: string;
  sla_status: string;
  slot_time: string;
  source: string;
  workflow_steps: BookingWorkflowStep[];
};

import { publicApiBase, serverApiUrl } from "./get-api-base";

async function safeJsonFetch<T>(path: string, fallback: T): Promise<T> {
  try {
    const url =
      typeof window !== "undefined"
        ? publicApiBase()
          ? `${publicApiBase()}${path}`
          : path
        : serverApiUrl(path);
    const response = await fetch(url, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Backend returned ${response.status}`);
    }

    return (await response.json()) as T;
  } catch {
    return fallback;
  }
}

export async function getBackendHealth(): Promise<HealthResponse> {
  return safeJsonFetch("/health", {
    status: "unreachable",
    environment: "unknown",
  });
}

export async function getAssessments(): Promise<Assessment[]> {
  const response = await safeJsonFetch<{ items: Assessment[] }>("/api/v1/assessments/", {
    items: [],
  });

  return response.items;
}

export async function getAssessmentDetail(
  assessmentId: string,
): Promise<AssessmentDetail | null> {
  return safeJsonFetch<AssessmentDetail | null>(`/api/v1/assessments/${assessmentId}`, null);
}

export async function getBookings(): Promise<Booking[]> {
  const response = await safeJsonFetch<{ items: Booking[] }>("/api/v1/bookings/", {
    items: [],
  });

  return response.items;
}

export type ServiceCheck = {
  name: string;
  status: "ok" | "degraded" | "error";
  detail: string;
};

export type RoleCount = {
  role: string;
  count: number;
};

export type SystemStatus = {
  environment: string;
  app_version: string;
  uptime_seconds: number;
  checked_at: string;
  services: ServiceCheck[];
  role_counts: RoleCount[];
  config_summary: Record<string, string>;
};

export async function getSystemStatus(): Promise<SystemStatus | null> {
  return safeJsonFetch<SystemStatus | null>("/api/v1/system/status", null);
}

export type ClientRecord = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  pathway: string | null;
  age_group: string | null;
  child_name: string | null;
  child_dob: string | null;
  status: string;
  stage: string;
  source: string;
  assessment_id: string | null;
  payment_amount: string | null;
  payment_currency: string | null;
  paid_service_name: string | null;
  date_of_birth: string | null;
  address: string | null;
  gp_name: string | null;
  gp_practice: string | null;
  gp_email: string | null;
  teacher_name: string | null;
  teacher_email: string | null;
  school_name: string | null;
  parent_guardian_name: string | null;
  parent_guardian_phone: string | null;
  occupation: string | null;
  medical_concerns: string | null;
  ethnicity: string | null;
  religion_group: string | null;
  preferred_language: string | null;
  created_at: string | null;
  assigned_clinician_user_id: string | null;
  assigned_clinician_name: string | null;
  confirmed_session_at: string | null;
  report_due_at: string | null;
};

export async function getClients(): Promise<ClientRecord[]> {
  const response = await safeJsonFetch<{ items: ClientRecord[] }>("/api/v1/clients/", { items: [] });
  return response.items;
}

export async function getClient(id: string): Promise<ClientRecord | null> {
  return safeJsonFetch<ClientRecord | null>(`/api/v1/clients/${id}`, null);
}

export type FormTokenRecord = {
  id: string;
  token: string;
  form_type: string;
  form_label: string;
  recipient_email: string;
  recipient_name: string | null;
  status: string;
  sent_at: string | null;
  submitted_at: string | null;
};

export async function getClientForms(clientId: string): Promise<FormTokenRecord[]> {
  const response = await safeJsonFetch<{ forms: FormTokenRecord[] }>(
    `/api/v1/forms/client/${clientId}`,
    { forms: [] }
  );
  return response.forms;
}

export type ClientEmailLogRecord = {
  id: string;
  client_id: string | null;
  template_key: string;
  recipient_email: string;
  subject: string;
  from_email: string;
  body_preview: string;
  html_snapshot: string | null;
  success: boolean;
  delivery_mode: string;
  sendgrid_status_code: number | null;
  sendgrid_response_excerpt: string | null;
  error_message: string | null;
  created_at: string | null;
};

export async function getClientEmailLog(clientId: string): Promise<ClientEmailLogRecord[]> {
  const response = await safeJsonFetch<{ items: ClientEmailLogRecord[]; total: number }>(
    `/api/v1/clients/${clientId}/email-log`,
    { items: [], total: 0 },
  );
  return response.items;
}
