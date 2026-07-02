import { NextResponse, type NextRequest } from "next/server";
import { Readable } from "node:stream";
import { requireProjectAccess } from "@/lib/authz";
import { handleApiError } from "@/lib/api-error";
import { db } from "@/lib/db";
import { streamProjectZip } from "@/features/files/server/zip";

/**
 * GET /api/projects/:id/files/zip — member*. Streamed ZIP of visible files
 * (spec/05-api.md §4, spec/04-features.md §5 AC: "ZIP of 1 GB project streams without
 * OOM"). Visibility filtering happens inside `streamProjectZip` using the same chain as
 * every other file read path — a CLIENT never gets INTERNAL files via export.
 */
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await context.params;
    const { user } = await requireProjectAccess(projectId);

    const project = await db.project.findUnique({ where: { id: projectId }, select: { slug: true } });
    const archiveStream = await streamProjectZip(projectId, user.role);
    const webStream = Readable.toWeb(archiveStream as Readable) as unknown as ReadableStream;

    const filename = `${project?.slug ?? "project"}.zip`;

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
        "Cache-Control": "private, max-age=0, no-cache",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
