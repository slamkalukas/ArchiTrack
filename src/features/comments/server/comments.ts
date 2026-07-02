import "server-only";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { eventBus } from "@/lib/events";
import { notifyUsers, maybeEmailOfflineRecipient } from "@/features/notifications/server/notify";
import { getProjectParticipants } from "@/features/chat/server/messages";
import type { SessionUser } from "@/lib/authz";
import type { CommentSubject } from "@/features/comments/server/visibility";

const COMMENT_INCLUDE = {
  author: { select: { id: true, name: true, avatarUrl: true, role: true } },
  replies: {
    include: { author: { select: { id: true, name: true, avatarUrl: true, role: true } } },
    orderBy: { createdAt: "asc" as const },
  },
} as const;

export type CommentWithRelations = Awaited<ReturnType<typeof listComments>>[number];

/** Top-level comments (with their one level of replies) for a task or file, oldest first. */
export async function listComments(subject: CommentSubject) {
  return db.comment.findMany({
    where: {
      parentId: null,
      ...(subject.kind === "task" ? { taskId: subject.id } : { fileId: subject.id }),
    },
    orderBy: { createdAt: "asc" },
    include: COMMENT_INCLUDE,
  });
}

export interface CreateCommentInput {
  subject: CommentSubject;
  author: SessionUser;
  body: string;
  parentId?: string;
}

export async function createComment(input: CreateCommentInput) {
  if (input.parentId) {
    const parent = await db.comment.findUnique({ where: { id: input.parentId } });
    if (!parent || parent.deletedAt) {
      throw new Error("Parent comment not found");
    }
    if (parent.parentId) {
      throw new Error("Only one level of threading is allowed");
    }
  }

  const comment = await db.$transaction(async (tx) => {
    const created = await tx.comment.create({
      data: {
        authorId: input.author.id,
        body: input.body,
        taskId: input.subject.kind === "task" ? input.subject.id : undefined,
        fileId: input.subject.kind === "file" ? input.subject.id : undefined,
        parentId: input.parentId,
      },
    });

    await logActivity(
      {
        projectId: input.subject.projectId,
        actorId: input.author.id,
        action: "comment.created",
        entityId: created.id,
        meta: { subjectKind: input.subject.kind, subjectId: input.subject.id },
      },
      tx,
    );

    return created;
  });

  eventBus.publish("task.updated", {
    projectId: input.subject.projectId,
    entityId: input.subject.id,
  });

  await fanOutCommentNotification(input.subject, comment.id, input.author.id);

  return getCommentById(comment.id);
}

/** Notify the "other party": if the author is ADMIN, notify the project's clients; if CLIENT, notify all ADMINs. */
async function fanOutCommentNotification(subject: CommentSubject, commentId: string, authorId: string) {
  const participants = await getProjectParticipants(subject.projectId);
  const recipients = participants.filter((p) => p.id !== authorId);

  await notifyUsers(
    recipients.map((r) => ({
      userId: r.id,
      kind: "COMMENT",
      projectId: subject.projectId,
      entityId: commentId,
      titleKey: "notifications.comment",
      payload: { subjectKind: subject.kind, subjectId: subject.id },
    })),
  );

  const freshNotifications = await db.notification.findMany({
    where: { userId: { in: recipients.map((r) => r.id) }, entityId: commentId, kind: "COMMENT" },
    select: { id: true, userId: true },
  });
  await Promise.all(freshNotifications.map((n) => maybeEmailOfflineRecipient(n.id, n.userId)));
}

export async function getCommentById(id: string) {
  return db.comment.findUniqueOrThrow({ where: { id }, include: COMMENT_INCLUDE });
}

export interface UpdateCommentInput {
  commentId: string;
  actor: SessionUser;
  body: string;
}

export async function updateComment(input: UpdateCommentInput) {
  const comment = await db.comment.findUniqueOrThrow({ where: { id: input.commentId } });
  if (comment.authorId !== input.actor.id) {
    throw new Error("Only the author can edit this comment");
  }
  if (comment.deletedAt) {
    throw new Error("Cannot edit a deleted comment");
  }

  const projectId = await projectIdForComment(comment.taskId, comment.fileId);

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.comment.update({ where: { id: input.commentId }, data: { body: input.body } });
    await logActivity(
      { projectId, actorId: input.actor.id, action: "comment.updated", entityId: comment.id },
      tx,
    );
    return result;
  });

  return getCommentById(updated.id);
}

export interface DeleteCommentInput {
  commentId: string;
  actor: SessionUser;
}

export async function deleteComment(input: DeleteCommentInput) {
  const comment = await db.comment.findUniqueOrThrow({ where: { id: input.commentId } });
  const isAuthor = comment.authorId === input.actor.id;
  const isAdmin = input.actor.role === "ADMIN";
  if (!isAuthor && !isAdmin) {
    throw new Error("Not authorized to delete this comment");
  }

  const projectId = await projectIdForComment(comment.taskId, comment.fileId);

  await db.$transaction(async (tx) => {
    await tx.comment.update({ where: { id: input.commentId }, data: { deletedAt: new Date() } });
    await logActivity(
      { projectId, actorId: input.actor.id, action: "comment.deleted", entityId: comment.id },
      tx,
    );
  });
}

async function projectIdForComment(taskId: string | null, fileId: string | null): Promise<string> {
  if (taskId) {
    const task = await db.task.findUniqueOrThrow({ where: { id: taskId }, select: { phase: { select: { projectId: true } } } });
    return task.phase.projectId;
  }
  if (fileId) {
    const file = await db.file.findUniqueOrThrow({ where: { id: fileId }, select: { projectId: true } });
    return file.projectId;
  }
  throw new Error("Comment has neither taskId nor fileId");
}

/** Non-deleted comment count for a subject (used by task cards / file rows per spec/04-features.md §7 AC). */
export async function getCommentCount(subject: CommentSubject): Promise<number> {
  return db.comment.count({
    where: {
      deletedAt: null,
      ...(subject.kind === "task" ? { taskId: subject.id } : { fileId: subject.id }),
    },
  });
}
