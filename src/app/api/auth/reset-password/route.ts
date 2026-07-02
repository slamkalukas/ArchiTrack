import { NextResponse, type NextRequest } from "next/server";
import argon2 from "argon2";
import { db } from "@/lib/db";
import { resetPasswordSchema } from "@/lib/schemas/auth";
import { apiError, handleApiError } from "@/lib/api-error";
import { authRateLimiter, getClientIp } from "@/lib/rate-limit";

/**
 * POST /api/auth/reset-password — public.
 * Consumes a token created by /api/auth/forgot-password (or an admin-issued invite used
 * as a reset link) and sets a new password. Bumps `tokenVersion` to invalidate any
 * existing sessions ("logout everywhere" per spec/04-features.md §1).
 */
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const limit = authRateLimiter.consume(`reset-password:${ip}`);
    if (!limit.ok) {
      return apiError(429, "rate_limited", "Too many requests. Please try again shortly.");
    }

    const { token, password } = resetPasswordSchema.parse(await request.json());

    const invite = await db.invite.findUnique({ where: { token } });
    if (!invite || invite.usedAt || invite.expiresAt.getTime() < Date.now()) {
      return apiError(400, "invalid_token", "This password reset link is invalid or has expired.");
    }

    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

    await db.$transaction([
      db.user.update({
        where: { id: invite.userId },
        data: { passwordHash, tokenVersion: { increment: 1 } },
      }),
      db.invite.update({
        where: { id: invite.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
