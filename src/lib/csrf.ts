import "server-only";

/**
 * CSRF protection for mutating API routes (spec/02-architecture.md §4.7).
 * Since session cookies are `sameSite=lax`, a same-origin check on the `Origin` header
 * is sufficient defense-in-depth for state-changing requests. Auth.js's own routes
 * (`/api/auth/*`) already have built-in CSRF protection and should not use this helper.
 */
export class CsrfError extends Error {
  constructor(message = "Cross-origin request blocked") {
    super(message);
    this.name = "CsrfError";
  }
}

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  // No Origin header (e.g. same-origin GET navigations, some non-browser clients making
  // server-to-server calls with a valid session) — nothing to compare against, allow.
  if (!origin) return;

  const appUrl = process.env.APP_URL;
  if (!appUrl) return;

  const expected = new URL(appUrl).origin;
  if (origin !== expected) {
    throw new CsrfError(`Origin "${origin}" does not match expected "${expected}"`);
  }
}
