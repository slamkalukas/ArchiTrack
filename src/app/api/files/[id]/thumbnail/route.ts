import { NextResponse, type NextRequest } from "next/server";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { stat } from "node:fs/promises";
import { requireProjectAccess, AuthzError } from "@/lib/authz";
import { handleApiError } from "@/lib/api-error";
import { db } from "@/lib/db";
import { thumbnailPathFor } from "@/lib/uploads";
import { authorizeDownload } from "@/features/files/server/files";

/**
 * GET /api/files/:id/thumbnail — member*. Webp thumbnail generated at upload time
 * (spec/02-architecture.md §8, sharp). Same authorization chain as the download route —
 * thumbnails are just as sensitive as the original (a floor plan thumbnail still leaks
 * content) so they get the identical membership + visibility check, and 404 on any miss
 * (including "no thumbnail exists for this file type", to avoid distinguishing "not
 * thumbnailable" from "not yours").
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: fileId } = await context.params;

    const file = await db.file.findUnique({ where: { id: fileId }, select: { projectId: true } });
    if (!file) throw new AuthzError(404, "Not found");

    const { user } = await requireProjectAccess(file.projectId);

    const query = new URL(request.url).searchParams.get("version");
    const version = query ? Number(query) : undefined;

    const authorized = await authorizeDownload(fileId, file.projectId, user.role, version);

    const thumbPath = thumbnailPathFor(file.projectId, authorized.storageKey);
    const stats = await stat(thumbPath).catch(() => null);
    if (!stats) throw new AuthzError(404, "Not found");

    const nodeStream = createReadStream(thumbPath);
    const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        "Content-Type": "image/webp",
        "Content-Length": String(stats.size),
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
