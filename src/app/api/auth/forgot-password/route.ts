import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { forgotPasswordSchema } from "@/lib/schemas/auth";
import { handleApiError, apiError } from "@/lib/api-error";
import { authRateLimiter, getClientIp } from "@/lib/rate-limit";
import { sendMail, renderEmailLayout } from "@/lib/email";

/**
 * POST /api/auth/forgot-password — public.
 * Always returns 200 regardless of whether the email exists (spec/05-api.md §1), to
 * avoid leaking account existence. Reuses the `Invite` table as the reset-token store
 * (1h validity per spec/04-features.md §1) — a password reset is modeled as a fresh
 * invite-style token for an already-active user.
 */
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const limit = authRateLimiter.consume(`forgot-password:${ip}`);
    if (!limit.ok) {
      return apiError(429, "rate_limited", "Too many requests. Please try again shortly.");
    }

    const { email } = forgotPasswordSchema.parse(await request.json());

    const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });

    if (user && user.isActive) {
      const token = randomUUID();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await db.invite.create({
        data: { token, userId: user.id, expiresAt },
      });

      const resetUrl = `${process.env.APP_URL}/reset-password?token=${token}`;
      const isSk = user.locale === "sk";

      await sendMail({
        to: user.email,
        subject: isSk ? "Obnovenie hesla — ArchiTrack" : "Password reset — ArchiTrack",
        text: `${resetUrl}`,
        html: renderEmailLayout({
          heading: isSk ? "Obnovenie hesla" : "Reset your password",
          bodyHtml: isSk
            ? "Kliknutím na tlačidlo nižšie si nastavíte nové heslo. Odkaz je platný 1 hodinu."
            : "Click the button below to set a new password. This link is valid for 1 hour.",
          buttonText: isSk ? "Nastaviť nové heslo" : "Set new password",
          buttonUrl: resetUrl,
        }),
      });
    }

    // Always 200 — do not reveal whether the account exists.
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
