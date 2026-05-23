import { browserApiUrl } from "./get-api-base";

/* ── Types ─────────────────────────────────────────────────────────────────── */

export type SupportTicket = {
  id: string;
  raised_by_user_id: string;
  raised_by_name: string;
  raised_by_email: string;
  clinic_id: string | null;
  clinic_name: string | null;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  assigned_to_user_id: string | null;
  assigned_to_name: string | null;
  platform_response: string | null;
  created_at: string | null;
  updated_at: string | null;
  resolved_at: string | null;
};

export type SupportTicketList = {
  items: SupportTicket[];
  total: number;
};

export type TicketCreatePayload = {
  title: string;
  description: string;
  category: string;
  priority: string;
};

export type TicketUpdatePayload = {
  status?: string;
  assigned_to_user_id?: string;
  assigned_to_name?: string;
  platform_response?: string;
  priority?: string;
};

/* ── Category / Priority / Status options ──────────────────────────────────── */

export const TICKET_CATEGORIES = [
  { value: "access",          label: "Access / Login" },
  { value: "billing",         label: "Billing" },
  { value: "bug",             label: "Bug / Error" },
  { value: "data",            label: "Data issue" },
  { value: "feature_request", label: "Feature request" },
  { value: "integration",     label: "Integration" },
  { value: "other",           label: "Other" },
] as const;

export const TICKET_PRIORITIES = [
  { value: "low",      label: "Low" },
  { value: "medium",   label: "Medium" },
  { value: "high",     label: "High" },
  { value: "critical", label: "Critical" },
] as const;

export const TICKET_STATUSES = [
  { value: "",               label: "All statuses" },
  { value: "open",           label: "Open" },
  { value: "in_progress",    label: "In progress" },
  { value: "awaiting_info",  label: "Awaiting info" },
  { value: "resolved",       label: "Resolved" },
  { value: "closed",         label: "Closed" },
] as const;

/* ── API helpers ───────────────────────────────────────────────────────────── */

export async function fetchTickets(statusFilter?: string): Promise<SupportTicketList> {
  const params = new URLSearchParams();
  if (statusFilter) params.set("status_filter", statusFilter);
  const q = params.toString();
  const res = await fetch(
    browserApiUrl(`/api/v1/support-tickets${q ? `?${q}` : ""}`),
    { credentials: "include" },
  );
  if (!res.ok) throw new Error("Failed to load tickets");
  return res.json() as Promise<SupportTicketList>;
}

export async function createTicket(payload: TicketCreatePayload): Promise<SupportTicket> {
  const res = await fetch(browserApiUrl("/api/v1/support-tickets"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail ?? "Failed to create ticket");
  }
  return res.json() as Promise<SupportTicket>;
}

export async function updateTicket(id: string, payload: TicketUpdatePayload): Promise<SupportTicket> {
  const res = await fetch(browserApiUrl(`/api/v1/support-tickets/${id}`), {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail ?? "Failed to update ticket");
  }
  return res.json() as Promise<SupportTicket>;
}
