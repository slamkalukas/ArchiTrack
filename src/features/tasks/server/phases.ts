import "server-only";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { eventBus } from "@/lib/events";
import type { SessionUser } from "@/lib/authz";
import { AuthzError } from "@/lib/authz";
import type { CreatePhaseInput, PhaseDTO, UpdatePhaseInput } from "@/features/tasks/schemas";
import { toClientTaskDTO, toPhaseDTO } from "@/features/tasks/server/mappers";
import { filterPhasesForClient } from "@/features/tasks/server/visibility";
import { TaskDomainError } from "@/features/tasks/server/errors";

const taskInclude = {
  contact: { select: { name: true } },
  _count: { select: { comments: true } },
} as const;

/**
 * Phases + tasks for a project, role-shaped (spec/05-api.md §3, §9.3). CLIENT callers
 * only ever see CLIENT_VISIBLE phases and, within them, CLIENT_VISIBLE tasks, with
 * internal-only fields (weight, assignee, contact) stripped via `toClientTaskDTO`.
 * Progress numbers are computed from the *full* task set (before filtering) so the
 * client still sees accurate phase progress even though some tasks are hidden.
 */
export async function listPhasesForProject(projectId: string, user: SessionUser): Promise<PhaseDTO[]> {
  const phases = await db.phase.findMany({
    where: { projectId },
    orderBy: { order: "asc" },
    include: {
      tasks: {
        where: { deletedAt: null },
        orderBy: [{ status: "asc" }, { order: "asc" }],
        include: taskInclude,
      },
    },
  });

  const dtos = phases.map(toPhaseDTO);
  if (user.role === "ADMIN") {
    return dtos;
  }

  return filterPhasesForClient(dtos).map((phase) => ({
    ...phase,
    tasks: phase.tasks.map(toClientTaskDTO),
  }));
}

export async function createPhase(
  projectId: string,
  input: CreatePhaseInput,
  user: SessionUser,
): Promise<PhaseDTO> {
  const phase = await db.$transaction(async (tx) => {
    const last = await tx.phase.findFirst({
      where: { projectId },
      orderBy: { order: "desc" },
      select: { order: true },
    });
    const order = (last?.order ?? 0) + 1;

    const created = await tx.phase.create({
      data: {
        projectId,
        name: input.name,
        description: input.description ?? null,
        weight: input.weight,
        visibility: input.visibility,
        order,
      },
    });

    await logActivity(
      { projectId, actorId: user.id, action: "phase.created", entityId: created.id, meta: { name: created.name } },
      tx,
    );

    return created;
  });

  return toPhaseDTO({ ...phase, tasks: [] });
}

export interface UpdatePhaseResult {
  phase: PhaseDTO;
  activatedNextPhaseId?: string;
}

/**
 * Update a phase. Handles rename/status/weight/order/visibility/description, plus the
 * "phase done → next UPCOMING phase becomes ACTIVE" flow (spec/04-features.md §4) when
 * `activateNext` is set alongside `status: "DONE"`.
 */
export async function updatePhase(
  phaseId: string,
  input: UpdatePhaseInput,
  user: SessionUser,
): Promise<UpdatePhaseResult> {
  const result = await db.$transaction(async (tx) => {
    const existing = await tx.phase.findUnique({ where: { id: phaseId } });
    if (!existing) {
      throw new AuthzError(404, "Not found");
    }

    if (input.order !== undefined && input.order !== existing.order) {
      await reorderPhase(tx as typeof db, existing.projectId, phaseId, existing.order, input.order);
    }

    const updated = await tx.phase.update({
      where: { id: phaseId },
      data: {
        name: input.name,
        description: input.description === undefined ? undefined : input.description,
        status: input.status,
        weight: input.weight,
        visibility: input.visibility,
      },
      include: {
        tasks: { where: { deletedAt: null }, orderBy: [{ status: "asc" }, { order: "asc" }], include: taskInclude },
      },
    });

    await logActivity(
      {
        projectId: updated.projectId,
        actorId: user.id,
        action: input.status ? "phase.status_changed" : "phase.updated",
        entityId: phaseId,
        meta: { ...input },
      },
      tx,
    );

    // Auto-activating the next phase mutates a second, distinct entity — it gets its own
    // ActivityLog row (keyed by that phase's entityId) rather than folding into the
    // first, so the log stays one-row-per-mutated-entity (spec/04-features.md §10 AC).
    let activatedNextPhaseId: string | undefined;
    if (input.status === "DONE" && input.activateNext) {
      const next = await tx.phase.findFirst({
        where: { projectId: updated.projectId, status: "UPCOMING", order: { gt: updated.order } },
        orderBy: { order: "asc" },
      });
      if (next) {
        await tx.phase.update({ where: { id: next.id }, data: { status: "ACTIVE" } });
        await logActivity(
          {
            projectId: updated.projectId,
            actorId: user.id,
            action: "phase.status_changed",
            entityId: next.id,
            meta: { status: "ACTIVE", via: "auto_activate_next" },
          },
          tx,
        );
        activatedNextPhaseId = next.id;
      }
    }

    return { phase: toPhaseDTO(updated), activatedNextPhaseId, projectId: updated.projectId };
  });

  eventBus.publish("task.updated", {
    projectId: result.projectId,
    entityId: phaseId,
    status: input.status,
  });

  return { phase: result.phase, activatedNextPhaseId: result.activatedNextPhaseId };
}

export async function deletePhase(phaseId: string, user: SessionUser): Promise<void> {
  await db.$transaction(async (tx) => {
    const phase = await tx.phase.findUnique({
      where: { id: phaseId },
      include: { _count: { select: { tasks: { where: { deletedAt: null } } } } },
    });
    if (!phase) {
      throw new AuthzError(404, "Not found");
    }
    if (phase._count.tasks > 0) {
      throw new TaskDomainError(409, "phase_not_empty", "Phase is not empty");
    }

    await tx.phase.delete({ where: { id: phaseId } });
    await logActivity(
      { projectId: phase.projectId, actorId: user.id, action: "phase.deleted", entityId: phaseId },
      tx,
    );
  });
}

/**
 * Reassign `order` values so `phaseId` moves from `fromOrder` to `toOrder` within its
 * project, shifting the phases in between by one (spec/03-data-model.md `@@unique([projectId, order])`).
 */
async function reorderPhase(
  tx: typeof db,
  projectId: string,
  phaseId: string,
  fromOrder: number,
  toOrder: number,
): Promise<void> {
  if (fromOrder === toOrder) return;

  // Two-step shift to dodge the `@@unique([projectId, order])` constraint: bump the
  // moving phase out of range first, shift siblings, then place it at its final order.
  await tx.phase.update({ where: { id: phaseId }, data: { order: -1 } });

  if (fromOrder < toOrder) {
    await tx.phase.updateMany({
      where: { projectId, order: { gt: fromOrder, lte: toOrder } },
      data: { order: { decrement: 1 } },
    });
  } else {
    await tx.phase.updateMany({
      where: { projectId, order: { gte: toOrder, lt: fromOrder } },
      data: { order: { increment: 1 } },
    });
  }

  await tx.phase.update({ where: { id: phaseId }, data: { order: toOrder } });
}
