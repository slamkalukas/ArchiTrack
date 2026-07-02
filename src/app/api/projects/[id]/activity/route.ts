import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireProjectAccess } from "@/lib/authz";
import { handleApiError } from "@/lib/api-error";
import { activityQuerySchema } from "@/features/projects";

/**
 * GET /api/projects/:id/activity — spec/05-api.md §2.
 * ADMIN: full paginated log. `?clientFeed=1` + member: filtered, friendly-worded feed
 * (spec/04-features.md §10) — restricted to actions whose effect is client-visible, and
 * never exposes `actorId`/raw `meta` to clients (spec/05-api.md §9.3).
 */
const CLIENT_FEED_ACTIONS = new Set([
  "file.uploaded",
  "file.visibility_changed",
  "task.status_changed",
  "task.visibility_changed",
  "phase.status_changed",
  "chat.message_sent",
  "comment.created",
]);

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await context.params;
    const url = new URL(request.url);
    const query = activityQuerySchema.parse({
      cursor: url.searchParams.get("cursor") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
      clientFeed: url.searchParams.get("clientFeed") ?? undefined,
    });

    const { user } = await requireProjectAccess(projectId, query.clientFeed ? undefined : "ADMIN");

    const isClientFeed = query.clientFeed || user.role === "CLIENT";

    const entries = await db.activityLog.findMany({
      where: {
        projectId,
        ...(isClientFeed ? { action: { in: Array.from(CLIENT_FEED_ACTIONS) } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });

    const hasMore = entries.length > query.limit;
    const page = hasMore ? entries.slice(0, query.limit) : entries;
    const nextCursor = hasMore ? page[page.length - 1]!.id : null;

    const items = isClientFeed
      ? page.map((e) => ({ id: e.id, action: e.action, createdAt: e.createdAt }))
      : page;

    return NextResponse.json({ items, nextCursor });
  } catch (error) {
    return handleApiError(error);
  }
}
