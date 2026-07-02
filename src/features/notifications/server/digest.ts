import "server-only";
import type { NotifKind } from "@prisma/client";
import { db } from "@/lib/db";
import { buildDigestEmail } from "@/features/notifications/emails/templates";
import { sendMail } from "@/lib/email";

/**
 * Daily digest (spec/04-features.md §9: "daily digest at 07:00 server time"; default for
 * ADMIN, opt-in for anyone via `User.emailDigest = true`).
 *
 * No in-process scheduler exists in this codebase (spec/02-architecture.md §7 only
 * specifies host-level cron for backups) — `runDailyDigest()` is designed to be invoked
 * by an external trigger (host `cron` calling a protected route, or a future WP-8
 * scheduler). It is idempotent per notification: only un-emailed notifications
 * (`emailedAt IS NULL`) are included and are marked emailed as they're sent, so calling
 * it more than once in a day is harmless.
 */
export async function runDailyDigest(): Promise<{ usersEmailed: number }> {
  const candidates = await db.user.findMany({
    where: { emailDigest: true, isActive: true },
    select: { id: true, email: true, name: true, locale: true },
  });

  let usersEmailed = 0;

  for (const user of candidates) {
    const pending = await db.notification.findMany({
      where: { userId: user.id, emailedAt: null },
      orderBy: { createdAt: "asc" },
      select: { id: true, kind: true, projectId: true },
    });

    if (pending.length === 0) continue;

    const projectIds = [...new Set(pending.map((p) => p.projectId).filter((id): id is string => !!id))];
    const projects = await db.project.findMany({
      where: { id: { in: projectIds } },
      select: { id: true, name: true },
    });
    const projectNameById = new Map(projects.map((p) => [p.id, p.name]));

    const groupsByProject = new Map<string, Map<NotifKind, number>>();
    for (const notif of pending) {
      const projectKey = notif.projectId ?? "—";
      const kindMap = groupsByProject.get(projectKey) ?? new Map<NotifKind, number>();
      kindMap.set(notif.kind, (kindMap.get(notif.kind) ?? 0) + 1);
      groupsByProject.set(projectKey, kindMap);
    }

    const groups = [...groupsByProject.entries()].map(([projectId, kindMap]) => ({
      projectName: projectNameById.get(projectId) ?? projectId,
      items: [...kindMap.entries()].map(([kind, count]) => ({ kind, count })),
    }));

    const { subject, html, text } = buildDigestEmail(user.locale, groups);
    await sendMail({ to: user.email, subject, html, text });

    await db.notification.updateMany({
      where: { id: { in: pending.map((p) => p.id) } },
      data: { emailedAt: new Date() },
    });

    usersEmailed += 1;
  }

  return { usersEmailed };
}
