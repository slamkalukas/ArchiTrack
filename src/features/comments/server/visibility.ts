import "server-only";
import { db } from "@/lib/db";

/**
 * Comment-subject visibility resolution (spec/03-data-model.md §3.2, spec/04-features.md §7).
 * A CLIENT may only comment on/see comments for:
 *   - a Task whose `visibility = CLIENT_VISIBLE` AND whose Phase `visibility = CLIENT_VISIBLE`;
 *   - a File whose `visibility = CLIENT_VISIBLE` AND whose folder chain (walking `parentId`
 *     up to the root) contains no `INTERNAL` folder.
 * ADMIN always has full access. Deny-by-default: any missing entity or ambiguous state
 * resolves to "not visible" (spec/04-features.md §7 AC: "a client cannot comment on
 * internal entities even by ID probing").
 */

export interface CommentSubject {
  kind: "task" | "file";
  id: string;
  projectId: string;
}

/** Resolve the subject (task or file) and its project, or null if it doesn't exist. */
export async function resolveCommentSubject(
  kind: "task" | "file",
  id: string,
): Promise<CommentSubject | null> {
  if (kind === "task") {
    const task = await db.task.findUnique({
      where: { id },
      select: { id: true, deletedAt: true, phase: { select: { projectId: true } } },
    });
    if (!task || task.deletedAt) return null;
    return { kind: "task", id: task.id, projectId: task.phase.projectId };
  }

  const file = await db.file.findUnique({
    where: { id },
    select: { id: true, deletedAt: true, projectId: true },
  });
  if (!file || file.deletedAt) return null;
  return { kind: "file", id: file.id, projectId: file.projectId };
}

/** True if a CLIENT (not ADMIN) may see/comment on this task. */
export async function isTaskClientVisible(taskId: string): Promise<boolean> {
  const task = await db.task.findUnique({
    where: { id: taskId },
    select: { visibility: true, deletedAt: true, phase: { select: { visibility: true } } },
  });
  if (!task || task.deletedAt) return false;
  return task.visibility === "CLIENT_VISIBLE" && task.phase.visibility === "CLIENT_VISIBLE";
}

/** True if a CLIENT (not ADMIN) may see/comment on this file (visibility + folder chain). */
export async function isFileClientVisible(fileId: string): Promise<boolean> {
  const file = await db.file.findUnique({
    where: { id: fileId },
    select: { visibility: true, deletedAt: true, folderId: true },
  });
  if (!file || file.deletedAt) return false;
  if (file.visibility !== "CLIENT_VISIBLE") return false;

  let folderId = file.folderId;
  while (folderId) {
    const folder = await db.folder.findUnique({
      where: { id: folderId },
      select: { visibility: true, parentId: true },
    });
    if (!folder || folder.visibility === "INTERNAL") return false;
    folderId = folder.parentId;
  }
  return true;
}

/** Combined check used by every comments route handler before reading/writing. */
export async function assertClientCanAccessSubject(
  subject: CommentSubject,
  role: "ADMIN" | "CLIENT",
): Promise<boolean> {
  if (role === "ADMIN") return true;
  return subject.kind === "task" ? isTaskClientVisible(subject.id) : isFileClientVisible(subject.id);
}
