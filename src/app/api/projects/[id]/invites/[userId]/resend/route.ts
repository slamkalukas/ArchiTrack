import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { requireProjectAccess } from "@/lib/authz";
import { handleApiError, apiError } from "@/lib/api-error";
import { logActivity } from "@/lib/activity";
import { assertSameOrigin } from "@/lib/csrf";
import { sendMail, renderEmailLayout } from "@/lib/email";
import { notifyInviteSent } from "@/features/projects";

/**
 * POST /api/projects/:id/invites/:userId/resend — ADMIN only (spec/05-api.md §2).
 * Issues a fresh 14-day token (spec/04-features.md §1: "Invites expire after 14 days;
 * can be re-sent"); the old token, if any, remains but is superseded since acceptance
 * only requires *a* valid unused token, not necessarily the newest.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string; userId: string }> }) {
  try {
    assertSameOrigin(request);
    const { id: projectId, userId } = await context.params;
    const { user } = await requireProjectAccess(projectId, "ADMIN");

    const [membership, target] = await Promise.all([
      db.projectMember.findUnique({ where: { projectId_userId: { projectId, userId } } }),
      db.user.findUnique({ where: { id: userId } }),
    ]);
    if (!membership || !target) {
      return apiError(404, "not_found", "Not found");
    }
    if (target.passwordHash) {
      return apiError(409, "already_active", "This user already has an active account.");
    }

    const project = await db.project.findUniqueOrThrow({ where: { id: projectId }, select: { name: true } });

    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    await db.$transaction(async (tx) => {
      await tx.invite.create({ data: { token, userId, expiresAt } });
      await logActivity({ projectId, actorId: user.id, action: "project.invite_resent", entityId: userId }, tx);
      await notifyInviteSent({ actorId: user.id, projectId, invitedUserId: userId, email: target.email }, tx);
    });

    const inviteUrl = `${process.env.APP_URL}/invite/${token}`;
    const isSk = target.locale === "sk";
    try {
      await sendMail({
        to: target.email,
        subject: isSk ? `Boli ste pozvaní do projektu ${project.name}` : `You've been invited to ${project.name}`,
        text: inviteUrl,
        html: renderEmailLayout({
          heading: isSk ? "Boli ste pozvaní" : "You've been invited",
          bodyHtml: isSk
            ? `Boli ste pozvaní do projektu <strong>${project.name}</strong>. Kliknutím nižšie si vytvoríte účet.`
            : `You've been invited to project <strong>${project.name}</strong>. Click below to create your account.`,
          buttonText: isSk ? "Vytvoriť účet" : "Create account",
          buttonUrl: inviteUrl,
        }),
      });
    } catch (error) {
      // The new invite token is already committed above — see the matching try/catch in
      // src/app/api/projects/[id]/members/route.ts for the rationale.
      console.error("[invites] resend email failed to send", error);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
