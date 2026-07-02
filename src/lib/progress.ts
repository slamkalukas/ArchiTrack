/**
 * Pure progress-calculation functions — see spec/02-architecture.md §6.
 *
 *   phaseProgress   = done_tasks_weighted / all_tasks_weighted        (tasks default weight 1)
 *   projectProgress = Σ(phase.weight × phaseProgress) / Σ(phase.weight)   (over non-skipped phases)
 *
 * No I/O here — used identically by admin and client UI, and unit-tested directly.
 */

export type ProgressTaskStatus = "TODO" | "IN_PROGRESS" | "DONE";
export type ProgressPhaseStatus = "UPCOMING" | "ACTIVE" | "DONE" | "SKIPPED";

export interface ProgressTask {
  status: ProgressTaskStatus;
  weight: number;
}

export interface ProgressPhase {
  status: ProgressPhaseStatus;
  weight: number;
  tasks: ProgressTask[];
}

/**
 * Fraction (0..1) of a phase's weighted tasks that are DONE.
 * A phase with no tasks is considered 0% complete unless it is itself DONE (100%) or
 * SKIPPED (excluded by the caller — see `projectProgress`).
 */
export function phaseProgress(tasks: ProgressTask[]): number {
  if (tasks.length === 0) {
    return 0;
  }

  const totalWeight = tasks.reduce((sum, task) => sum + normalizeWeight(task.weight), 0);
  if (totalWeight <= 0) {
    return 0;
  }

  const doneWeight = tasks
    .filter((task) => task.status === "DONE")
    .reduce((sum, task) => sum + normalizeWeight(task.weight), 0);

  return clamp01(doneWeight / totalWeight);
}

/**
 * Weighted average of phase progress across all non-skipped phases of a project.
 * A DONE phase always contributes 1 (100%) regardless of its tasks, so that manually
 * marking a phase done (e.g. it had zero tracked tasks) is reflected immediately.
 */
export function projectProgress(phases: ProgressPhase[]): number {
  const counted = phases.filter((phase) => phase.status !== "SKIPPED");
  const totalWeight = counted.reduce((sum, phase) => sum + normalizeWeight(phase.weight), 0);
  if (totalWeight <= 0) {
    return 0;
  }

  const weightedSum = counted.reduce((sum, phase) => {
    const progress = phase.status === "DONE" ? 1 : phaseProgress(phase.tasks);
    return sum + normalizeWeight(phase.weight) * progress;
  }, 0);

  return clamp01(weightedSum / totalWeight);
}

/** Convert a 0..1 progress fraction to a rounded 0..100 percentage for display. */
export function toPercent(fraction: number): number {
  return Math.round(clamp01(fraction) * 100);
}

function normalizeWeight(weight: number): number {
  return Number.isFinite(weight) && weight > 0 ? weight : 0;
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
