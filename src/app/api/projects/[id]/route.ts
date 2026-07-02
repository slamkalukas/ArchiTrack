import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireProjectAccess } from "@/lib/authz";
import { handleApiError, apiError } from "@/lib/api-error";
import { logActivity } from "@/lib/activity";
import { assertSameOrigin } from "@/lib/csrf";
import { updateProjectSchema, getAdminProjectDetail, getClientProjects } from "@/features/projects";

/** GET /api/projects/:id — member. Detail shape depends on role (spec/05-api.md §2). */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { user } = await requireProjectAccess(id);

    if (user.role === "ADMIN") {
      const project = await getAdminProjectDetail(id);
      if (!project) return apiError(404, "not_found", "Not found");
      return NextResponse.json({ project });
    }

    const projects = await getClientProjects(user.id);
    const project = projects.find((p) => p.id === id);
    if (!project) return apiError(404, "not_found", "Not found");
    return NextResponse.json({ project });
  } catch (error) {
    return handleApiError(error);
  }
}

/** PATCH /api/projects/:id — ADMIN only. Metadata, status, cover, phase weights. */
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { id } = await context.params;
    const { user } = await requireProjectAccess(id, "ADMIN");
    const body = updateProjectSchema.parse(await request.json());

    const project = await db.$transaction(async (tx) => {
      const { phaseWeights, ...projectFields } = body;

      const wasArchived = await tx.project.findUniqueOrThrow({ where: { id }, select: { status: true } });

      const updated = await tx.project.update({
        where: { id },
        data: {
          ...projectFields,
          ...(body.status === "ARCHIVED" && wasArchived.status !== "ARCHIVED" ? { archivedAt: new Date() } : {}),
          ...(body.status && body.status !== "ARCHIVED" ? { archivedAt: null } : {}),
        },
      });

      if (phaseWeights && Object.keys(phaseWeights).length > 0) {
        for (const [phaseId, weight] of Object.entries(phaseWeights)) {
          await tx.phase.update({ where: { id: phaseId }, data: { weight } });
        }
        await logActivity(
          { projectId: id, actorId: user.id, action: "phase.updated", meta: { phaseWeights } },
          tx,
        );
      }

      await logActivity(
        {
          projectId: id,
          actorId: user.id,
          action: body.status === "ARCHIVED" && wasArchived.status !== "ARCHIVED" ? "project.archived" : "project.updated",
          meta: { fields: Object.keys(projectFields) },
        },
        tx,
      );

      return updated;
    });

    return NextResponse.json({ project });
  } catch (error) {
    return handleApiError(error);
  }
}
