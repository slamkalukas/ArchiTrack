import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { eventBus } from "@/lib/events";
import type { SessionUser } from "@/lib/authz";
import type { CreateTaskInput, ReorderTasksInput, TaskDTO, UpdateTaskInput } from "@/features/tasks/schemas";
import { toTaskDTO } from "@/features/tasks/server/mappers";
import { TaskDomainError } from "@/features/tasks/server/errors";
import { buildReorderWrites, type TaskStatusValue } from "@/features/tasks/server/reorder";

const taskInclude = {
  contact: { select: { name: true } },
  _count: { select: { comments: true } },
} satisfies Prisma.TaskInclude;

export async function createTask(phaseId: string, input: CreateTaskInput, user: SessionUser): Promise<TaskDTO> {
  const task = await db.$transaction(async (tx) => {
    const phase = await tx.phase.findUnique({ where: { id: phaseId }, select: { projectId: true } });
    if (!phase) {
      throw new TaskDomainError(404, "not_found", "Phase not found");
    }

    if (input.assigneeType === "EXTERNAL" && input.contactId) {
      const contact = await tx.contact.findUnique({ where: { id: input.contactId }, select: { projectId: true } });
      if (!contact || contact.projectId !== phase.projectId) {
        throw new TaskDomainError(400, "invalid_contact", "Contact does not belong to this project");
      }
    }

    const last = await tx.task.findFirst({
      where: { phaseId, status: input.status, deletedAt: null },
      orderBy: { order: "desc" },
      select: { order: true },
    });
    const order = (last?.order ?? 0) + 1;

    const created = await tx.task.create({
      data: {
        phaseId,
        title: input.title,
        description: input.description ?? null,
        status: input.status,
        order,
        weight: input.weight,
        milestone: input.milestone,
        visibility: input.visibility,
        assigneeType: input.assigneeType,
        contactId: input.assigneeType === "EXTERNAL" ? (input.contactId ?? null) : null,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        doneAt: input.status === "DONE" ? new Date() : null,
      },
      include: taskInclude,
    });

    await logActivity(
      {
        projectId: phase.projectId,
        actorId: user.id,
        action: "task.created",
        entityId: created.id,
        meta: { title: created.title, phaseId },
      },
      tx,
    );

    return { ...created, projectId: phase.projectId };
  });

  eventBus.publish("task.updated", { projectId: task.projectId, entityId: task.id, status: task.status });

  return toTaskDTO(task);
}

export async function updateTask(taskId: string, input: UpdateTaskInput, user: SessionUser): Promise<TaskDTO> {
  const result = await db.$transaction(async (tx) => {
    const existing = await tx.task.findUnique({ where: { id: taskId }, include: { phase: true } });
    if (!existing || existing.deletedAt) {
      throw new TaskDomainError(404, "not_found", "Task not found");
    }

    const targetPhaseId = input.phaseId ?? existing.phaseId;
    if (input.phaseId && input.phaseId !== existing.phaseId) {
      const targetPhase = await tx.phase.findUnique({ where: { id: input.phaseId }, select: { projectId: true } });
      if (!targetPhase || targetPhase.projectId !== existing.phase.projectId) {
        throw new TaskDomainError(400, "invalid_phase", "Target phase does not belong to this project");
      }
    }

    if (input.assigneeType === "EXTERNAL" && input.contactId) {
      const contact = await tx.contact.findUnique({ where: { id: input.contactId }, select: { projectId: true } });
      if (!contact || contact.projectId !== existing.phase.projectId) {
        throw new TaskDomainError(400, "invalid_contact", "Contact does not belong to this project");
      }
    }

    const nextStatus = input.status ?? existing.status;
    const enteringDone = nextStatus === "DONE" && existing.status !== "DONE";
    const leavingDone = nextStatus !== "DONE" && existing.status === "DONE";

    let order = input.order;
    if (order === undefined && (input.status !== undefined || input.phaseId !== undefined) && input.order === undefined) {
      // Status/phase changed without an explicit order (e.g. plain PATCH, not a drag) —
      // append to the end of the destination column so it doesn't collide with order=1.
      const last = await tx.task.findFirst({
        where: { phaseId: targetPhaseId, status: nextStatus, id: { not: taskId }, deletedAt: null },
        orderBy: { order: "desc" },
        select: { order: true },
      });
      order = (last?.order ?? 0) + 1;
    }

    const updated = await tx.task.update({
      where: { id: taskId },
      data: {
        title: input.title,
        description: input.description === undefined ? undefined : input.description,
        status: input.status,
        order,
        phaseId: input.phaseId,
        weight: input.weight,
        milestone: input.milestone,
        visibility: input.visibility,
        assigneeType: input.assigneeType,
        contactId:
          input.assigneeType === "ARCHITECT"
            ? null
            : input.contactId === undefined
              ? undefined
              : input.contactId,
        dueDate: input.dueDate === undefined ? undefined : input.dueDate ? new Date(input.dueDate) : null,
        doneAt: enteringDone ? new Date() : leavingDone ? null : undefined,
      },
      include: taskInclude,
    });

    // spec/04-features.md §10 AC: every mutating endpoint writes exactly one ActivityLog
    // row — pick the single most specific action label for this PATCH rather than one
    // row per changed field, but keep every change in `meta` for the audit trail.
    const visibilityChanged = input.visibility !== undefined && input.visibility !== existing.visibility;
    const action: Parameters<typeof logActivity>[0]["action"] =
      input.status !== undefined ? "task.status_changed" : visibilityChanged ? "task.visibility_changed" : "task.updated";

    await logActivity(
      {
        projectId: existing.phase.projectId,
        actorId: user.id,
        action,
        entityId: taskId,
        meta: { ...input } as Prisma.InputJsonValue,
      },
      tx,
    );

    return { task: updated, projectId: existing.phase.projectId };
  });

  eventBus.publish("task.updated", {
    projectId: result.projectId,
    entityId: taskId,
    status: result.task.status,
  });

  return toTaskDTO(result.task);
}

