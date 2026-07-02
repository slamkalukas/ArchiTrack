import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { requireProjectAccess } from "@/lib/authz";
import { apiError, handleApiError } from "@/lib/api-error";
import { assertSameOrigin } from "@/lib/csrf";
import { createCommentSchema } from "@/features/comments/schemas";
import {
  resolveCommentSubject,
  assertClientCanAccessSubject,
  type CommentSubject,
} from "@/features/comments/server/visibility";
import { createComment, listComments } from "@/features/comments/server/comments";
import { serializeComment } from "@/features/comments/server/serialize";

/**
 * Shared GET/POST handlers for both `/api/tasks/:id/comments` and
 * `/api/files/:id/comments` (spec/05-api.md §6). Kept in one place so the visibility
 * rule (spec/04-features.md §7 AC: "a client cannot comment on internal entities even by
 * ID probing") is enforced identically for both subject kinds — 404, never 403.
 */
export async function handleListComments(kind: "task" | "file", id: string) {
  try {
    const subject = await resolveCommentSubject(kind, id);
    if (!subject) return apiError(404, "not_found", "Not found");

    const { user } = await requireProjectAccess(subject.projectId);

    const allowed = await assertClientCanAccessSubject(subject, user.role);
    if (!allowed) return apiError(404, "not_found", "Not found");

    const comments = await listComments(subject);
    return NextResponse.json({ items: comments.map(serializeComment) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function handleCreateComment(request: NextRequest, kind: "task" | "file", id: string) {
  try {
    assertSameOrigin(request);
    const subject = await resolveCommentSubject(kind, id);
    if (!subject) return apiError(404, "not_found", "Not found");

    const { user } = await requireProjectAccess(subject.projectId);

    const allowed = await assertClientCanAccessSubject(subject, user.role);
    if (!allowed) return apiError(404, "not_found", "Not found");

    const body = createCommentSchema.parse(await request.json());

    const comment = await createComment({
      subject: subject as CommentSubject,
      author: user,
      body: body.body,
      parentId: body.parentId,
    });

    return NextResponse.json({ item: serializeComment(comment) }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && /threading|Parent comment/i.test(error.message)) {
      return apiError(400, "validation_error", error.message);
    }
    return handleApiError(error);
  }
}
