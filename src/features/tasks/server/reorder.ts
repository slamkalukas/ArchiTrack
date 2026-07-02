/**
 * Pure helpers for kanban reordering (spec/03-data-model.md §3.5: ordering is
 * `(status, order)`, reordering rewrites `order` within the column). Kept side-effect
 * free so the batching/validation logic is directly unit-testable; the route handler
 * wraps `buildReorderWrites` output in a single Prisma transaction.
 */

export type TaskStatusValue = "TODO" | "IN_PROGRESS" | "DONE";

export interface ReorderMove {
  taskId: string;
  status: TaskStatusValue;
  order: number;
}

export interface ReorderWrite {
  taskId: string;
  status: TaskStatusValue;
  order: number;
  /** Set doneAt when the move transitions the task into DONE, clear it otherwise. */
  doneAt: "now" | "clear" | "unchanged";
}

/**
 * Validates a batch of moves and expands them into concrete writes. Renumbers each
 * touched status column to a dense 1..n sequence (per-column) so that concurrent partial
 * batches never leave gaps or duplicate `order` values within a column.
 *
 * `currentStatusByTaskId` supplies the pre-move status of every task referenced in
 * `moves` (and any siblings we need to renumber) so `doneAt` transitions can be detected.
 */
export function buildReorderWrites(
  moves: ReorderMove[],
  currentStatusByTaskId: Map<string, TaskStatusValue>,
): ReorderWrite[] {
  if (moves.length === 0) {
    throw new Error("moves must not be empty");
  }

  const seen = new Set<string>();
  for (const move of moves) {
    if (seen.has(move.taskId)) {
      throw new Error(`duplicate taskId in reorder batch: ${move.taskId}`);
    }
    seen.add(move.taskId);
  }

  // Group by target status, preserving the caller's requested relative order, then
  // renumber densely from 1 so `order` has no gaps within a column.
  const byStatus = new Map<TaskStatusValue, ReorderMove[]>();
  for (const move of moves) {
    const bucket = byStatus.get(move.status) ?? [];
    bucket.push(move);
    byStatus.set(move.status, bucket);
  }

  const writes: ReorderWrite[] = [];
  for (const [status, bucket] of byStatus) {
    const sorted = [...bucket].sort((a, b) => a.order - b.order);
    sorted.forEach((move, index) => {
      const previousStatus = currentStatusByTaskId.get(move.taskId);
      const enteringDone = status === "DONE" && previousStatus !== "DONE";
      const leavingDone = status !== "DONE" && previousStatus === "DONE";
      writes.push({
        taskId: move.taskId,
        status,
        order: index + 1,
        doneAt: enteringDone ? "now" : leavingDone ? "clear" : "unchanged",
      });
    });
  }

  return writes;
}
