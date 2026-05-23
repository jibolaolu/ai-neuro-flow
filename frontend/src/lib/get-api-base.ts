/**
 * API base URLs for browser vs server.
 *
 * When NEXT_PUBLIC_API_URL is empty, the browser uses same-origin paths like `/api/v1/...`
 * (Next.js rewrites proxy to the FastAPI backend). That avoids mixed-content blocks when the
 * site is served over HTTPS (e.g. localtest.me) while the API is HTTP on localhost.
 *
 * Server components cannot rely on that rewrite from Node; they call BACKEND_INTERNAL_URL
 * or BACKEND_URL (direct to FastAPI) by default.
 */

export function publicApiBase(): string {
  const u = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!u) return "";
  return u.replace(/\/$/, "");
}

export function serverApiBase(): string {
  const internal = process.env.BACKEND_INTERNAL_URL?.trim() || process.env.BACKEND_URL?.trim();
  if (internal) return internal.replace(/\/$/, "");
  const pub = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (pub) return pub.replace(/\/$/, "");
  return "http://127.0.0.1:8004";
}

/** Client-side fetch URL: same-origin `/api/v1/...` when NEXT_PUBLIC_API_URL is unset. */
export function browserApiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  const pub = publicApiBase();
  return pub ? `${pub}${p}` : p;
}

/** Server-side fetch: always reaches FastAPI directly unless NEXT_PUBLIC_API_URL is the only config. */
export function serverApiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  const pub = publicApiBase();
  const base = pub || serverApiBase();
  return `${base}${p}`;
}
