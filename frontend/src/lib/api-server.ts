import type { ClientEmailLogRecord, ClientRecord } from "./api";
import type { TeamAvailabilitySlot } from "./availability-api";
import { serverApiUrl } from "./get-api-base";
import { getServerAccessToken } from "./server-access-token";

/** Subset of client data for assigned clinicians (no payment / invoice fields). */
export type ClientClinicalRecord = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  pathway: string | null;
  age_group: string | null;
  status: string;
  stage: string;
  assessment_id: string | null;
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
  created_at: string | null;
  confirmed_session_at: string | null;
  report_due_at: string | null;
};

export type MyAssignmentItem = {
  client_id: string;
  full_name: string;
  pathway: string | null;
  status: string;
  stage: string;
  assessment_id: string | null;
  registered_at: string | null;
  confirmed_session_at: string | null;
  report_due_at: string | null;
};

export async function serverAuthedGetJson<T>(path: string): Promise<T | null> {
  const t = await getServerAccessToken();
  if (!t) return null;
  const res = await fetch(serverApiUrl(path), {
    cache: "no-store",
    headers: { Authorization: `Bearer ${t}` },
  });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

export async function getClientClinical(clientId: string): Promise<ClientClinicalRecord | null> {
  return serverAuthedGetJson<ClientClinicalRecord>(`/api/v1/clients/${encodeURIComponent(clientId)}/clinical`);
}

export async function getClientEmailLogAuthed(clientId: string): Promise<ClientEmailLogRecord[]> {
  const data = await serverAuthedGetJson<{ items: ClientEmailLogRecord[] }>(
    `/api/v1/clients/${encodeURIComponent(clientId)}/email-log`,
  );
  return data?.items ?? [];
}

export async function getMyAssignmentsList(): Promise<MyAssignmentItem[]> {
  const data = await serverAuthedGetJson<{ items: MyAssignmentItem[]; total: number }>("/api/v1/assignments/mine");
  return data?.items ?? [];
}

export async function getClientAuthedForAdmin(id: string): Promise<ClientRecord | null> {
  return serverAuthedGetJson<ClientRecord>(`/api/v1/clients/${encodeURIComponent(id)}`);
}

/** Assigned clinician / senior / admin - full record for tabbed client UI. */
export async function getClientCareRecord(clientId: string): Promise<ClientRecord | null> {
  return serverAuthedGetJson<ClientRecord>(
    `/api/v1/clients/${encodeURIComponent(clientId)}/care-record`,
  );
}

export async function getClinicianSlotsForAdmin(userId: string): Promise<TeamAvailabilitySlot[]> {
  const data = await serverAuthedGetJson<{ items: TeamAvailabilitySlot[] }>(
    `/api/v1/availability/clinician/${encodeURIComponent(userId)}/slots`,
  );
  return data?.items ?? [];
}

/** Clinician row from GET /api/v1/team/clinicians (clinical-admin). */
export type TeamClinicianOut = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  clinic_id: string | null;
  phone?: string | null;
  address_line?: string | null;
  date_of_birth?: string | null;
};

export type OperationalOverviewOut = {
  pathway_counts: { pathway: string; clients: number }[];
  clinicians: {
    id: string;
    full_name: string;
    email: string;
    role: string;
    active_cases: number;
    booked_sessions: number;
    completed_assessments: number;
    total_assigned: number;
  }[];
  totals: { clients: number; open_assessments: number; active_clinicians: number };
};

export async function getTeamClinicians(opts?: { includeInactive?: boolean }): Promise<TeamClinicianOut[]> {
  const qs = opts?.includeInactive ? "?include_inactive=true" : "";
  const data = await serverAuthedGetJson<{ items: TeamClinicianOut[] }>(`/api/v1/team/clinicians${qs}`);
  return data?.items ?? [];
}

export async function getTeamClinician(id: string): Promise<TeamClinicianOut | null> {
  return serverAuthedGetJson<TeamClinicianOut>(
    `/api/v1/team/clinicians/${encodeURIComponent(id)}`,
  );
}

export async function getOperationalOverview(): Promise<OperationalOverviewOut | null> {
  return serverAuthedGetJson<OperationalOverviewOut>("/api/v1/reports/operational-overview");
}
