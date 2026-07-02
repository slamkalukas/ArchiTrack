import { NextResponse, type NextRequest } from "next/server";
import { requireUser, AuthzError } from "@/lib/authz";
import { assertSameOrigin } from "@/lib/csrf";
import { apiError, handleApiError } from "@/lib/api-error";
import { logActivity } from "@/lib/activity";
import { eventBus } from "@/lib/events";
import { db } from "@/lib/db";
import { updateFolderSchema } from "@/features/files/schemas";
import { deleteFolderIfEmpty } from "@/features/files/server/folders";

/** PATCH /api/folders/:id — ADMIN. Rename/move/visibility. */
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    if (user.role !== "ADMIN") throw new AuthzError(404, "Not found");

    const { id: folderId } = await context.params;
    const existing = await db.folder.findUnique({ where: { id: folderId } });
    if (!existing) throw new AuthzError(404, "Not found");

    const body = updateFolderSchema.parse(await request.json());

    if (body.parentId !== undefined && body.parentId === folderId) {
      return apiError(400, "invalid_parent", "A folder cannot be its own parent");
    }

    if (body.name !== undefined || body.parentId !== undefined) {
      const targetParentId = body.parentId !== undefined ? body.parentId : existing.parentId;
      const targetName = body.name ?? existing.name;
      const clash = await db.folder.findFirst({
        where: {
          projectId: existing.projectId,
          parentId: targetParentId,
          name: targetName,
          NOT: { id: folderId },
        },
        select: { id: true },
      });
      if (clash) {
        return apiError(409, "duplicate_folder", "A folder with this name already exists here");
      }
    }

    const folder = await db.folder.update({
      where: { id: folderId },
      data: {
        name: body.name,
        parentId: body.parentId,
        visibility: body.visibility,
        order: body.order,
      },
    });

    await logActivity({
      projectId: existing.projectId,
      actorId: user.id,
      action: "folder.updated",
      entityId: folder.id,
      meta: { name: folder.name },
    });

    eventBus.publish("file.added", { projectId: existing.projectId, entityId: folder.id, folderId: folder.parentId });

    return NextResponse.json({ folder });
  } catch (error) {
    return handleApiError(error);
  }
}

/** DELETE /api/folders/:id — ADMIN. Only when empty. */
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    if (user.role !== "ADMIN") throw new AuthzError(404, "Not found");

    const { id: folderId } = await context.params;
    const existing = await db.folder.findUnique({ where: { id: folderId }, select: { projectId: true, name: true } });
    if (!existing) throw new AuthzError(404, "Not found");

    try {
      await deleteFolderIfEmpty(folderId, existing.projectId);
    } catch (error) {
      if (error instanceof Error && error.name === "FolderNotEmptyError") {
        return apiError(409, "folder_not_empty", error.message);
      }
      if (error instanceof Error && error.name === "SystemFolderError") {
        return apiError(400, "system_folder", error.message);
      }
      throw error;
    }

    await logActivity({
      projectId: existing.projectId,
      actorId: user.id,
      action: "folder.deleted",
      entityId: folderId,
      meta: { name: existing.name },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
