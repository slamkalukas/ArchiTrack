import { NextResponse, type NextRequest } from "next/server";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { stat } from "node:fs/promises";
import { requireProjectAccess, AuthzError } from "@/lib/authz";
import { handleApiError } from "@/lib/api-error";
import { db } from "@/lib/db";
import { storagePathFor } from "@/lib/uploads";
import { isPreviewable } from "@/features/files/server/allowlist";
import { downloadQuerySchema } from "@/features/files/schemas";
import { authorizeDownload } from "@/features/files/server/files";

/**
 * GET /api/files/:id/download?version=n — member*. SECURITY-CRITICAL
 * (spec/02-architecture.md §4.2, spec/04-features.md §5 AC): files are never publicly
 * addressable. This route is the *only* way to read file bytes; it re-checks project
 * membership AND the client-visibility chain (own flag + entire folder chain) before
 * streaming from disk, on every request — no caching of the authorization decision, and
 * a denial always looks like a 404 so a client probing ids learns nothing.
 *
 * Stored filenames on disk are UUIDs; the original name only ever comes back via the
 * `Content-Disposition` header, reconstructed from the DB.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: fileId } = await context.params;

    const file = await db.file.findUnique({ where: { id: fileId }, select: { projectId: true } });
    if (!file) throw new AuthzError(404, "Not found");

    const { user } = await requireProjectAccess(file.projectId);

    const query = downloadQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));

    const authorized = await authorizeDownload(fileId, file.projectId, user.role, query.version);

    const diskPath = storagePathFor(file.projectId, authorized.storageKey);
    const stats = await stat(diskPath).catch(() => null);
    if (!stats) throw new AuthzError(404, "Not found");

    const nodeStream = createReadStream(diskPath);
    const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;

    const inline = isPreviewable(authorized.mimeType);
    const disposition = inline ? "inline" : "attachment";
    const encodedName = encodeURIComponent(authorized.fileName);

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        "Content-Type": authorized.mimeType || "application/octet-stream",
        "Content-Length": String(authorized.size),
        "Content-Disposition": `${disposition}; filename="${encodedName}"; filename*=UTF-8''${encodedName}`,
        "Cache-Control": "private, max-age=0, no-cache",
        // Downloads are never public — no CDN/proxy caching (spec/02-architecture.md §4.2).
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
