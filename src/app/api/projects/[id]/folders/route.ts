import { NextResponse, type NextRequest } from "next/server";
import { requireProjectAccess } from "@/lib/authz";
import { assertSameOrigin } from "@/lib/csrf";
import { apiError, handleApiError } from "@/lib/api-error";
import { logActivity } from "@/lib/activity";
import { eventBus } from "@/lib/events";
import { createFolderSchema } from "@/features/files/schemas";
import { createFolder, loadFolderTree, loadRootFiles } from "@/features/files/server/folders";

/**
 * GET /api/projects/:id/folders — member. Tree + files, role-filtered.
 * `?folderId=` is accepted for API-shape compatibility with spec/05-api.md §4 (lazy
 * loading) but at this project's scale (§8 budgets) we return the full tree in one
 * round-trip and let the client focus/expand locally — cheaper than N+1 round trips.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await context.params;
    const { user } = await requireProjectAccess(projectId);

    const [tree, rootFiles] = await Promise.all([
      loadFolderTree(projectId, user.role),
      loadRootFiles(projectId, user.role),
    ]);

    return NextResponse.json({ folders: tree, rootFiles });
  } catch (error) {
    return handleApiError(error);
  }
}

/** POST /api/projects/:id/folders — ADMIN only. */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { id: projectId } = await context.params;
    const { user } = await requireProjectAccess(projectId, "ADMIN");

    const body = createFolderSchema.parse(await request.json());

    let folder;
    try {
      folder = await createFolder({
        projectId,
        name: body.name,
        parentId: body.parentId ?? null,
        visibility: body.visibility,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "DuplicateFolderError") {
        return apiError(409, "duplicate_folder", error.message);
      }
      throw error;
    }

    await logActivity({
      projectId,
      actorId: user.id,
      action: "folder.created",
      entityId: folder.id,
      meta: { name: folder.name, parentId: folder.parentId },
    });

    eventBus.publish("file.added", { projectId, entityId: folder.id, folderId: folder.parentId });

    return NextResponse.json({ folder }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
