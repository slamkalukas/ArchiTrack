import "server-only";
import { db } from "@/lib/db";

/** List a user's own notifications, cursor-paginated newest first (spec/05-api.md §7). */
export async function listNotifications(userId: string, cursor?: string, limit = 30) {
  const items = await db.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  let nextCursor: string | undefined;
  if (items.length > limit) {
    const next = items.pop();
    nextCursor = next?.id;
  }

  return { items, nextCursor };
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  return db.notification.count({ where: { userId, readAt: null } });
}

export async function markNotificationsRead(
  userId: string,
  input: { ids: string[] } | { all: true },
): Promise<void> {
  if ("all" in input) {
    await db.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return;
  }

  await db.notification.updateMany({
    where: { userId, id: { in: input.ids } },
    data: { readAt: new Date() },
  });
}
