import "server-only";
import type { Phase, Task } from "@prisma/client";
import { phaseProgress, toPercent } from "@/lib/progress";
import type { PhaseDTO, TaskDTO } from "@/features/tasks/schemas";

type TaskWithExtras = Task & {
  contact?: { name: string } | null;
  _count?: { comments: number };
};

export function toTaskDTO(task: TaskWithExtras): TaskDTO {
  return {
    id: task.id,
    phaseId: task.phaseId,
    title: task.title,
    description: task.description,
    status: task.status,
    order: task.order,
    weight: task.weight,
    milestone: task.milestone,
    visibility: task.visibility,
    assigneeType: task.assigneeType,
    contactId: task.contactId,
    contactName: task.contact?.name ?? null,
    dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    doneAt: task.doneAt ? task.doneAt.toISOString() : null,
    createdAt: task.createdAt.toISOString(),
    commentCount: task._count?.comments,
  };
}

export function toPhaseDTO(phase: Phase & { tasks: TaskWithExtras[] }): PhaseDTO {
  const tasks = phase.tasks.map(toTaskDTO);
  const progress = toPercent(phaseProgress(phase.tasks.map((t) => ({ status: t.status, weight: t.weight }))));

  return {
    id: phase.id,
    projectId: phase.projectId,
    name: phase.name,
    templateKey: phase.templateKey,
    order: phase.order,
    status: phase.status,
    weight: phase.weight,
    description: phase.description,
    visibility: phase.visibility,
    progress,
    tasks,
  };
}

/** Strip fields a CLIENT must never see from a task DTO (spec/05-api.md §9.3). */
export function toClientTaskDTO(task: TaskDTO): TaskDTO {
  return {
    ...task,
    weight: 0,
    assigneeType: "ARCHITECT",
    contactId: null,
    contactName: null,
  };
}
