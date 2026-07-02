import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/authz";
import { handleApiError } from "@/lib/api-error";
import { assertSameOrigin } from "@/lib/csrf";
import { markNotificationsReadSchema } from "@/features/notifications/schemas";
import { markNotificationsRead } from "@/features/notifications/server/notifications";

/** POST /api/notifications/read — `{ ids }` or `{ all: true }`. spec/05-api.md §7. */
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const body = markNotificationsReadSchema.parse(await request.json());

    await markNotificationsRead(user.id, body);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
