import { handleAuth } from "@auth0/nextjs-auth0";

// Handles /api/auth/callback and /api/auth/logout.
// NOTE: /api/auth/login is handled by login/route.ts (static route takes
// priority over this dynamic segment in Next.js App Router).
export const GET = handleAuth();
