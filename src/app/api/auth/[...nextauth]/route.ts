import type { NextRequest } from "next/server";
import { handlers } from "@/lib/auth";
import { apiError } from "@/lib/api-error";
import { authRateLimiter, getClientIp } from "@/lib/rate-limit";

export const { GET } = handlers;

/**
 * Wrap the POST handler (covers /api/auth/callback/credentials, i.e. the actual login
 * submission) with the shared auth rate limiter — 5/min/IP per spec/05-api.md §9.4.
 * Other POST sub-routes (csrf, session, signout) pass straight through.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ nextauth: string[] }> }) {
  const { nextauth } = await context.params;
  const isCredentialsCallback = nextauth?.[0] === "callback" && nextauth?.[1] === "credentials";

  if (isCredentialsCallback) {
    const ip = getClientIp(request);
    const limit = authRateLimiter.consume(`login:${ip}`);
    if (!limit.ok) {
      return apiError(429, "rate_limited", "Too many attempts. Please try again shortly.");
    }
  }

  return handlers.POST(request);
}
