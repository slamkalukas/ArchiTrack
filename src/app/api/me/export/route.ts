import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { handleApiError } from "@/lib/api-error";
import { buildUserDataExport } from "@/features/portal/server/gdpr";

/**
 * GET /api/me/export — spec/05-api.md §8, spec/04-features.md §12: "Profile: export my
 * data (JSON of user + their messages/comments)". Returned with a Content-Disposition
 * header so the profile page can trigger a plain browser download.
 */
export async function GET() {
  try {
    const user = await requireUser();
    const data = await buildUserDataExport(user.id);

    return new NextResponse(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="architrack-data-${user.id}.json"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
