import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { eventBus } from "@/lib/events";

/**
 * Minimal notification helper for the invite lifecycle events this feature triggers
 * (spec/04-features.md §9: "invite events (architect only)"). Other features add their
 * own notification triggers for their own event kinds — this only covers `INVITE`.
 */
export async function notifyInviteSent(
  input: { actorId: string; projectId: string; invitedUserId: string; email: string },
  tx: Prisma.TransactionClient | typeof db = db,
): Promise<void> {
  // Notify every other ADMIN (the architect team) that an invite was sent — architect-only per spec.
  const admins = await tx.user.findMany({
    where: { role: "ADMIN", isActive: true, id: { not: input.actorId } },
    select: { id: true },
  });

  for (const admin of admins) {
    const notification = await tx.notification.create({
      data: {
        userId: admin.id,
        kind: "INVITE",
        projectId: input.projectId,
        entityId: input.invitedUserId,
        titleKey: "notifications.inviteSent",
        payload: { email: input.email },
      },
    });
    eventBus.publish("notification.new", {
      userId: admin.id,
      projectId: input.projectId,
      entityId: notification.id,
    });
  }
}
