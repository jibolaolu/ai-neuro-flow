import { browserApiUrl } from "./get-api-base";

export type AdminInvoiceRequest = {
  id: string;
  user_id: string;
  clinician_full_name: string;
  period_from: string;
  period_to: string;
  total_hours: number | null;
  line_count: number | null;
  notes: string | null;
  status: string;
  created_at: string;
  approval_status: string;
  reviewed_at: string | null;
  review_notes: string | null;
  reviewed_by_user_id: string | null;
};

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = (err as { detail?: string }).detail ?? res.statusText;
    throw new Error(typeof msg === "string" ? msg : "Request failed");
  }
  return res.json() as Promise<T>;
}

export async function fetchAdminInvoiceRequests(
  approvalStatus: string | "all" = "pending",
): Promise<AdminInvoiceRequest[]> {
  const q = approvalStatus === "all" ? "" : `?approval_status=${encodeURIComponent(approvalStatus)}`;
  const res = await fetch(browserApiUrl(`/api/v1/clinician-finance/admin/invoice-requests${q}`), {
    credentials: "include",
  });
  const data = await parseJson<{ items: AdminInvoiceRequest[] }>(res);
  return data.items ?? [];
}

export async function patchAdminInvoiceRequest(
  invoiceId: string,
  body: { action: "approve" | "reject" | "needs_revision"; notes?: string | null },
): Promise<AdminInvoiceRequest> {
  const res = await fetch(
    browserApiUrl(`/api/v1/clinician-finance/admin/invoice-requests/${encodeURIComponent(invoiceId)}`),
    {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  return parseJson<AdminInvoiceRequest>(res);
}
