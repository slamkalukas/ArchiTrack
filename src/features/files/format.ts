import type { FileEntry } from "@/components/shared/types";

/** Maps a MIME type to the coarse "kind" used by the shared `FileTable`/icons. */
export function kindFromMime(mimeType: string | undefined | null): FileEntry["kind"] {
  const mime = (mimeType ?? "").toLowerCase();
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("image/")) return "image";
  if (
    mime.includes("word") ||
    mime.includes("excel") ||
    mime.includes("powerpoint") ||
    mime.includes("opendocument") ||
    mime === "text/plain" ||
    mime === "text/csv" ||
    mime === "application/rtf"
  ) {
    return "doc";
  }
  return "other";
}

/** Human-readable file size, e.g. "1.4 MB". */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}
