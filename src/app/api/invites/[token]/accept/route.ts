import { NextResponse, type NextRequest } from "next/server";
import argon2 from "argon2";
import { db } from "@/lib/db";
import { acceptInviteSchema } from "@/lib/schemas/auth";
import { apiError, handleApiError } from "@/lib/api-error";
import { logActivity } from "@/lib/activity";
import { authRateLimiter, getClientIp } from "@/lib/rate-limit";

/**
 * POST /api/invites/:token/accept — public.
 * Activates a pending client account (or re-invite of an existing one): sets name,
 * password, locale. Spec/04-features.md §1 AC: accepting an invite twice shows a
 * friendly "already used" screen — surfaced here as `invite_used` so the UI can render
 * that copy instead of a generic error.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  try {
    const ip = getClientIp(request);
    const limit = authRateLimiter.consume(`invite-accept:${ip}`);
    if (!limit.ok) {
      return apiError(429, "rate_limited", "Too many attempts. Please try again shortly.");
    }

    const { token } = await context.params;
    const body = acceptInviteSchema.parse(await request.json());

    const invite = await db.invite.findUnique({ where: { token } });

    if (!invite) {
      return apiError(404, "invite_invalid", "This invite is not valid.");
    }
    if (invite.usedAt) {
      return apiError(409, "invite_used", "This invite has already been used.");
    }
    if (invite.expiresAt.getTime() < Date.now()) {
      return apiError(410, "invite_expired", "This invite has expired.");
    }

    const passwordHash = await argon2.hash(body.password, { type: argon2.argon2id });

    const projects = await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: invite.userId },
        data: {
          name: body.name,
          passwordHash,
          locale: body.locale,
          isActive: true,
        },
      });
      await tx.invite.update({
        where: { id: invite.id },
        data: { usedAt: new Date() },
      });

      const memberships = await tx.projectMember.findMany({
        where: { userId: invite.userId },
        select: { projectId: true },
      });

      for (const membership of memberships) {
        await logActivity(
          {
            projectId: membership.projectId,
            actorId: invite.userId,
            action: "project.member_added",
            entityId: invite.userId,
            meta: { via: "invite_accept" },
          },
          tx,
        );
      }

      return memberships.map((m) => m.projectId);
    });

    return NextResponse.json({ ok: true, projectIds: projects });
  } catch (error) {
    return handleApiError(error);
  }
}
