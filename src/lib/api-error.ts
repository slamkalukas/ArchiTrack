import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthzError } from "@/lib/authz";
import { CsrfError } from "@/lib/csrf";

/** Shared error envelope per spec/05-api.md: `{ error: { code, message } }`. */
export function apiError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/**
 * Translate a thrown error into the shared API error envelope. Use in a top-level
 * try/catch in each route handler so Zod validation errors, AuthzError, and unexpected
 * errors all produce a consistent shape.
 */
export function handleApiError(error: unknown) {
  if (error instanceof AuthzError) {
    const code = error.status === 401 ? "unauthorized" : error.status === 404 ? "not_found" : "forbidden";
    return apiError(error.status, code, error.message);
  }

  if (error instanceof CsrfError) {
    return apiError(403, "csrf_blocked", error.message);
  }

  if (error instanceof ZodError) {
    return apiError(400, "validation_error", error.issues.map((i) => i.message).join("; "));
  }

  console.error("[api] unhandled error", error);
  return apiError(500, "internal_error", "Something went wrong. Please try again.");
}
