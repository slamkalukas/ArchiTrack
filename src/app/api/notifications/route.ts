import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/authz";
import { handleApiError } from "@/lib/api-error";
import { listNotificationsQuerySchema } from "@/features/notifications/schemas";
import { listNotifications } from "@/features/notifications/server/notifications";

/** GET /api/notifications?cursor — own notifications. spec/05-api.md §7. */
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const query = listNotificationsQuerySchema.parse({
      cursor: searchParams.get("cursor") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    });

    const { items, nextCursor } = await listNotifications(user.id, query.cursor, query.limit);

    return NextResponse.json({
      items: items.map((n) => ({
        id: n.id,
        kind: n.kind,
        projectId: n.projectId,
        entityId: n.entityId,
        titleKey: n.titleKey,
        payload: n.payload,
        read: !!n.readAt,
        createdAt: n.createdAt.toISOString(),
      })),
      nextCursor: nextCursor ?? null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
