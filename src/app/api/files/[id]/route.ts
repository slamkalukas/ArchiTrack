import { NextResponse, type NextRequest } from "next/server";
import { requireUser, AuthzError } from "@/lib/authz";
import { assertSameOrigin } from "@/lib/csrf";
import { apiError, handleApiError } from "@/lib/api-error";
import { logActivity } from "@/lib/activity";
import { eventBus } from "@/lib/events";
import { db } from "@/lib/db";
import { requireProjectAccess } from "@/lib/authz";
import { updateFileSchema } from "@/features/files/schemas";
import { loadFileForRole, updateFile, deleteFile } from "@/features/files/server/files";

async function loadProjectIdOr404(fileId: string): Promise<string> {
  const file = await db.file.findUnique({ where: { id: fileId }, select: { projectId: true } });
  if (!file) throw new AuthzError(404, "Not found");
  return file.projectId;
}

/** GET /api/files/:id — member*. Metadata + versions (+ comment count; comments thread via /api/files/:id/comments, WP-6). */
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: fileId } = await context.params;
    const projectId = await loadProjectIdOr404(fileId);
    const { user } = await requireProjectAccess(projectId);

    const file = await loadFileForRole(fileId, projectId, user.role);
    return NextResponse.json({ file });
  } catch (error) {
    return handleApiError(error);
  }
}

/** PATCH /api/files/:id — ADMIN. Rename, move, visibility, validUntil. */
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    if (user.role !== "ADMIN") throw new AuthzError(404, "Not found");

    const { id: fileId } = await context.params;
    const projectId = await loadProjectIdOr404(fileId);
    await requireProjectAccess(projectId, "ADMIN");

    const body = updateFileSchema.parse(await request.json());

    let file;
    try {
      file = await updateFile(fileId, projectId, body);
    } catch (error) {
      if (error instanceof Error && error.name === "DuplicateFileError") {
        return apiError(409, "duplicate_file", error.message);
      }
      throw error;
    }

    const visibilityChanged = body.visibility !== undefined;
    await logActivity({
      projectId,
      actorId: user.id,
      action: visibilityChanged ? "file.visibility_changed" : "file.updated",
      entityId: file.id,
      meta: { name: file.name, visibility: file.visibility },
    });

    eventBus.publish("file.added", { projectId, entityId: file.id, folderId: file.folderId });

    return NextResponse.json({ file });
  } catch (error) {
    return handleApiError(error);
  }
}

/** DELETE /api/files/:id — ADMIN. Soft delete if ever client-visible, else hard delete. */
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    if (user.role !== "ADMIN") throw new AuthzError(404, "Not found");

    const { id: fileId } = await context.params;
    const projectId = await loadProjectIdOr404(fileId);
    await requireProjectAccess(projectId, "ADMIN");

    await deleteFile(fileId, projectId);

    await logActivity({
      projectId,
      actorId: user.id,
      action: "file.deleted",
      entityId: fileId,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
