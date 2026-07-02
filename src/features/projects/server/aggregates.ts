import "server-only";
import { db } from "@/lib/db";
import type { Prisma, ProjectStatus } from "@prisma/client";
import { projectProgress, toPercent } from "@/lib/progress";

/**
 * Dashboard aggregates (spec/04-features.md §2): current phase, progress %, unread chat
 * count, next due task, expiring-vyjadrenia + overdue-task badges — computed via grouped
 * queries rather than per-project round trips, per the AC ("one query round-trip …
 * no N+1").
 */

export interface DashboardProjectCard {
  id: string;
  name: string;
  slug: string;
  status: ProjectStatus;
  coverImageUrl: string | null;
  clientNames: string[];
  phaseName: string | null;
  progress: number;
  unreadCount: number;
  nextDueTask: { id: string; title: string; dueDate: Date } | null;
  expiringFileCount: number;
  overdueTaskCount: number;
  updatedAt: Date;
}

export interface DashboardQuery {
  status?: ProjectStatus;
  search?: string;
  /** Current viewer, so unread counts are computed relative to their ChatRead rows. */
  userId: string;
}

export async function getDashboardProjects({ status, search, userId }: DashboardQuery): Promise<DashboardProjectCard[]> {
  const where: Prisma.ProjectWhereInput = {
    status: status ?? "ACTIVE",
    ...(search
      ? { name: { contains: search, mode: "insensitive" as Prisma.QueryMode } }
      : {}),
  };

  const projects = await db.project.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, role: true } } },
      },
      phases: {
        select: {
          id: true,
          name: true,
          status: true,
          weight: true,
          order: true,
          tasks: {
            select: { id: true, title: true, status: true, weight: true, dueDate: true, deletedAt: true },
          },
        },
        orderBy: { order: "asc" },
      },
    },
  });

  if (projects.length === 0) return [];

  const projectIds = projects.map((p) => p.id);
  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Grouped queries instead of per-project calls — the AC's "no N+1" requirement.
  const [expiringFileCounts, chatMessages, activityLatest] = await Promise.all([
    db.file.groupBy({
      by: ["projectId"],
      where: { projectId: { in: projectIds }, validUntil: { gte: now, lt: in30Days }, deletedAt: null },
      _count: { _all: true },
    }),
    db.chatMessage.findMany({
      where: { projectId: { in: projectIds }, deletedAt: null },
      select: { id: true, projectId: true, authorId: true, reads: { where: { userId }, select: { userId: true } } },
    }),
    db.activityLog.groupBy({
      by: ["projectId"],
      where: { projectId: { in: projectIds } },
      _max: { createdAt: true },
    }),
  ]);

  const coverImageIds = projects.map((p) => p.coverImageId).filter((id): id is string => !!id);
  const coverVersions =
    coverImageIds.length === 0
      ? []
      : await db.fileVersion.findMany({
          where: { fileId: { in: coverImageIds } },
          orderBy: { version: "desc" },
          select: { fileId: true },
          distinct: ["fileId"],
        });
  const fileIdsWithVersion = new Set(coverVersions.map((v) => v.fileId));

  const expiringByProject = new Map(expiringFileCounts.map((r) => [r.projectId, r._count._all]));
  const activityByProject = new Map(activityLatest.map((r) => [r.projectId, r._max.createdAt]));

  const unreadByProject = new Map<string, number>();
  for (const msg of chatMessages) {
    if (msg.authorId === userId) continue; // never counts own messages as unread
    if (msg.reads.length > 0) continue; // already read by this user
    unreadByProject.set(msg.projectId, (unreadByProject.get(msg.projectId) ?? 0) + 1);
  }

  return projects.map((project) => {
    const clientNames = project.members
      .filter((m) => m.user.role === "CLIENT")
      .map((m) => m.user.name);

    const activePhase =
      project.phases.find((p) => p.status === "ACTIVE") ??
      project.phases.find((p) => p.status === "UPCOMING") ??
      null;

    const progress = toPercent(
      projectProgress(
        project.phases.map((p) => ({
          status: p.status,
          weight: p.weight,
          tasks: p.tasks
            .filter((t) => !t.deletedAt)
            .map((t) => ({ status: t.status, weight: t.weight })),
        })),
      ),
    );

    const allTasks = project.phases.flatMap((p) => p.tasks.filter((t) => !t.deletedAt));
    const overdueTaskCount = allTasks.filter(
      (t) => t.status !== "DONE" && t.dueDate && t.dueDate.getTime() < now.getTime(),
    ).length;

    const nextDue = allTasks
      .filter((t) => t.status !== "DONE" && t.dueDate && t.dueDate.getTime() >= now.getTime())
      .sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime())[0];

    const coverImageUrl =
      project.coverImageId && fileIdsWithVersion.has(project.coverImageId)
        ? `/api/files/${project.coverImageId}/download`
        : null;

    return {
      id: project.id,
      name: project.name,
      slug: project.slug,
      status: project.status,
      coverImageUrl,
      clientNames,
      phaseName: activePhase?.name ?? null,
      progress,
      unreadCount: unreadByProject.get(project.id) ?? 0,
      nextDueTask: nextDue ? { id: nextDue.id, title: nextDue.title, dueDate: nextDue.dueDate! } : null,
      expiringFileCount: expiringByProject.get(project.id) ?? 0,
      overdueTaskCount,
      updatedAt: activityByProject.get(project.id) ?? project.createdAt,
    };
  });
}
