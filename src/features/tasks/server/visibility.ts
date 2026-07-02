/**
 * Pure visibility-filtering helpers for phases/tasks (spec/03-data-model.md §3.2,
 * spec/05-api.md §9.3). No I/O — unit-testable in isolation.
 *
 * Rule: a task is visible to a CLIENT only when the task itself is CLIENT_VISIBLE **and**
 * its phase is CLIENT_VISIBLE. Internal-only fields (description, weight, assignee,
 * contact, internal-only tasks) must never reach a CLIENT response.
 */

export interface VisibilityTask {
  id: string;
  visibility: "INTERNAL" | "CLIENT_VISIBLE";
}

export interface VisibilityPhase<T extends VisibilityTask = VisibilityTask> {
  visibility: "INTERNAL" | "CLIENT_VISIBLE";
  tasks: T[];
}

/** True when a task is visible to a CLIENT, given its own visibility and its phase's. */
export function isTaskClientVisible(
  taskVisibility: "INTERNAL" | "CLIENT_VISIBLE",
  phaseVisibility: "INTERNAL" | "CLIENT_VISIBLE",
): boolean {
  return taskVisibility === "CLIENT_VISIBLE" && phaseVisibility === "CLIENT_VISIBLE";
}

/**
 * Filter a list of phases (with nested tasks) down to what a CLIENT may see: internal
 * phases are dropped entirely, and within visible phases only client-visible tasks
 * remain. Progress numbers on the phase itself are computed from the *full* task set
 * before this filter runs (client still sees the real progress %, just not every task).
 */
export function filterPhasesForClient<P extends VisibilityPhase>(phases: P[]): P[] {
  return phases
    .filter((phase) => phase.visibility === "CLIENT_VISIBLE")
    .map((phase) => ({
      ...phase,
      tasks: phase.tasks.filter((task) => task.visibility === "CLIENT_VISIBLE"),
    }));
}
