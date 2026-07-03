import { NextResponse, type NextRequest } from "next/server";

/**
 * Security headers middleware (spec/02-architecture.md §4.8).
 * CSRF for mutating API routes is enforced separately per-route via `assertSameOrigin`
 * in `src/lib/csrf.ts` (Auth.js has its own built-in CSRF protection for /api/auth/*).
 */
/** Pages reachable without a session (the (auth) group and the dev showcase). */
const PUBLIC_PAGE_PREFIXES = ["/login", "/invite", "/forgot-password", "/reset-password", "/dev"];

export function proxy(request: NextRequest) {
  // Unauthenticated page requests go to /login instead of 500-ing on a server
  // component's AuthzError. API routes keep their JSON 401/404 semantics; expired or
  // invalid tokens (cookie present, session null) are handled by the (admin)/(client)
  // layouts, which also redirect.
  const { pathname } = request.nextUrl;
  const isPageRequest = request.method === "GET" && !pathname.startsWith("/api");
  const isPublicPage = PUBLIC_PAGE_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  const hasSessionCookie =
    request.cookies.has("authjs.session-token") ||
    request.cookies.has("__Secure-authjs.session-token");

  const response =
    isPageRequest && !isPublicPage && !hasSessionCookie
      ? NextResponse.redirect(new URL("/login", request.url))
      : NextResponse.next();

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
