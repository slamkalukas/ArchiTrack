import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, requireRole } from "@/lib/authz";
import { handleApiError } from "@/lib/api-error";
import { logActivity } from "@/lib/activity";
import { assertSameOrigin } from "@/lib/csrf";
import {
  createProjectSchema,
  projectListQuerySchema,
  getDashboardProjects,
  getClientProjects,
  applyTemplate,
  createSystemFolders,
  uniqueSlug,
  notifyInviteSent,
} from "@/features/projects";
import { randomUUID } from "node:crypto";
import { sendMail, renderEmailLayout } from "@/lib/email";

/**
 * GET /api/projects — spec/05-api.md §2.
 * ADMIN: all projects + dashboard aggregates. CLIENT: own projects (portal shape).
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const url = new URL(request.url);
    const query = projectListQuerySchema.parse({
      status: url.searchParams.get("status") ?? undefined,
      search: url.searchParams.get("search") ?? undefined,
    });

    if (user.role === "ADMIN") {
      const projects = await getDashboardProjects({ status: query.status, search: query.search, userId: user.id });
      return NextResponse.json({ items: projects });
    }

    const projects = await getClientProjects(user.id);
    return NextResponse.json({ items: projects });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/projects — ADMIN only. Creates the project, optionally applies a template
 * (with wizard step-2 pruning), creates system folders, and invites any clients supplied
 * in the wizard's first step. Spec/04-features.md §3 AC: "applying the template creates
 * phases, tasks, and the folder tree"; "pruning in the wizard removes both tasks and
 * their folders" (professions sub-folders are only created for kept tasks — see
 * `applyTemplate`).
 */
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const user = await requireRole("ADMIN");
    const body = createProjectSchema.parse(await request.json());

    const slug = await uniqueSlug(body.name);
    const pendingInviteEmails: { email: string; token: string; locale: "sk" | "en" }[] = [];

    const result = await db.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          name: body.name,
          slug,
          locationText: body.locationText || null,
          description: body.description || null,
          startDate: body.startDate ?? null,
          targetDate: body.targetDate ?? null,
          coverImageId: body.coverImageId ?? null,
          members: { create: [{ userId: user.id }] },
        },
      });

      await createSystemFolders(project.id, tx);

      let phaseCount = 0;
      let taskCount = 0;
      if (body.templateId) {
        const summary = await applyTemplate(
          { projectId: project.id, templateId: body.templateId, prunedTaskTemplateIds: body.prunedTaskTemplateIds },
          tx,
        );
        phaseCount = summary.phaseCount;
        taskCount = summary.taskCount;
      }

      await logActivity(
        {
          projectId: project.id,
          actorId: user.id,
          action: "project.created",
          meta: { templateId: body.templateId ?? null, phaseCount, taskCount },
        },
        tx,
      );

      // Invite clients supplied in the wizard's step 1 (optional — "create user + invite
      // now or later" per spec/04-features.md §3).
      for (const client of body.clients) {
        const email = client.email.toLowerCase();
        const clientUser = await tx.user.upsert({
          where: { email },
          update: {},
          create: { email, name: client.name, role: "CLIENT", locale: client.locale, isActive: false },
        });

        await tx.projectMember.upsert({
          where: { projectId_userId: { projectId: project.id, userId: clientUser.id } },
          update: {},
          create: { projectId: project.id, userId: clientUser.id },
        });

        if (!clientUser.passwordHash) {
          const token = randomUUID();
          const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days
          await tx.invite.create({ data: { token, userId: clientUser.id, expiresAt } });

          await logActivity(
            { projectId: project.id, actorId: user.id, action: "project.invite_sent", entityId: clientUser.id },
            tx,
          );

          await notifyInviteSent(
            { actorId: user.id, projectId: project.id, invitedUserId: clientUser.id, email },
            tx,
          );

          // Emails are sent after the transaction commits (see below) rather than here,
          // so a slow/failed SMTP call never holds the DB transaction open or rolls back
          // an otherwise-successful project creation.
          pendingInviteEmails.push({ email, token, locale: client.locale });
        }
      }

      if (body.clients.length > 0) {
        await logActivity(
          { projectId: project.id, actorId: user.id, action: "project.member_added", meta: { via: "creation_wizard" } },
          tx,
        );
      }

      return project;
    });

    for (const invite of pendingInviteEmails) {
      const inviteUrl = `${process.env.APP_URL}/invite/${invite.token}`;
      const isSk = invite.locale === "sk";
      try {
        await sendMail({
          to: invite.email,
          subject: isSk ? `Boli ste pozvaní do projektu ${result.name}` : `You've been invited to ${result.name}`,
          text: inviteUrl,
          html: renderEmailLayout({
            heading: isSk ? "Boli ste pozvaní" : "You've been invited",
            bodyHtml: isSk
              ? `Boli ste pozvaní do projektu <strong>${result.name}</strong>. Kliknutím nižšie si vytvoríte účet.`
              : `You've been invited to project <strong>${result.name}</strong>. Click below to create your account.`,
            buttonText: isSk ? "Vytvoriť účet" : "Create account",
            buttonUrl: inviteUrl,
          }),
        });
      } catch (error) {
        // Project + membership + invite rows are already committed above — see the
        // matching try/catch in src/app/api/projects/[id]/members/route.ts.
        console.error("[projects] invite email failed to send", error);
      }
    }

    return NextResponse.json({ project: result }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
