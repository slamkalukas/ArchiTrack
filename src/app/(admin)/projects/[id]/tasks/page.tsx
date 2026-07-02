import { requireProjectAccess } from "@/lib/authz";
import { listPhasesForProject } from "@/features/tasks/server/phases";
import { PhasesTasksBoard } from "@/features/tasks/components/phases-tasks-board";

/**
 * Admin "Phases & Tasks" tab (spec/04-features.md §4, spec/06-ui-ux.md §3.3). Fetches the
 * initial phase/task tree server-side (role-shaped by `listPhasesForProject`, though this
 * route is ADMIN-only so no filtering applies) and hands off to the client board for
 * kanban drag & drop, the list view, and the task/phase modals.
 */
export default async function ProjectTasksPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await requireProjectAccess(id, "ADMIN");
  const phases = await listPhasesForProject(id, user);

  return <PhasesTasksBoard projectId={id} initialPhases={phases} />;
}
