import { browserApiUrl } from "./get-api-base";

export type ConsentRecord = {
  client_id: string;
  consents: Record<string, boolean>;
  updated_at: string | null;
};

async function _parse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export async function fetchConsent(clientId: string): Promise<ConsentRecord> {
  const res = await fetch(browserApiUrl(`/api/v1/consent/client/${encodeURIComponent(clientId)}`), {
    credentials: "include",
  });
  return _parse(res);
}

export async function saveConsent(clientId: string, consents: Record<string, boolean>): Promise<ConsentRecord> {
  const res = await fetch(browserApiUrl(`/api/v1/consent/client/${encodeURIComponent(clientId)}`), {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ consents }),
  });
  return _parse(res);
}