export async function deleteTask(taskId: string, user: SessionUser): Promise<void> {
  const projectId = await db.$transaction(async (tx) => {
    const task = await tx.task.findUnique({ where: { id: taskId }, include: { phase: true } });
    if (!task || task.deletedAt) {
      throw new TaskDomainError(404, "not_found", "Task not found");
    }

    // spec/03-data-model.md §3.3: soft-delete wherever a client may have seen it. Task
    // has a `deletedAt` column exactly for this (prisma/schema.prisma) — a task that is
    // (or ever was) CLIENT_VISIBLE is soft-deleted so its history/comments survive;
    // internal-only tasks are hard-deleted.
    if (task.visibility === "CLIENT_VISIBLE") {
      await tx.task.update({
        where: { id: taskId },
        data: { deletedAt: new Date() },
      });
    } else {
      await tx.task.delete({ where: { id: taskId } });
    }

    await logActivity(
      { projectId: task.phase.projectId, actorId: user.id, action: "task.deleted", entityId: taskId },
      tx,
    );

    return task.phase.projectId;
  });

  eventBus.publish("task.updated", { projectId, entityId: taskId });
}

export interface ReorderResult {
  updatedTaskIds: string[];
  projectId: string;
}

/**
 * POST /api/tasks/reorder — batch, transactional (spec/05-api.md §3). All moves must
 * belong to phases within the same project (verified so a caller can't smuggle a task
 * into another project's board via this endpoint).
 */
export async function reorderTasks(input: ReorderTasksInput, user: SessionUser): Promise<ReorderResult> {
  const result = await db.$transaction(async (tx) => {
    const taskIds = input.moves.map((m) => m.taskId);
    const tasks = await tx.task.findMany({
      where: { id: { in: taskIds }, deletedAt: null },
      include: { phase: { select: { projectId: true } } },
    });

    if (tasks.length !== taskIds.length) {
      throw new TaskDomainError(404, "not_found", "One or more tasks not found");
    }

    const projectIds = new Set(tasks.map((t) => t.phase.projectId));
    if (projectIds.size > 1) {
      throw new TaskDomainError(400, "cross_project", "All tasks in a reorder batch must belong to the same project");
    }
    const [projectId] = projectIds;

    const currentStatusByTaskId = new Map<string, TaskStatusValue>(tasks.map((t) => [t.id, t.status]));
    const writes = buildReorderWrites(input.moves, currentStatusByTaskId);

    for (const write of writes) {
      await tx.task.update({
        where: { id: write.taskId },
        data: {
          status: write.status,
          order: write.order,
          doneAt: write.doneAt === "now" ? new Date() : write.doneAt === "clear" ? null : undefined,
        },
      });
    }

    await logActivity(
      {
        projectId: projectId!,
        actorId: user.id,
        action: "task.reordered",
        meta: { count: writes.length },
      },
      tx,
    );

    return { updatedTaskIds: writes.map((w) => w.taskId), projectId: projectId! };
  });

  for (const taskId of result.updatedTaskIds) {
    eventBus.publish("task.updated", { projectId: result.projectId, entityId: taskId });
  }

  return result;
}
