"use client";

import { useTranslations } from "next-intl";
import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatFileSize } from "@/features/files/format";
import type { FileDetail } from "@/features/files/types";

interface FilePreviewProps {
  file: FileDetail;
}

/**
 * Inline preview body rendered inside `PreviewDrawer` (spec/06-ui-ux.md §3.4): PDF viewer
 * / image lightbox for previewable types, sandboxed via `sandbox` on the iframe; every
 * other type falls back to a download prompt (`Content-Disposition: attachment` is
 * enforced server-side regardless — spec/02-architecture.md §4.6).
 */
export function FilePreview({ file }: FilePreviewProps) {
  const t = useTranslations("files.preview");
  const latest = file.versions[0];
  if (!latest) return null;

  const downloadUrl = `/api/files/${file.id}/download`;
  const mime = latest.mimeType.toLowerCase();
  const isImage = mime.startsWith("image/");
  const isPdf = mime === "application/pdf";

  return (
    <div className="flex flex-col gap-4">
      {isImage && (
        // eslint-disable-next-line @next/next/no-img-element -- authorized, non-static source
        <img
          src={downloadUrl}
          alt={file.name}
          className="max-h-[60vh] w-full rounded-lg border border-border object-contain"
        />
      )}
      {isPdf && (
        <iframe
          src={downloadUrl}
          title={file.name}
          sandbox="allow-same-origin allow-scripts"
          className="h-[60vh] w-full rounded-lg border border-border"
        />
      )}
      {!isImage && !isPdf && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-6 py-10 text-center">
          <FileText className="size-8 text-muted-foreground" strokeWidth={1.25} />
          <p className="text-sm text-muted-foreground">{t("noPreview")}</p>
        </div>
      )}

      <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-sm">
        <div>
          <p className="font-medium text-foreground">
            v{latest.version} · {formatFileSize(latest.size)}
          </p>
          <p className="text-muted-foreground">{new Date(latest.createdAt).toLocaleString()}</p>
        </div>
        <Button asChild size="sm" variant="outline">
          <a href={downloadUrl} download>
            <Download className="size-4" />
            {t("download")}
          </a>
        </Button>
      </div>

      {file.versions.length > 1 && (
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">{t("previousVersions")}</p>
          <ul className="flex flex-col gap-1">
            {file.versions.slice(1).map((v) => (
              <li
                key={v.id}
                className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-secondary/50"
              >
                <span>
                  v{v.version} · {formatFileSize(v.size)} · {new Date(v.createdAt).toLocaleDateString()}
                </span>
                <a
                  href={`${downloadUrl}?version=${v.version}`}
                  download
                  className="text-primary hover:underline"
                >
                  {t("download")}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
