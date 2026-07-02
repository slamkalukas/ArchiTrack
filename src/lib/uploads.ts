import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FileVersion } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * Upload service interface (spec/07-agent-workplan.md WP-1 deliverable #5).
 * WP-5 (files feature) and WP-6 (chat attachments) both depend on this contract so they
 * can be built in parallel against a stable stub. WP-5 owns the real streaming
 * implementation (progress bars, MIME/extension allowlist enforcement, thumbnailing);
 * this is a minimal, functionally-correct version so integration isn't blocked.
 *
 * Storage layout: `${UPLOADS_DIR}/<projectId>/<storageKey>` where `storageKey` is a
 * fresh UUID (spec/02-architecture.md §4.2 — stored filenames are UUIDs, never the
 * original name, so files are never guessable/publicly addressable).
 */

export interface SaveUploadInput {
  projectId: string;
  /**
   * Logical destination: either a real Folder id, or a well-known system key such as
   * `"from_client"` / `"chat"` that callers resolve to a Folder before/at write time.
   * Kept as a string (not a strict union) so WP-5/WP-6 can pass either without this
   * stub needing to know every folder-resolution rule.
   */
  folderKey: string;
  fileName: string;
  mimeType: string;
  /** Full file contents. Streaming to disk without buffering the whole file is WP-5's job. */
  buffer: Buffer;
  uploadedBy: string;
}

export interface UploadService {
  saveUpload(input: SaveUploadInput): Promise<FileVersion>;
}

function uploadsRoot(): string {
  return process.env.UPLOADS_DIR ?? "./data/uploads";
}

async function resolveFolderId(projectId: string, folderKey: string): Promise<string | null> {
  // A real Folder id (uuid) was passed directly.
  const byId = await db.folder.findFirst({
    where: { id: folderKey, projectId },
    select: { id: true },
  });
  if (byId) return byId.id;

  // Otherwise treat folderKey as a systemKey (e.g. "from_client", "chat") and look it up,
  // falling back to null (root) if no matching folder exists yet.
  const bySystemKey = await db.folder.findFirst({
    where: { projectId, systemKey: folderKey },
    select: { id: true },
  });
  return bySystemKey?.id ?? null;
}

class FilesystemUploadService implements UploadService {
  async saveUpload(input: SaveUploadInput): Promise<FileVersion> {
    const folderId = await resolveFolderId(input.projectId, input.folderKey);
    const storageKey = randomUUID();
    const dir = path.join(uploadsRoot(), input.projectId);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, storageKey), input.buffer);

    return db.$transaction(async (tx) => {
      const existing = await tx.file.findFirst({
        where: { projectId: input.projectId, folderId, name: input.fileName },
        include: { versions: { orderBy: { version: "desc" }, take: 1 } },
      });

      const file =
        existing ??
        (await tx.file.create({
          data: {
            projectId: input.projectId,
            folderId,
            name: input.fileName,
          },
        }));

      const nextVersion = (existing?.versions[0]?.version ?? 0) + 1;

      return tx.fileVersion.create({
        data: {
          fileId: file.id,
          version: nextVersion,
          storageKey,
          size: input.buffer.byteLength,
          mimeType: input.mimeType,
          uploadedBy: input.uploadedBy,
        },
      });
    });
  }
}

const globalForUploads = globalThis as unknown as { uploadService: UploadService | undefined };

export const uploadService: UploadService = globalForUploads.uploadService ?? new FilesystemUploadService();

if (process.env.NODE_ENV !== "production") {
  globalForUploads.uploadService = uploadService;
}

/** Convenience free function matching the exact signature named in spec/07-agent-workplan.md. */
export function saveUpload(
  projectId: string,
  folderKey: string,
  file: { name: string; type: string; buffer: Buffer; uploadedBy: string },
): Promise<FileVersion> {
  return uploadService.saveUpload({
    projectId,
    folderKey,
    fileName: file.name,
    mimeType: file.type,
    buffer: file.buffer,
    uploadedBy: file.uploadedBy,
  });
}
