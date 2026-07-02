import "server-only";
import { db } from "@/lib/db";
import { projectProgress, toPercent } from "@/lib/progress";

/**
 * Role-shaped project reads. Per spec/05-api.md §9.3, CLIENT responses must never leak
 * internal fields — this module is the single place that decides what a CLIENT-shaped
 * project response contains, so route handlers just call these functions rather than
 * hand-rolling `select`s.
 */

export interface ClientProjectSummary {
  id: string;
  name: string;
  slug: string;
  locationText: string | null;
  description: string | null;
  coverImageUrl: string | null;
  progress: number;
  currentPhase: { id: string; name: string; description: string | null } | null;
}

/** CLIENT-shaped list: their own projects (portal shape) — spec/05-api.md §2. */
export async function getClientProjects(userId: string): Promise<ClientProjectSummary[]> {
  const memberships = await db.projectMember.findMany({
    where: { userId },
    select: {
      project: {
        select: {
          id: true,
          name: true,
          slug: true,
          locationText: true,
          description: true,
          coverImageId: true,
          status: true,
          archivedAt: true,
          phases: {
            where: { visibility: "CLIENT_VISIBLE" },
            select: {
              id: true,
              name: true,
              description: true,
              status: true,
              weight: true,
              order: true,
              tasks: {
                where: { visibility: "CLIENT_VISIBLE", deletedAt: null },
                select: { status: true, weight: true },
              },
            },
            orderBy: { order: "asc" },
          },
        },
      },
    },
  });

  const projects = memberships
    .map((m) => m.project)
    // Archived projects are hidden from client home after 90 days (spec/04-features.md §3).
    .filter((p) => {
      if (p.status !== "ARCHIVED" || !p.archivedAt) return true;
      const daysSinceArchive = (Date.now() - p.archivedAt.getTime()) / 86_400_000;
      return daysSinceArchive <= 90;
    });

  if (projects.length === 0) return [];

  const coverImageIds = projects.map((p) => p.coverImageId).filter((id): id is string => !!id);
  const coverVersions =
    coverImageIds.length === 0
      ? []
      : await db.fileVersion.findMany({
          where: { fileId: { in: coverImageIds } },
          select: { fileId: true },
          distinct: ["fileId"],
        });
  const fileIdsWithVersion = new Set(coverVersions.map((v) => v.fileId));

  return projects.map((project) => {
    const currentPhase =
      project.phases.find((p) => p.status === "ACTIVE") ??
      project.phases.find((p) => p.status === "UPCOMING") ??
      null;

    return {
      id: project.id,
      name: project.name,
      slug: project.slug,
      locationText: project.locationText,
      description: project.description,
      coverImageUrl:
        project.coverImageId && fileIdsWithVersion.has(project.coverImageId)
          ? `/api/files/${project.coverImageId}/download`
          : null,
      progress: toPercent(
        projectProgress(project.phases.map((p) => ({ status: p.status, weight: p.weight, tasks: p.tasks }))),
      ),
      currentPhase: currentPhase
        ? { id: currentPhase.id, name: currentPhase.name, description: currentPhase.description }
        : null,
    };
  });
}

/** Full ADMIN-shaped project detail: metadata, members, contacts, phase weights. */
export async function getAdminProjectDetail(projectId: string) {
  return db.project.findUnique({
    where: { id: projectId },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, email: true, role: true, isActive: true } } },
        orderBy: { addedAt: "asc" },
      },
      contacts: { orderBy: { name: "asc" } },
      phases: {
        select: {
          id: true,
          name: true,
          order: true,
          status: true,
          weight: true,
          description: true,
          visibility: true,
          tasks: { select: { id: true, status: true, weight: true, deletedAt: true } },
        },
        orderBy: { order: "asc" },
      },
    },
  });
}

/** Pending invites for a project's CLIENT members (settings "resend invite" UI). */
export async function getPendingInvitesByUser(userIds: string[]) {
  if (userIds.length === 0) return new Map<string, { id: string; expiresAt: Date }>();

  const invites = await db.invite.findMany({
    where: { userId: { in: userIds }, usedAt: null },
    orderBy: { expiresAt: "desc" },
  });

  const byUser = new Map<string, { id: string; expiresAt: Date }>();
  for (const invite of invites) {
    if (!byUser.has(invite.userId)) {
      byUser.set(invite.userId, { id: invite.id, expiresAt: invite.expiresAt });
    }
  }
  return byUser;
}
