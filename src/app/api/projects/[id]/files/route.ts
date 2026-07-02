import { NextResponse, type NextRequest } from "next/server";
import { requireProjectAccess, AuthzError } from "@/lib/authz";
import { assertSameOrigin } from "@/lib/csrf";
import { apiError, handleApiError } from "@/lib/api-error";
import { logActivity } from "@/lib/activity";
import { eventBus } from "@/lib/events";
import { uploadRateLimiter } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { saveUploadStream, UploadRejectedError } from "@/lib/uploads";
import { maxUploadBytes } from "@/features/files/server/allowlist";

/**
 * POST /api/projects/:id/files — member*. Multipart upload, multiple files.
 * CLIENT is allowed to upload **only** into the project's `systemKey="from_client"`
 * folder (spec/05-api.md §4) — every other destination is ADMIN-only. Uploading a file
 * with an identical name into the same folder creates a new version
 * (handled by `saveUploadStream` → `recordFileVersion`, spec/03-data-model.md §3.4).
 *
 * Fields: `folderId` (a real Folder id) OR omitted (root), plus one or more `files`
 * entries. Streams each file straight to disk (no whole-file buffering) and rejects at
 * the first byte over `MAX_UPLOAD_MB` (spec/05-api.md §9.2).
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { id: projectId } = await context.params;
    const { user } = await requireProjectAccess(projectId);

    const limit = uploadRateLimiter.consume(user.id);
    if (!limit.ok) {
      return apiError(429, "rate_limited", "Too many uploads. Please try again later.");
    }

    const formData = await request.formData();
    const folderIdRaw = formData.get("folderId");
    const folderId = typeof folderIdRaw === "string" && folderIdRaw.length > 0 ? folderIdRaw : null;

    let targetFolder: { id: string; systemKey: string | null } | null = null;
    if (folderId) {
      targetFolder = await db.folder.findFirst({
        where: { id: folderId, projectId },
        select: { id: true, systemKey: true },
      });
      if (!targetFolder) throw new AuthzError(404, "Not found");
    }

    if (user.role === "CLIENT") {
      if (!targetFolder || targetFolder.systemKey !== "from_client") {
        return apiError(403, "forbidden_folder", 'Clients may only upload into the "From client" folder.');
      }
    }

    const entries = formData.getAll("files").filter((v): v is File => v instanceof File);
    if (entries.length === 0) {
      return apiError(400, "no_files", "No files were provided");
    }

    const results: { fileVersionId: string; fileName: string; version: number }[] = [];
    const rejected: { fileName: string; reason: string }[] = [];

    for (const entry of entries) {
      try {
        const version = await saveUploadStream({
          projectId,
          folderKey: folderId ?? "",
          fileName: entry.name,
          mimeType: entry.type || "application/octet-stream",
          stream: entry.stream(),
          uploadedBy: user.id,
        });

        results.push({ fileVersionId: version.id, fileName: entry.name, version: version.version });

        await logActivity({
          projectId,
          actorId: user.id,
          action: "file.uploaded",
          entityId: version.fileId,
          meta: { name: entry.name, version: version.version, size: version.size },
        });

        eventBus.publish("file.added", { projectId, entityId: version.fileId, folderId });
      } catch (error) {
        if (error instanceof UploadRejectedError) {
          rejected.push({ fileName: entry.name, reason: error.message });
          continue;
        }
        throw error;
      }
    }

    if (results.length === 0) {
      return apiError(422, "all_rejected", rejected.map((r) => `${r.fileName}: ${r.reason}`).join("; "));
    }

    return NextResponse.json(
      { uploaded: results, rejected, maxUploadBytes: maxUploadBytes() },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
