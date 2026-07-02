import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireProjectAccess } from "@/lib/authz";
import { apiError, handleApiError } from "@/lib/api-error";
import { assertSameOrigin } from "@/lib/csrf";
import { updateCommentSchema } from "@/features/comments/schemas";
import { deleteComment, updateComment } from "@/features/comments/server/comments";
import { serializeComment } from "@/features/comments/server/serialize";

/** PATCH/DELETE /api/comments/:id — author/ADMIN, edit or soft delete. spec/05-api.md §6. */
async function projectIdForComment(commentId: string): Promise<string | null> {
  const comment = await db.comment.findUnique({
    where: { id: commentId },
    select: {
      task: { select: { phase: { select: { projectId: true } } } },
      file: { select: { projectId: true } },
    },
  });
  if (!comment) return null;
  return comment.task?.phase.projectId ?? comment.file?.projectId ?? null;
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { id } = await context.params;

    const projectId = await projectIdForComment(id);
    if (!projectId) return apiError(404, "not_found", "Comment not found");

    const { user } = await requireProjectAccess(projectId);
    const body = updateCommentSchema.parse(await request.json());

    const updated = await updateComment({ commentId: id, actor: user, body: body.body });
    return NextResponse.json({ item: serializeComment(updated) });
  } catch (error) {
    if (error instanceof Error && /author|deleted/i.test(error.message)) {
      return apiError(403, "forbidden", error.message);
    }
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { id } = await context.params;

    const projectId = await projectIdForComment(id);
    if (!projectId) return apiError(404, "not_found", "Comment not found");

    const { user } = await requireProjectAccess(projectId);
    await deleteComment({ commentId: id, actor: user });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && /not authorized/i.test(error.message)) {
      return apiError(403, "forbidden", error.message);
    }
    return handleApiError(error);
  }
}
