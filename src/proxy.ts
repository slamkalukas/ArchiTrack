import { NextResponse, type NextRequest } from "next/server";

/**
 * Security headers middleware (spec/02-architecture.md §4.8).
 * CSRF for mutating API routes is enforced separately per-route via `assertSameOrigin`
 * in `src/lib/csrf.ts` (Auth.js has its own built-in CSRF protection for /api/auth/*).
 */
export function proxy(request: NextRequest) {
  const response = NextResponse.next();

  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "img-src 'self' data: blob:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline'",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
  );
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Content-Type-Options", "nosniff");

  // Guard against clickjacking/CSRF-adjacent surprises on same-origin mutation checks:
  // downstream route handlers (assertSameOrigin) rely on Origin being forwarded as-is.
  void request;

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static assets and Next internals, so headers apply
     * to pages and API routes alike without touching _next/static, images, favicon.
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
