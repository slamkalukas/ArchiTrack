import "server-only";
import type { Visibility } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * Client-visibility chain (spec/03-data-model.md §3.2):
 * "Client-visible file = file.visibility = CLIENT_VISIBLE **and** its folder chain has
 * no INTERNAL folder." Root-level files (folderId = null) are visible purely by their
 * own flag. Deny-by-default: any error/ambiguity resolves to "not visible".
 */

/** Walks a folder's ancestor chain (inclusive) and returns true if every folder is CLIENT_VISIBLE. */
export async function isFolderChainVisible(folderId: string | null): Promise<boolean> {
  if (!folderId) return true;

  let currentId: string | null = folderId;
  // Bound the walk defensively — folder trees are shallow in practice (phase > profession).
  for (let i = 0; i < 64 && currentId; i++) {
    const folder: { visibility: Visibility; parentId: string | null } | null = await db.folder.findUnique({
      where: { id: currentId },
      select: { visibility: true, parentId: true },
    });
    if (!folder) return false;
    if (folder.visibility !== "CLIENT_VISIBLE") return false;
    currentId = folder.parentId;
  }
  return true;
}

/** True when a CLIENT may see this file (own visibility + full folder chain visible). */
export async function isFileVisibleToClient(file: {
  visibility: Visibility;
  folderId: string | null;
}): Promise<boolean> {
  if (file.visibility !== "CLIENT_VISIBLE") return false;
  return isFolderChainVisible(file.folderId);
}

/**
 * Batch variant: given a set of folder ids referenced by a page of files, returns the
 * subset of those folder ids whose entire ancestor chain is CLIENT_VISIBLE. Avoids N+1
 * round-trips when filtering a file list for a CLIENT (loads the whole project folder
 * tree once — folder counts are small, per spec/02-architecture.md §8 budgets).
 */
export async function visibleFolderIdSet(projectId: string): Promise<Set<string>> {
  const folders = await db.folder.findMany({
    where: { projectId },
    select: { id: true, parentId: true, visibility: true },
  });

  const byId = new Map(folders.map((f) => [f.id, f]));
  const cache = new Map<string, boolean>();

  function resolve(id: string, seen: Set<string> = new Set()): boolean {
    if (cache.has(id)) return cache.get(id)!;
    if (seen.has(id)) {
      // Defensive cycle guard — folder tree should never cycle, but never trust it blindly.
      cache.set(id, false);
      return false;
    }
    seen.add(id);

    const folder = byId.get(id);
    if (!folder || folder.visibility !== "CLIENT_VISIBLE") {
      cache.set(id, false);
      return false;
    }
    const parentOk = folder.parentId ? resolve(folder.parentId, seen) : true;
    cache.set(id, parentOk);
    return parentOk;
  }

  const visible = new Set<string>();
  for (const folder of folders) {
    if (resolve(folder.id)) visible.add(folder.id);
  }
  return visible;
}
