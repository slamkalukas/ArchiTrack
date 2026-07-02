import "server-only";
import type { Role, Visibility } from "@prisma/client";
import { db } from "@/lib/db";
import { AuthzError } from "@/lib/authz";
import { isFileVisibleToClient } from "@/features/files/server/visibility";
import { deleteStoredFile } from "@/lib/uploads";

export interface FileDetail {
  id: string;
  projectId: string;
  folderId: string | null;
  name: string;
  visibility: Visibility;
  validUntil: string | null;
  createdAt: string;
  versions: { id: string; version: number; size: number; mimeType: string; createdAt: string; uploadedBy: string }[];
  commentCount: number;
}

/**
 * Loads a file's metadata + versions, role-shaping the result: a CLIENT gets a 404
 * (never a 403 — spec/05-api.md "404 for exists but you may not know it exists") when the
 * file is not client-visible, even if their session is otherwise a valid project member.
 * This is the same check enforced again, independently, by the download route — see
 * spec/04-features.md §5 AC: "never see an INTERNAL file even via version history".
 */
export async function loadFileForRole(fileId: string, projectId: string, role: Role): Promise<FileDetail> {
  const file = await db.file.findFirst({
    where: { id: fileId, projectId, deletedAt: null },
    include: {
      versions: { orderBy: { version: "desc" } },
      _count: { select: { comments: true } },
    },
  });
  if (!file) throw new AuthzError(404, "Not found");

  if (role === "CLIENT") {
    const visible = await isFileVisibleToClient(file);
    if (!visible) throw new AuthzError(404, "Not found");
  }

  return {
    id: file.id,
    projectId: file.projectId,
    folderId: file.folderId,
    name: file.name,
    visibility: file.visibility,
    validUntil: file.validUntil?.toISOString() ?? null,
    createdAt: file.createdAt.toISOString(),
    versions: file.versions.map((v) => ({
      id: v.id,
      version: v.version,
      size: v.size,
      mimeType: v.mimeType,
      createdAt: v.createdAt.toISOString(),
      uploadedBy: v.uploadedBy,
    })),
    commentCount: file._count.comments,
  };
}

/**
 * Authorizes a download: loads the file + requested version, enforcing the same
 * visibility chain for CLIENT as everywhere else. Throws 404 on any denial.
 * `version` defaults to the latest.
 */
export async function authorizeDownload(
  fileId: string,
  projectId: string,
  role: Role,
  version?: number,
): Promise<{
  fileName: string;
  storageKey: string;
  mimeType: string;
  size: number;
  everClientVisible: boolean;
}> {
  const file = await db.file.findFirst({
    where: { id: fileId, projectId, deletedAt: null },
    include: {
      versions: version ? { where: { version } } : { orderBy: { version: "desc" }, take: 1 },
    },
  });
  if (!file) throw new AuthzError(404, "Not found");

  if (role === "CLIENT") {
    const visible = await isFileVisibleToClient(file);
    if (!visible) throw new AuthzError(404, "Not found");
  }

  const chosen = file.versions[0];
  if (!chosen) throw new AuthzError(404, "Not found");

  return {
    fileName: file.name,
    storageKey: chosen.storageKey,
    mimeType: chosen.mimeType,
    size: chosen.size,
    everClientVisible: file.visibility === "CLIENT_VISIBLE",
  };
}

export interface UpdateFileInput {
  name?: string;
  folderId?: string | null;
  visibility?: Visibility;
  validUntil?: string | null;
}

export async function updateFile(fileId: string, projectId: string, input: UpdateFileInput) {
  const file = await db.file.findFirst({ where: { id: fileId, projectId, deletedAt: null } });
  if (!file) throw new AuthzError(404, "Not found");

  if (input.folderId) {
    const folder = await db.folder.findFirst({ where: { id: input.folderId, projectId }, select: { id: true } });
    if (!folder) throw new AuthzError(404, "Not found");
  }

  const targetFolderId = input.folderId !== undefined ? input.folderId : file.folderId;
  const targetName = input.name ?? file.name;
  if (input.name !== undefined || input.folderId !== undefined) {
    const clash = await db.file.findFirst({
      where: {
        projectId,
        folderId: targetFolderId,
        name: targetName,
        deletedAt: null,
        NOT: { id: fileId },
      },
      select: { id: true },
    });
    if (clash) {
      const err = new Error("A file with this name already exists in the destination folder");
      err.name = "DuplicateFileError";
      throw err;
    }
  }

  return db.file.update({
    where: { id: fileId },
    data: {
      name: input.name,
      folderId: input.folderId,
      visibility: input.visibility,
      validUntil: input.validUntil === undefined ? undefined : input.validUntil ? new Date(input.validUntil) : null,
    },
  });
}

/**
 * Delete rules (spec/03-data-model.md §3.3, spec/04-features.md §5): soft delete if the
 * file was ever client-visible (a client may have already seen it — retain history,
 * just hide it), hard delete (including the on-disk originals) otherwise.
 */
export async function deleteFile(fileId: string, projectId: string): Promise<void> {
  const file = await db.file.findFirst({
    where: { id: fileId, projectId, deletedAt: null },
    include: { versions: true },
  });
  if (!file) throw new AuthzError(404, "Not found");

  if (file.visibility === "CLIENT_VISIBLE") {
    await db.file.update({ where: { id: fileId }, data: { deletedAt: new Date() } });
    return;
  }

  await db.$transaction([
    db.comment.deleteMany({ where: { fileId } }),
    db.fileVersion.deleteMany({ where: { fileId } }),
    db.file.delete({ where: { id: fileId } }),
  ]);

  await Promise.all(file.versions.map((v) => deleteStoredFile(projectId, v.storageKey)));
}
