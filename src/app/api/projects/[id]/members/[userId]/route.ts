import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireProjectAccess } from "@/lib/authz";
import { handleApiError, apiError } from "@/lib/api-error";
import { logActivity } from "@/lib/activity";
import { assertSameOrigin } from "@/lib/csrf";

/** DELETE /api/projects/:id/members/:userId — ADMIN only (spec/05-api.md §2). */
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string; userId: string }> }) {
  try {
    assertSameOrigin(request);
    const { id: projectId, userId } = await context.params;
    const { user } = await requireProjectAccess(projectId, "ADMIN");

    const membership = await db.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
    if (!membership) {
      return apiError(404, "not_found", "Not found");
    }

    await db.$transaction(async (tx) => {
      await tx.projectMember.delete({ where: { projectId_userId: { projectId, userId } } });
      await logActivity(
        { projectId, actorId: user.id, action: "project.member_removed", entityId: userId },
        tx,
      );
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
