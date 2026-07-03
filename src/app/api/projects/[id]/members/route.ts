import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { requireProjectAccess } from "@/lib/authz";
import { handleApiError } from "@/lib/api-error";
import { logActivity } from "@/lib/activity";
import { assertSameOrigin } from "@/lib/csrf";
import { sendMail, renderEmailLayout } from "@/lib/email";
import { createMemberSchema, notifyInviteSent } from "@/features/projects";

/**
 * POST /api/projects/:id/members — ADMIN only (spec/05-api.md §2).
 * Creates a CLIENT user (or reuses an existing inactive one) + a fresh 14-day invite,
 * and adds them as a project member immediately so they're already "in" once they
 * accept.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { id: projectId } = await context.params;
    const { user } = await requireProjectAccess(projectId, "ADMIN");
    const body = createMemberSchema.parse(await request.json());
    const email = body.email.toLowerCase();

    const result = await db.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { email } });

      if (existing && existing.role !== "CLIENT") {
        throw new Error("email_belongs_to_admin");
      }

      const clientUser =
        existing ??
        (await tx.user.create({
          data: { email, name: body.name, role: "CLIENT", locale: body.locale, isActive: false },
        }));

      const membership = await tx.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId: clientUser.id } },
      });
      if (!membership) {
        await tx.projectMember.create({ data: { projectId, userId: clientUser.id } });
      }

      let inviteToken: string | null = null;
      if (!clientUser.passwordHash) {
        inviteToken = randomUUID();
        const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
        await tx.invite.create({ data: { token: inviteToken, userId: clientUser.id, expiresAt } });
        await logActivity(
          { projectId, actorId: user.id, action: "project.invite_sent", entityId: clientUser.id },
          tx,
        );
        await notifyInviteSent({ actorId: user.id, projectId, invitedUserId: clientUser.id, email }, tx);
      }

      if (!membership) {
        await logActivity(
          { projectId, actorId: user.id, action: "project.member_added", entityId: clientUser.id },
          tx,
        );
      }

      return { clientUser, inviteToken };
    });

    if (result.inviteToken) {
      const project = await db.project.findUniqueOrThrow({ where: { id: projectId }, select: { name: true } });
      const inviteUrl = `${process.env.APP_URL}/invite/${result.inviteToken}`;
      const isSk = body.locale === "sk";
      try {
        await sendMail({
          to: email,
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
        // The membership + invite row are already committed above — a broken/unreachable
        // SMTP config (e.g. a placeholder host in .env) must not roll back or fail the
        // whole request; the admin can still resend the invite once mail is fixed.
        console.error("[members] invite email failed to send", error);
      }
    }

    return NextResponse.json(
      { user: { id: result.clientUser.id, email: result.clientUser.email, name: result.clientUser.name } },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "email_belongs_to_admin") {
      return NextResponse.json(
        { error: { code: "email_conflict", message: "This email belongs to an existing admin account." } },
        { status: 409 },
      );
    }
    return handleApiError(error);
  }
}
