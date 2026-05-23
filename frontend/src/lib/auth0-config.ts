/** True when Auth0 hosted login should be used (production or explicit local Auth0 setup). */
export function isAuth0Configured(): boolean {
  return Boolean(
    process.env.AUTH0_SECRET &&
      process.env.AUTH0_ISSUER_BASE_URL &&
      process.env.AUTH0_CLIENT_ID &&
      process.env.AUTH0_CLIENT_SECRET,
  );
}

export function auth0LoginUrl(returnTo = "/api/auth/sync"): string {
  const params = new URLSearchParams({ returnTo });
  return `/api/auth/login?${params.toString()}`;
}
