import { browserApiUrl } from "./get-api-base";

export type AvailabilitySlot = {
  id: string;
  user_id: string;
  full_name: string;
  date_iso: string;
  start_time: string;
  end_time: string;
  week_id: string | null;
  rota_status: string | null;
  booked_client_id: string | null;
  booked_client_name: string | null;
  booked_client_pathway: string | null;
  admin_status: string | null;
  admin_comment: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
};

export type TeamAvailabilitySlot = AvailabilitySlot & { email: string | null };

export type SlotAdminAction = "accept" | "flag" | "reject" | "reset";

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = (err as { detail?: string }).detail ?? res.statusText;
    throw new Error(typeof msg === "string" ? msg : "Request failed");
  }
  return res.json() as Promise<T>;
}

export async function fetchMyAvailability(): Promise<AvailabilitySlot[]> {
  const res = await fetch(browserApiUrl("/api/v1/availability/mine"), {
    credentials: "include",
  });
  const data = await parseJson<{ items: AvailabilitySlot[] }>(res);
  return data.items;
}

export async function createAvailabilitySlot(body: {
  date_iso: string;
  start_time: string;
  end_time: string;
}): Promise<AvailabilitySlot> {
  const res = await fetch(browserApiUrl("/api/v1/availability/slots"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseJson<AvailabilitySlot>(res);
}

export async function deleteAvailabilitySlot(id: string): Promise<void> {
  const res = await fetch(browserApiUrl(`/api/v1/availability/slots/${encodeURIComponent(id)}`), {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = (err as { detail?: string }).detail ?? res.statusText;
    throw new Error(typeof msg === "string" ? msg : "Delete failed");
  }
}

export async function fetchTeamAvailability(): Promise<TeamAvailabilitySlot[]> {
  const res = await fetch(browserApiUrl("/api/v1/availability/team"), {
    credentials: "include",
  });
  const data = await parseJson<{ items: TeamAvailabilitySlot[] }>(res);
  return data.items;
}

export type RotaConfirmResult = {
  week_id: string;
  updated_slots: number;
  by: string;
  at: string;
  notifications?: {
    email: { sent: number; clinicians: number };
    push: string;
  };
};

export async function adminActionOnSlot(
  slotId: string,
  action: SlotAdminAction,
  comment?: string,
): Promise<TeamAvailabilitySlot> {
  const res = await fetch(
    browserApiUrl(`/api/v1/availability/slots/${encodeURIComponent(slotId)}`),
    {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, comment: comment ?? null }),
    },
  );
  return parseJson<TeamAvailabilitySlot>(res);
}

export async function confirmRotaWeek(weekId: string): Promise<RotaConfirmResult> {
  const res = await fetch(
    browserApiUrl(`/api/v1/availability/rota/confirm/${encodeURIComponent(weekId)}`),
    {
      method: "POST",
      credentials: "include",
    },
  );
  return parseJson<RotaConfirmResult>(res);
}
