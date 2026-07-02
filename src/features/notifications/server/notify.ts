import "server-only";
import type { NotifKind, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { eventBus } from "@/lib/events";
import { isUserOnline } from "@/features/notifications/server/connections";
import { sendNotificationEmail } from "@/features/notifications/server/mailer";

/**
 * Notification fan-out (spec/04-features.md §9, spec/05-api.md §9.1).
 * Every mutating handler that produces a client-visible or architect-relevant event
 * should call `notifyUsers()` after its transaction commits — it:
 *   1. writes one Notification row per recipient,
 *   2. publishes `notification.new` on the event bus (SSE push to online users),
 *   3. sends an immediate email when the recipient is offline (or their preference is
 *      immediate) — never for users on a daily digest who are online.
 *
 * Visibility filtering (spec/04-features.md §9 AC: "no notification is ever generated
 * for content the recipient cannot see") is the CALLER's responsibility — this function
 * only fans out to the exact recipient ids it is given.
 */

export interface NotifyInput {
  userId: string;
  kind: NotifKind;
  projectId?: string | null;
  entityId?: string | null;
  titleKey: string;
  payload?: Prisma.InputJsonValue | null;
}

/** Create notifications for a batch of recipients and handle SSE + immediate email. */
export async function notifyUsers(inputs: NotifyInput[]): Promise<void> {
  if (inputs.length === 0) return;

  for (const input of inputs) {
    const notification = await db.notification.create({
      data: {
        userId: input.userId,
        kind: input.kind,
        projectId: input.projectId ?? null,
        entityId: input.entityId ?? null,
        titleKey: input.titleKey,
        payload: input.payload ?? undefined,
      },
    });

    eventBus.publish("notification.new", {
      userId: input.userId,
      projectId: input.projectId ?? undefined,
      entityId: notification.id,
    });

    await maybeSendImmediateEmail(notification.id, input.userId);
  }
}

/**
 * Decide whether this notification should be emailed right now:
 * - user.emailDigest === false → immediate emails always (per-event).
 * - user.emailDigest === true → daily digest only, UNLESS the user has no open session
 *   for 5 minutes (spec/04-features.md §6 rule applied uniformly to all notification
 *   kinds per §9) — in which case we still respect their digest preference and skip;
 *   the digest cron (`sendDailyDigest`) covers them at 07:00.
 *
 * Simpler reading actually used here (matches §9 "Email: immediate per event, or daily
 * digest... (user preference, default: clients immediate, architect digest)"): the
 * `emailDigest` flag alone decides immediate vs digest-only. The "offline 5 min" rule
 * from §6 additionally gates chat-message emails specifically (see chat/server/messages.ts),
 * which calls `sendNotificationEmail` directly for that case.
 */
async function maybeSendImmediateEmail(notificationId: string, userId: string): Promise<void> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, locale: true, emailDigest: true, isActive: true },
    });
    if (!user || !user.isActive) return;

    // emailDigest = true means "daily digest", per schema comment ("immediate emails vs daily digest").
    if (user.emailDigest) return;

    const notification = await db.notification.findUnique({ where: { id: notificationId } });
    if (!notification || notification.emailedAt) return;

    await sendNotificationEmail(user, notification);
    await db.notification.update({ where: { id: notificationId }, data: { emailedAt: new Date() } });
  } catch (error) {
    // Email delivery is best-effort: a broken SMTP config must never fail the caller's
    // primary mutation (e.g. posting a chat message) — the in-app notification row and
    // SSE push already happened above in notifyUsers().
    console.error("[notifications] failed to send immediate email", error);
  }
}

/**
 * Chat-specific email gate (spec/04-features.md §6): "if recipient has no open session
 * in 5 min → email notification (respecting digest pref)". Called by the chat server
 * module after `notifyUsers()` has already written the in-app notification.
 */
export async function maybeEmailOfflineRecipient(notificationId: string, userId: string): Promise<void> {
  try {
    if (isUserOnline(userId)) return;

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, locale: true, emailDigest: true, isActive: true },
    });
    if (!user || !user.isActive) return;

    const notification = await db.notification.findUnique({ where: { id: notificationId } });
    if (!notification || notification.emailedAt) return;

    await sendNotificationEmail(user, notification);
    await db.notification.update({ where: { id: notificationId }, data: { emailedAt: new Date() } });
  } catch (error) {
    // Best-effort — see maybeSendImmediateEmail's comment above.
    console.error("[notifications] failed to send offline-recipient email", error);
  }
}
