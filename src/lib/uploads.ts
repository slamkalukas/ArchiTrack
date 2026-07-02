import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, rm, stat } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import path from "node:path";
import sharp from "sharp";
import type { FileVersion } from "@prisma/client";
import { db } from "@/lib/db";
import { checkAllowlist, isThumbnailable, maxUploadBytes } from "@/features/files/server/allowlist";

/**
 * Upload service (spec/07-agent-workplan.md WP-1 stub → WP-5 real implementation).
 * WP-6 (chat attachments) depends on the exact `saveUpload(projectId, folderKey, file)`
 * signature below — kept unchanged from the stub. This file adds:
 *   - extension + MIME allowlist enforcement (spec/02-architecture.md §4.6)
 *   - size limit from `MAX_UPLOAD_MB` (spec/02-architecture.md §3, §4.6)
 *   - true streaming-to-disk for the multipart upload route (`saveUploadStream`), which
 *     rejects as soon as more than the limit has been written — no whole-file buffering
 *     (spec/05-api.md §9.2)
 *   - versioning: same name in the same folder ⇒ new FileVersion (server-assigned
 *     `max(version)+1` in a transaction, per spec/03-data-model.md §3.4)
 *   - sharp thumbnails for images at upload time, stored as `<uuid>.thumb.webp`
 *     beside the original (spec/02-architecture.md §8)
 *
 * Storage layout: `${UPLOADS_DIR}/<projectId>/<storageKey>` where `storageKey` is a
 * fresh UUID (stored filenames are UUIDs, never the original name — spec/02-architecture.md §4.2).
 */

export class UploadRejectedError extends Error {
  code: "too_large" | "not_allowed";
  constructor(code: "too_large" | "not_allowed", message: string) {
    super(message);
    this.name = "UploadRejectedError";
    this.code = code;
  }
}

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
  /** Full file contents. For true streaming from an HTTP request, use `saveUploadStream` instead. */
  buffer: Buffer;
  uploadedBy: string;
}

export interface UploadService {
  saveUpload(input: SaveUploadInput): Promise<FileVersion>;
}

export function uploadsRoot(): string {
  return process.env.UPLOADS_DIR ?? "./data/uploads";
}

export function storagePathFor(projectId: string, storageKey: string): string {
  return path.join(uploadsRoot(), projectId, storageKey);
}

export function thumbnailPathFor(projectId: string, storageKey: string): string {
  return path.join(uploadsRoot(), projectId, `${storageKey}.thumb.webp`);
}

