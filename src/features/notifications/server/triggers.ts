import "server-only";
import { db } from "@/lib/db";
import { notifyUsers } from "@/features/notifications/server/notify";

/**
 * Convenience notification triggers for the non-chat/comment kinds listed in
 * spec/04-features.md §9 (task status change, file added, phase done, milestone,
 * expiry warning, invite events). Chat and comments call `notifyUsers` directly from
 * their own server modules; these are exported for WP-3/WP-4/WP-5 route handlers to
 * call after their own mutations, since those features own the entities being changed
 * but WP-6 owns the notification fan-out itself ("Cross-feature calls: through exported
 * functions of src/features/<x>/server" per spec/07-agent-workplan.md §3).
 *
 * All of these resolve recipients to the project's CLIENT members only (never ADMIN,
 * since these are "content became visible to the client" events) — spec/04-features.md
 * §9 AC: "no notification is ever generated for content the recipient cannot see". The
 * caller is responsible for only invoking these when the underlying entity IS client
 * visible (e.g. task made visible + its phase is client-visible).
 */

async function getProjectClientIds(projectId: string): Promise<string[]> {
  const members = await db.projectMember.findMany({
    where: { projectId, user: { role: "CLIENT", isActive: true } },
    select: { userId: true },
  });
  return members.map((m) => m.userId);
}

async function getProjectAdminIds(): Promise<string[]> {
  const admins = await db.user.findMany({ where: { role: "ADMIN", isActive: true }, select: { id: true } });
  return admins.map((a) => a.id);
}

export async function notifyTaskStatusChanged(projectId: string, taskId: string): Promise<void> {
  const clientIds = await getProjectClientIds(projectId);
  await notifyUsers(
    clientIds.map((userId) => ({
      userId,
      kind: "TASK_STATUS",
      projectId,
      entityId: taskId,
      titleKey: "notifications.taskStatus",
    })),
  );
}

export async function notifyFileAdded(projectId: string, fileId: string): Promise<void> {
  const clientIds = await getProjectClientIds(projectId);
  await notifyUsers(
    clientIds.map((userId) => ({
      userId,
      kind: "FILE_ADDED",
      projectId,
      entityId: fileId,
      titleKey: "notifications.fileAdded",
    })),
  );
}

export async function notifyPhaseDone(projectId: string, phaseId: string): Promise<void> {
  const clientIds = await getProjectClientIds(projectId);
  await notifyUsers(
    clientIds.map((userId) => ({
      userId,
      kind: "PHASE_DONE",
      projectId,
      entityId: phaseId,
      titleKey: "notifications.phaseDone",
    })),
  );
}

export async function notifyMilestoneReached(projectId: string, taskId: string): Promise<void> {
  const clientIds = await getProjectClientIds(projectId);
  await notifyUsers(
    clientIds.map((userId) => ({
      userId,
      kind: "MILESTONE",
      projectId,
      entityId: taskId,
      titleKey: "notifications.milestone",
    })),
  );
}

/** Architect-only: invite sent/resent/accepted (spec/04-features.md §9). */
export async function notifyInviteEvent(projectId: string, userId: string): Promise<void> {
  const adminIds = await getProjectAdminIds();
  await notifyUsers(
    adminIds.map((id) => ({
      userId: id,
      kind: "INVITE",
      projectId,
      entityId: userId,
      titleKey: "notifications.invite",
    })),
  );
}

/** Architect-only: file `validUntil` expiring within 30/7 days (spec/04-features.md §9). */
export async function notifyExpiryWarning(projectId: string, fileId: string): Promise<void> {
  const adminIds = await getProjectAdminIds();
  await notifyUsers(
    adminIds.map((id) => ({
      userId: id,
      kind: "EXPIRY_WARNING",
      projectId,
      entityId: fileId,
      titleKey: "notifications.expiryWarning",
    })),
  );
}
