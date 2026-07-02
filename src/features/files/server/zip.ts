import "server-only";
import { createReadStream } from "node:fs";
import { ZipArchive } from "archiver";
import type { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { storagePathFor } from "@/lib/uploads";
import { visibleFolderIdSet } from "@/features/files/server/visibility";

interface ZipEntry {
  /** Path inside the zip, mirroring the folder tree (e.g. "Profesie/Statika/vykres.pdf"). */
  zipPath: string;
  diskPath: string;
}

/**
 * Builds the flat list of (zipPath, diskPath) pairs for a project's ZIP export, applying
 * the same visibility rules as everywhere else (spec/04-features.md §5 AC: "a client can
 * never see an INTERNAL file even via ... ZIP export"). ADMIN gets everything.
 */
async function collectZipEntries(projectId: string, role: Role): Promise<ZipEntry[]> {
  const [folders, files] = await Promise.all([
    db.folder.findMany({
      where: { projectId },
      select: { id: true, name: true, parentId: true },
    }),
    db.file.findMany({
      where: {
        projectId,
        deletedAt: null,
        ...(role === "CLIENT" ? { visibility: "CLIENT_VISIBLE" as const } : {}),
      },
      select: {
        id: true,
        name: true,
        folderId: true,
        visibility: true,
        versions: { orderBy: { version: "desc" }, take: 1 },
      },
    }),
  ]);

  const folderById = new Map(folders.map((f) => [f.id, f]));
  const allowedFolderIds = role === "ADMIN" ? null : await visibleFolderIdSet(projectId);

  function folderPath(folderId: string | null): string {
    const parts: string[] = [];
    let current = folderId ? folderById.get(folderId) : undefined;
    while (current) {
      parts.unshift(sanitizeSegment(current.name));
      current = current.parentId ? folderById.get(current.parentId) : undefined;
    }
    return parts.join("/");
  }

  const entries: ZipEntry[] = [];
  const usedPaths = new Set<string>();

  for (const file of files) {
    if (file.folderId) {
      if (allowedFolderIds && !allowedFolderIds.has(file.folderId)) continue;
    }
    const version = file.versions[0];
    if (!version) continue;

    const dir = folderPath(file.folderId);
    let zipPath = dir ? `${dir}/${sanitizeSegment(file.name)}` : sanitizeSegment(file.name);
    // De-duplicate in the unlikely event two visible files resolve to the same zip path.
    let suffix = 1;
    const original = zipPath;
    while (usedPaths.has(zipPath)) {
      const dot = original.lastIndexOf(".");
      zipPath = dot === -1 ? `${original} (${suffix})` : `${original.slice(0, dot)} (${suffix})${original.slice(dot)}`;
      suffix += 1;
    }
    usedPaths.add(zipPath);

    entries.push({ zipPath, diskPath: storagePathFor(projectId, version.storageKey) });
  }

  return entries;
}

function sanitizeSegment(name: string): string {
  // Strip path separators and control characters so nothing can escape the zip tree.
  let out = "";
  for (const ch of name) {
    const code = ch.codePointAt(0) ?? 0;
    if (ch === "\\" || ch === "/" || code < 0x20) continue;
    out += ch;
  }
  out = out.trim();
  return out || "untitled";
}

/**
 * Streams a ZIP of all (visibility-filtered) files in a project. Uses `archiver` so the
 * archive is built and sent incrementally — no need to materialize the whole ZIP or all
 * source files in memory at once (spec/04-features.md §5 AC: "ZIP of 1 GB project streams
 * without OOM").
 */
export async function streamProjectZip(projectId: string, role: Role): Promise<NodeJS.ReadableStream> {
  const entries = await collectZipEntries(projectId, role);

  const archive = new ZipArchive({ zlib: { level: 6 } });
  archive.on("warning", (err: Error) => console.warn("[zip] warning", err));
  archive.on("error", (err: Error) => console.error("[zip] error", err));

  for (const entry of entries) {
    archive.append(createReadStream(entry.diskPath), { name: entry.zipPath });
  }
  void archive.finalize();

  return archive;
}
