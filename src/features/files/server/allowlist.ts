/**
 * Upload hardening — extension + MIME allowlist (spec/02-architecture.md §4.6):
 * "pdf, dwg, dxf, ifc, images, office docs, zip". No execution of uploads.
 *
 * Kept as a pure, framework-free module so it's easy to unit test in isolation.
 */

export interface AllowlistEntry {
  extensions: string[];
  mimeTypes: string[];
}

const IMAGE: AllowlistEntry = {
  extensions: ["jpg", "jpeg", "png", "gif", "webp", "svg", "heic", "tif", "tiff"],
  mimeTypes: [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
    "image/heic",
    "image/tiff",
  ],
};

const OFFICE: AllowlistEntry = {
  extensions: ["doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "ods", "odp", "csv", "txt", "rtf"],
  mimeTypes: [
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.oasis.opendocument.text",
    "application/vnd.oasis.opendocument.spreadsheet",
    "application/vnd.oasis.opendocument.presentation",
    "text/csv",
    "text/plain",
    "application/rtf",
  ],
};

const CAD: AllowlistEntry = {
  extensions: ["dwg", "dxf", "ifc"],
  // These often arrive with a generic/octet-stream MIME type from the OS — extension is
  // authoritative for CAD formats since browsers rarely register a specific type for them.
  mimeTypes: ["application/octet-stream", "image/vnd.dwg", "application/dxf", "model/ifc"],
};

const DOCUMENT: AllowlistEntry = {
  extensions: ["pdf"],
  mimeTypes: ["application/pdf"],
};

const ARCHIVE: AllowlistEntry = {
  extensions: ["zip"],
  mimeTypes: ["application/zip", "application/x-zip-compressed"],
};

export const UPLOAD_ALLOWLIST: AllowlistEntry[] = [IMAGE, OFFICE, CAD, DOCUMENT, ARCHIVE];

const ALLOWED_EXTENSIONS = new Set(UPLOAD_ALLOWLIST.flatMap((e) => e.extensions));
const ALLOWED_MIME_TYPES = new Set(UPLOAD_ALLOWLIST.flatMap((e) => e.mimeTypes));

/** Extension-only MIME types that legitimately arrive as octet-stream (CAD formats). */
const EXTENSION_AUTHORITATIVE = new Set(CAD.extensions);

export function getExtension(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  if (dot === -1 || dot === fileName.length - 1) return "";
  return fileName.slice(dot + 1).toLowerCase();
}

export interface AllowlistCheckResult {
  ok: boolean;
  reason?: string;
}

/**
 * Validates a candidate upload against the allowlist. Extension is checked first (cheap,
 * always present); MIME is checked too unless the extension is one of the CAD formats
 * that legitimately show up as `application/octet-stream`.
 */
export function checkAllowlist(fileName: string, mimeType: string): AllowlistCheckResult {
  const ext = getExtension(fileName);
  if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
    return { ok: false, reason: `File extension ".${ext || "?"}" is not allowed` };
  }

  if (EXTENSION_AUTHORITATIVE.has(ext)) {
    return { ok: true };
  }

  const normalizedMime = mimeType.split(";")[0]!.trim().toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(normalizedMime)) {
    return { ok: false, reason: `File type "${mimeType}" is not allowed` };
  }

  return { ok: true };
}

/** Max upload size in bytes, derived from `MAX_UPLOAD_MB` (default 500). */
export function maxUploadBytes(): number {
  const mb = Number(process.env.MAX_UPLOAD_MB ?? "500");
  return (Number.isFinite(mb) && mb > 0 ? mb : 500) * 1024 * 1024;
}

/** Preview-inline types (spec/02-architecture.md §4.6): pdf and images render inline; everything else is an attachment. */
export function isPreviewable(mimeType: string): boolean {
  const normalized = mimeType.split(";")[0]!.trim().toLowerCase();
  return normalized === "application/pdf" || normalized.startsWith("image/");
}

/** True when sharp can thumbnail this MIME type (raster images only — not svg/heic). */
export function isThumbnailable(mimeType: string): boolean {
  const normalized = mimeType.split(";")[0]!.trim().toLowerCase();
  return ["image/jpeg", "image/png", "image/gif", "image/webp", "image/tiff"].includes(normalized);
}
