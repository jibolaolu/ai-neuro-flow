import { browserApiUrl } from "./get-api-base";

export type ReportStatus = "draft" | "pending" | "complete" | "issued";

export type ClinicalReport = {
  id: string;
  client_id: string;
  clinician_id: string;
  report_type: string;
  status: ReportStatus;
  sections: Record<string, string>;
  place_of_assessment: string | null;
  date_of_assessment: string | null;
  assessed_by: string | null;
  pdf_token: string | null;
  pdf_token_expires_at: string | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  review_comment: string | null;
  submitted_at: string | null;
  issued_at: string | null;
  created_at: string;
  updated_at: string;
};

async function _parse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export async function fetchReportsForClient(clientId: string): Promise<ClinicalReport[]> {
  const res = await fetch(browserApiUrl(`/api/v1/clinical-reports/client/${encodeURIComponent(clientId)}`), {
    credentials: "include",
  });
  return _parse(res);
}

export async function fetchMyReports(status?: ReportStatus): Promise<ClinicalReport[]> {
  const url = status
    ? browserApiUrl(`/api/v1/clinical-reports/mine?status=${encodeURIComponent(status)}`)
    : browserApiUrl("/api/v1/clinical-reports/mine");
  const res = await fetch(url, { credentials: "include" });
  return _parse(res);
}

export async function fetchPendingReports(): Promise<ClinicalReport[]> {
  const res = await fetch(browserApiUrl("/api/v1/clinical-reports/pending"), {
    credentials: "include",
  });
  return _parse(res);
}

export async function fetchReport(reportId: string): Promise<ClinicalReport> {
  const res = await fetch(browserApiUrl(`/api/v1/clinical-reports/${encodeURIComponent(reportId)}`), {
    credentials: "include",
  });
  return _parse(res);
}

export async function createReport(body: {
  client_id: string;
  report_type: string;
  date_of_assessment?: string;
  place_of_assessment?: string;
  assessed_by?: string;
}): Promise<ClinicalReport> {
  // No trailing slash — nginx strips it before reaching FastAPI, causing a 307
  // redirect that drops the POST body. The backend router also has redirect_slashes=False.
  const res = await fetch(browserApiUrl("/api/v1/clinical-reports"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return _parse(res);
}

export async function patchReport(
  reportId: string,
  patch: {
    sections?: Record<string, string>;
    place_of_assessment?: string;
    date_of_assessment?: string;
    assessed_by?: string;
    report_type?: string;
  },
): Promise<ClinicalReport> {
  const res = await fetch(browserApiUrl(`/api/v1/clinical-reports/${encodeURIComponent(reportId)}`), {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return _parse(res);
}

export async function submitReport(reportId: string): Promise<ClinicalReport> {
  const res = await fetch(browserApiUrl(`/api/v1/clinical-reports/${encodeURIComponent(reportId)}/submit`), {
    method: "POST",
    credentials: "include",
  });
  return _parse(res);
}

export async function reviewReport(
  reportId: string,
  approved: boolean,
  comment?: string,
): Promise<ClinicalReport> {
  const res = await fetch(browserApiUrl(`/api/v1/clinical-reports/${encodeURIComponent(reportId)}/review`), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ approved, comment: comment ?? null }),
  });
  return _parse(res);
}

export async function issueReport(reportId: string): Promise<ClinicalReport> {
  const res = await fetch(browserApiUrl(`/api/v1/clinical-reports/${encodeURIComponent(reportId)}/issue`), {
    method: "POST",
    credentials: "include",
  });
  return _parse(res);
}

export function reportPdfUrl(reportId: string): string {
  return browserApiUrl(`/api/v1/clinical-reports/${encodeURIComponent(reportId)}/pdf`);
}

export async function deleteReport(reportId: string): Promise<void> {
  const res = await fetch(browserApiUrl(`/api/v1/clinical-reports/${encodeURIComponent(reportId)}`), {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail ?? res.statusText);
  }
}
