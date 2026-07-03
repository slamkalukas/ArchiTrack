import "server-only";
import { db } from "@/lib/db";
import { getClientProjects } from "@/features/projects/server/queries";
import { listPhasesForProject } from "@/features/tasks/server/phases";
import { getUnreadCount as getChatUnreadCount } from "@/features/chat/server/messages";
import { visibleFolderIdSet } from "@/features/files/server/visibility";
import { kindFromMime } from "@/features/files/format";
import { buildMilestones } from "@/features/portal/server/selectors";
import type { SessionUser } from "@/lib/authz";
import type {
  PortalActivityItem,
  PortalDocument,
  PortalHomeData,
  PortalPhase,
  PortalProjectSummary,
} from "@/features/portal/types";

export { resolveActiveProject } from "@/features/portal/server/selectors";

/**
 * Friendly-worded "Aktuality" activity feed subset (spec/04-features.md §8, §10).
 * Reuses the same action allowlist as `GET /api/projects/:id/activity?clientFeed=1`
 * (spec/05-api.md §2) — kept in sync here since the portal home renders it inline
 * rather than round-tripping through that route.
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

/** All projects a CLIENT belongs to, portal-shaped (for the project switcher). */
export async function getPortalProjects(userId: string): Promise<PortalProjectSummary[]> {
  return getClientProjects(userId);
}

/**
 * Full "Prehľad" home data for one project: hero summary, milestone timeline, latest
 * client-visible documents, friendly activity feed, and unread chat teaser count.
 * Every sub-query is already role-shaped/visibility-filtered by the feature it comes
 * from (tasks, files, chat) — this module only assembles them for the portal screen.
 */
export async function getPortalHomeData(projectId: string, user: SessionUser): Promise<PortalHomeData | null> {
  const projects = await getPortalProjects(user.id);
  const project = projects.find((p) => p.id === projectId);
  if (!project) return null;

  const [phases, recentDocuments, activityLogs, unreadChatCount] = await Promise.all([
    listPhasesForProject(projectId, user),
    getRecentClientDocuments(projectId),
    db.activityLog.findMany({
      where: { projectId, action: { in: Array.from(CLIENT_FEED_ACTIONS) } },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    getChatUnreadCount(projectId, user.id),
  ]);

  const milestones = buildMilestones(phases);
  const activity: PortalActivityItem[] = activityLogs.map((entry) => ({
    id: entry.id,
    textKey: entry.action,
    createdAt: entry.createdAt.toISOString(),
  }));

  return { project, milestones, recentDocuments, activity, unreadChatCount };
}

/** Latest 5 client-visible files across the project, newest first — "Najnovšie dokumenty". */
async function getRecentClientDocuments(projectId: string): Promise<PortalDocument[]> {
  const visibleFolderIds = await visibleFolderIdSet(projectId);

  const files = await db.file.findMany({
    where: {
      projectId,
      visibility: "CLIENT_VISIBLE",
      deletedAt: null,
      OR: [{ folderId: null }, { folderId: { in: Array.from(visibleFolderIds) } }],
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { versions: { orderBy: { version: "desc" }, take: 1 } },
  });

  return files.slice(0, 5).map((file) => ({
    id: file.id,
    name: file.name,
    kind: kindFromMime(file.versions[0]?.mimeType),
    updatedAt: (file.versions[0]?.createdAt ?? file.createdAt).toISOString(),
  }));
}

/** Postup tab: phases with client-visible tasks shaped for the vertical checklist view. */
export async function getPortalPhases(projectId: string, user: SessionUser): Promise<PortalPhase[]> {
  const phases = await listPhasesForProject(projectId, user);

  // One grouped query for comment counts across all visible tasks (no per-task N+1).
  const taskIds = phases.flatMap((phase) => phase.tasks.map((task) => task.id));
  const commentGroups = taskIds.length
    ? await db.comment.groupBy({
        by: ["taskId"],
        where: { taskId: { in: taskIds }, deletedAt: null },
        _count: { _all: true },
      })
    : [];
  const commentCounts = new Map(commentGroups.map((g) => [g.taskId, g._count._all]));

  return phases.map((phase) => ({
    id: phase.id,
    order: phase.order,
    name: phase.name,
    description: phase.description,
    status: phase.status,
    progress: phase.progress,
    weight: phase.weight,
    tasks: phase.tasks.map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      dueDate: task.dueDate,
      milestone: task.milestone,
      commentCount: commentCounts.get(task.id) ?? 0,
    })),
  }));
}
