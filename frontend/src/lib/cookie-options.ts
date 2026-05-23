/** Shared cookie options for auth routes. */
export function authCookieOptions(request?: Request) {
  const secure =
    process.env.NODE_ENV === "production" ||
    (request &&
      (request.headers.get("x-forwarded-proto") === "https" ||
        request.url.startsWith("https:")));

  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    path: "/",
    secure: !!secure,
  };
}

export function displayCookieOptions(request?: Request) {
  const secure =
    process.env.NODE_ENV === "production" ||
    (request?.headers.get("x-forwarded-proto") === "https");

  return {
    httpOnly: false as const,
    sameSite: "lax" as const,
    path: "/",
    secure: !!secure,
  };
}
