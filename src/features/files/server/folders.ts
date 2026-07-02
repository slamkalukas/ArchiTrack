import "server-only";
import type { Role, Visibility } from "@prisma/client";
import { db } from "@/lib/db";
import { AuthzError } from "@/lib/authz";
import { visibleFolderIdSet } from "@/features/files/server/visibility";

export interface FolderTreeFile {
  id: string;
  name: string;
  visibility: Visibility;
  validUntil: string | null;
  createdAt: string;
  latestVersion: { version: number; size: number; mimeType: string; createdAt: string } | null;
  commentCount: number;
}

export interface FolderTreeNode {
  id: string;
  name: string;
  parentId: string | null;
  order: number;
  systemKey: string | null;
  visibility: Visibility;
  children: FolderTreeNode[];
  files: FolderTreeFile[];
}

/**
 * Loads the full folder tree + files for a project, role-shaped:
 *  - ADMIN sees everything.
 *  - CLIENT sees only folders whose full ancestor chain is CLIENT_VISIBLE, and within
 *    those, only CLIENT_VISIBLE files (spec/03-data-model.md §3.2, spec/05-api.md §9.3).
 *
 * `focusFolderId` supports the API's `?folderId=` lazy-loading param by pruning the tree
 * to that folder's own subtree (still root-anchored so breadcrumbs/siblings are cheap to
 * derive) — for v1 scale (spec/02-architecture.md §8 budgets) loading the whole tree in
 * one query is simpler and still fast, so we always compute it and let the caller slice.
 */
export async function loadFolderTree(
  projectId: string,
  role: Role,
): Promise<FolderTreeNode[]> {
  const [folders, files] = await Promise.all([
    db.folder.findMany({
      where: { projectId },
      orderBy: [{ order: "asc" }, { name: "asc" }],
      select: { id: true, name: true, parentId: true, order: true, systemKey: true, visibility: true },
    }),
    db.file.findMany({
      where: { projectId, deletedAt: null },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        folderId: true,
        visibility: true,
        validUntil: true,
        createdAt: true,
        versions: { orderBy: { version: "desc" }, take: 1 },
        _count: { select: { comments: true } },
      },
    }),
  ]);

  const allowedFolderIds = role === "ADMIN" ? null : await visibleFolderIdSet(projectId);

  const nodesById = new Map<string, FolderTreeNode>();
  for (const folder of folders) {
    if (allowedFolderIds && !allowedFolderIds.has(folder.id)) continue;
    nodesById.set(folder.id, {
      id: folder.id,
      name: folder.name,
      parentId: folder.parentId,
      order: folder.order,
      systemKey: folder.systemKey,
      visibility: folder.visibility,
      children: [],
      files: [],
    });
  }

  for (const file of files) {
    if (role === "CLIENT" && file.visibility !== "CLIENT_VISIBLE") continue;
    // Root-level files (folderId null) are visible to CLIENT by their own flag only.
    if (file.folderId) {
      if (allowedFolderIds && !allowedFolderIds.has(file.folderId)) continue;
    }

    const entry: FolderTreeFile = {
      id: file.id,
      name: file.name,
      visibility: file.visibility,
      validUntil: file.validUntil?.toISOString() ?? null,
      createdAt: file.createdAt.toISOString(),
      latestVersion: file.versions[0]
        ? {
            version: file.versions[0].version,
            size: file.versions[0].size,
            mimeType: file.versions[0].mimeType,
            createdAt: file.versions[0].createdAt.toISOString(),
          }
        : null,
      commentCount: file._count.comments,
    };

    if (file.folderId && nodesById.has(file.folderId)) {
      nodesById.get(file.folderId)!.files.push(entry);
    } else if (!file.folderId) {
      // Root files are collected separately by the caller via `rootFiles` below.
    }
  }

  const roots: FolderTreeNode[] = [];
  for (const node of nodesById.values()) {
    if (node.parentId && nodesById.has(node.parentId)) {
      nodesById.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

/** Root-level files (no folder) — surfaced by the API alongside the tree. */
export async function loadRootFiles(projectId: string, role: Role): Promise<FolderTreeFile[]> {
  const files = await db.file.findMany({
    where: {
      projectId,
      folderId: null,
      deletedAt: null,
      ...(role === "CLIENT" ? { visibility: "CLIENT_VISIBLE" as Visibility } : {}),
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      visibility: true,
      validUntil: true,
      createdAt: true,
      versions: { orderBy: { version: "desc" }, take: 1 },
      _count: { select: { comments: true } },
    },
  });

  return files.map((file) => ({
    id: file.id,
    name: file.name,
    visibility: file.visibility,
    validUntil: file.validUntil?.toISOString() ?? null,
    createdAt: file.createdAt.toISOString(),
    latestVersion: file.versions[0]
      ? {
          version: file.versions[0].version,
          size: file.versions[0].size,
          mimeType: file.versions[0].mimeType,
          createdAt: file.versions[0].createdAt.toISOString(),
        }
      : null,
    commentCount: file._count.comments,
  }));
}

/** Creates a folder. Enforces the `@@unique([projectId, parentId, name])` constraint with a friendly error. */
export async function createFolder(input: {
  projectId: string;
  name: string;
  parentId: string | null;
  visibility?: Visibility;
}) {
  if (input.parentId) {
    const parent = await db.folder.findFirst({
      where: { id: input.parentId, projectId: input.projectId },
      select: { id: true },
    });
    if (!parent) {
      throw new AuthzError(404, "Not found");
    }
  }

  const existing = await db.folder.findFirst({
    where: { projectId: input.projectId, parentId: input.parentId, name: input.name },
    select: { id: true },
  });
  if (existing) {
    const err = new Error("A folder with this name already exists here");
    err.name = "DuplicateFolderError";
    throw err;
  }

  const maxOrder = await db.folder.aggregate({
    where: { projectId: input.projectId, parentId: input.parentId },
    _max: { order: true },
  });

  return db.folder.create({
    data: {
      projectId: input.projectId,
      name: input.name,
      parentId: input.parentId,
      visibility: input.visibility ?? "INTERNAL",
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });
}

/** Deletes a folder only when empty (no sub-folders, no files) — spec/05-api.md §4. */
export async function deleteFolderIfEmpty(folderId: string, projectId: string): Promise<void> {
  const folder = await db.folder.findFirst({
    where: { id: folderId, projectId },
    select: {
      id: true,
      systemKey: true,
      _count: { select: { children: true, files: true } },
    },
  });
  if (!folder) throw new AuthzError(404, "Not found");
  if (folder.systemKey) {
    const err = new Error("System folders cannot be deleted");
    err.name = "SystemFolderError";
    throw err;
  }
  if (folder._count.children > 0 || folder._count.files > 0) {
    const err = new Error("Folder is not empty");
    err.name = "FolderNotEmptyError";
    throw err;
  }
  await db.folder.delete({ where: { id: folderId } });
}