export async function resolveFolderId(projectId: string, folderKey: string): Promise<string | null> {
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

/** Generates a `<uuid>.thumb.webp` beside the original for thumbnailable images. Best-effort — never throws. */
async function generateThumbnail(sourcePath: string, projectId: string, storageKey: string): Promise<void> {
  try {
    await sharp(sourcePath)
      .resize(480, 480, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(thumbnailPathFor(projectId, storageKey));
  } catch (error) {
    console.error("[uploads] thumbnail generation failed", error);
  }
}

/**
 * Creates the FileVersion row (and the parent File row if this is a new name), assigning
 * `version = max(existing)+1` inside a transaction (spec/03-data-model.md §3.4).
 */
async function recordFileVersion(input: {
  projectId: string;
  folderId: string | null;
  fileName: string;
  storageKey: string;
  size: number;
  mimeType: string;
  uploadedBy: string;
}): Promise<FileVersion> {
  return db.$transaction(async (tx) => {
    const existing = await tx.file.findFirst({
      where: { projectId: input.projectId, folderId: input.folderId, name: input.fileName },
      include: { versions: { orderBy: { version: "desc" }, take: 1 } },
    });

    const file =
      existing ??
      (await tx.file.create({
        data: {
          projectId: input.projectId,
          folderId: input.folderId,
          name: input.fileName,
        },
      }));

    const nextVersion = (existing?.versions[0]?.version ?? 0) + 1;

    return tx.fileVersion.create({
      data: {
        fileId: file.id,
        version: nextVersion,
        storageKey: input.storageKey,
        size: input.size,
        mimeType: input.mimeType,
        uploadedBy: input.uploadedBy,
      },
    });
  });
}

class FilesystemUploadService implements UploadService {
  async saveUpload(input: SaveUploadInput): Promise<FileVersion> {
    const allowlist = checkAllowlist(input.fileName, input.mimeType);
    if (!allowlist.ok) {
      throw new UploadRejectedError("not_allowed", allowlist.reason ?? "File type not allowed");
    }
    if (input.buffer.byteLength > maxUploadBytes()) {
      throw new UploadRejectedError("too_large", "File exceeds the maximum upload size");
    }

    const folderId = await resolveFolderId(input.projectId, input.folderKey);
    const storageKey = randomUUID();
    const dir = path.join(uploadsRoot(), input.projectId);
    await mkdir(dir, { recursive: true });
    const destPath = path.join(dir, storageKey);
    await pipeline(Readable.from(input.buffer), createWriteStream(destPath));

    if (isThumbnailable(input.mimeType)) {
      await generateThumbnail(destPath, input.projectId, storageKey);
    }

    return recordFileVersion({
      projectId: input.projectId,
      folderId,
      fileName: input.fileName,
      storageKey,
      size: input.buffer.byteLength,
      mimeType: input.mimeType,
      uploadedBy: input.uploadedBy,
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

/**
 * True streaming variant used by the multipart upload route handler
 * (`POST /api/projects/:id/files`, spec/05-api.md §9.2): writes the incoming
 * `ReadableStream` to disk chunk-by-chunk, aborting (and cleaning up the partial file)
 * the moment more than `MAX_UPLOAD_MB` has been written — the file is never buffered
 * whole in memory.
 */
export async function saveUploadStream(input: {
  projectId: string;
  folderKey: string;
  fileName: string;
  mimeType: string;
  stream: ReadableStream<Uint8Array>;
  uploadedBy: string;
}): Promise<FileVersion> {
  const allowlist = checkAllowlist(input.fileName, input.mimeType);
  if (!allowlist.ok) {
    throw new UploadRejectedError("not_allowed", allowlist.reason ?? "File type not allowed");
  }

  const folderId = await resolveFolderId(input.projectId, input.folderKey);
  const storageKey = randomUUID();
  const dir = path.join(uploadsRoot(), input.projectId);
  await mkdir(dir, { recursive: true });
  const destPath = path.join(dir, storageKey);

  const limit = maxUploadBytes();
  let written = 0;
  const nodeReadable = Readable.fromWeb(input.stream as import("node:stream/web").ReadableStream<Uint8Array>);
  const writeStream = createWriteStream(destPath);

  try {
    await pipeline(
      nodeReadable,
      async function* limitGuard(source: AsyncIterable<Uint8Array>) {
        for await (const chunk of source) {
          written += chunk.byteLength;
          if (written > limit) {
            throw new UploadRejectedError("too_large", "File exceeds the maximum upload size");
          }
          yield chunk;
        }
      },
      writeStream,
    );
  } catch (error) {
    await rm(destPath, { force: true }).catch(() => undefined);
    if (error instanceof UploadRejectedError) throw error;
    throw error;
  }

  if (isThumbnailable(input.mimeType)) {
    await generateThumbnail(destPath, input.projectId, storageKey);
  }

  const { size } = await stat(destPath);

  return recordFileVersion({
    projectId: input.projectId,
    folderId,
    fileName: input.fileName,
    storageKey,
    size,
    mimeType: input.mimeType,
    uploadedBy: input.uploadedBy,
  });
}

/** Deletes the on-disk original + thumbnail (if any) for a storage key. Best-effort. */
export async function deleteStoredFile(projectId: string, storageKey: string): Promise<void> {
  await Promise.all([
    rm(storagePathFor(projectId, storageKey), { force: true }),
    rm(thumbnailPathFor(projectId, storageKey), { force: true }),
  ]);
}

/** Renames/moves nothing on disk — storage keys never change; helper kept for symmetry/tests. */
export async function fileExistsOnDisk(projectId: string, storageKey: string): Promise<boolean> {
  try {
    await stat(storagePathFor(projectId, storageKey));
    return true;
  } catch {
    return false;
  }
}
