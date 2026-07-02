import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * Actions written by `logActivity`. Not a DB enum (spec/03-data-model.md keeps
 * `ActivityLog.action` a free-text string) but centralizing the literal set here keeps
 * every call site consistent and greppable across features.
 */
export type ActivityAction =
  | "project.created"
  | "project.updated"
  | "project.archived"
  | "project.member_added"
  | "project.member_removed"
  | "project.invite_sent"
  | "project.invite_resent"
  | "phase.created"
  | "phase.updated"
  | "phase.status_changed"
  | "phase.deleted"
  | "task.created"
  | "task.updated"
  | "task.status_changed"
  | "task.reordered"
  | "task.deleted"
  | "task.visibility_changed"
  | "folder.created"
  | "folder.updated"
  | "folder.deleted"
  | "file.uploaded"
  | "file.updated"
  | "file.deleted"
  | "file.visibility_changed"
  | "contact.created"
  | "contact.updated"
  | "contact.deleted"
  | "chat.message_sent"
  | "chat.message_edited"
  | "chat.message_deleted"
  | "comment.created"
  | "comment.updated"
  | "comment.deleted"
  | "user.deactivated"
  | "user.anonymized";

export interface LogActivityInput {
  projectId: string;
  actorId: string;
  action: ActivityAction;
  entityId?: string | null;
  meta?: Prisma.InputJsonValue | null;
}

/**
 * Writes exactly one ActivityLog row. Per spec/04-features.md §10 acceptance criteria,
 * every mutating endpoint must call this — code review checklist item.
 *
 * Accepts an optional Prisma transaction client so callers can log atomically with the
 * mutation itself (spec/05-api.md §9.1: "mutate in transaction → logActivity()").
 */
export async function logActivity(
  input: LogActivityInput,
  tx: Prisma.TransactionClient | typeof db = db,
): Promise<void> {
  await tx.activityLog.create({
    data: {
      projectId: input.projectId,
      actorId: input.actorId,
      action: input.action,
      entityId: input.entityId ?? null,
      meta: input.meta ?? undefined,
    },
  });
}
