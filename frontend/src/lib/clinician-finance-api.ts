import { browserApiUrl } from "./get-api-base";

export type TimesheetLine = {
  id: string;
  activity_date: string;
  hours: number;
  description: string;
  client_ref: string | null;
  status: string;
  created_at: string;
};

export type InvoiceSummary = {
  id: string;
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
};

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = (err as { detail?: string }).detail ?? res.statusText;
    throw new Error(typeof msg === "string" ? msg : "Request failed");
  }
  return res.json() as Promise<T>;
}

export async function fetchMyTimesheets(): Promise<TimesheetLine[]> {
  const res = await fetch(browserApiUrl("/api/v1/clinician-finance/timesheets/mine"), {
    credentials: "include",
  });
  const data = await parseJson<{ items: TimesheetLine[] }>(res);
  return data.items ?? [];
}

export async function createTimesheet(body: {
  activity_date: string;
  hours: number;
  description: string;
  client_ref?: string | null;
}): Promise<TimesheetLine> {
  const res = await fetch(browserApiUrl("/api/v1/clinician-finance/timesheets"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseJson<TimesheetLine>(res);
}

export type InvoiceGenerateResponse = {
  id: string;
  period_from: string;
  period_to: string;
  total_hours: number;
  line_count: number;
  notes: string | null;
  created_at: string;
  approval_status: string;
};

export async function generateInvoice(body: {
  period_from: string;
  period_to: string;
  notes?: string | null;
}): Promise<InvoiceGenerateResponse> {
  const res = await fetch(browserApiUrl("/api/v1/clinician-finance/invoices/generate"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseJson(res);
}

export async function fetchMyInvoices(): Promise<InvoiceSummary[]> {
  const res = await fetch(browserApiUrl("/api/v1/clinician-finance/invoices/mine"), {
    credentials: "include",
  });
  const data = await parseJson<{ items: InvoiceSummary[] }>(res);
  return data.items ?? [];
}

export async function downloadInvoicePdf(invoiceId: string): Promise<void> {
  const res = await fetch(
    browserApiUrl(`/api/v1/clinician-finance/invoices/${encodeURIComponent(invoiceId)}/pdf`),
    { credentials: "include" },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = (err as { detail?: string }).detail ?? res.statusText;
    throw new Error(typeof msg === "string" ? msg : "Could not download PDF");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `neuroflow-invoice-${invoiceId.slice(0, 8)}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
