/**
 * Pure, DB-free selection logic for the portal feature — kept in its own leaf module
 * (no `server-only`, no Prisma/next-auth imports) so it can be unit-tested directly
 * without dragging in the full auth/DB import chain, matching the pattern of
 * `src/lib/progress.ts` and `src/features/tasks/server/visibility.ts`.
 */
import type { PortalMilestone, PortalProjectSummary } from "@/features/portal/types";

interface MilestoneTaskLike {
  id: string;
  title: string;
  milestone: boolean;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  dueDate: string | null;
  doneAt?: string | null;
}

interface MilestonePhaseLike {
  tasks: MilestoneTaskLike[];
}

/**
 * Resolves which project a portal page should render: the `?project=` query param if it
 * is one of the user's own projects, otherwise their first project. Returns `null` when
 * the user has no projects at all (empty-state territory). Never trusts `requestedId`
 * blindly — falling back silently (rather than 404ing) keeps a CLIENT probing another
 * project's id from learning anything, consistent with the "deny-by-default" posture in
 * spec/02-architecture.md §4.
 */
export function resolveActiveProject(
  projects: PortalProjectSummary[],
  requestedId?: string,
): PortalProjectSummary | null {
  if (projects.length === 0) return null;
  if (requestedId) {
    const match = projects.find((p) => p.id === requestedId);
    if (match) return match;
  }
  return projects[0]!;
}

/** Milestone timeline entries: every milestone task across client-visible phases, in phase/task order. */
export function buildMilestones(phases: MilestonePhaseLike[]): PortalMilestone[] {
  const milestones: PortalMilestone[] = [];
  for (const phase of phases) {
    for (const task of phase.tasks) {
      if (!task.milestone) continue;
      milestones.push({
        id: task.id,
        label: task.title,
        date: task.dueDate ?? task.doneAt ?? null,
        done: task.status === "DONE",
      });
    }
  }
  return milestones;
}
