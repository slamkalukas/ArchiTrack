"use client";

import { useTranslations } from "next-intl";
import {
  FileText,
  Image as ImageIcon,
  File as FileIcon,
  MessageSquare,
  TriangleAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { VisibilityToggle } from "@/components/shared/visibility-toggle";
import { EmptyState } from "@/components/shared/empty-state";
import { isExpiringSoon } from "@/components/shared/date-helpers";
import type { FileEntry } from "@/components/shared/types";

interface FileTableProps {
  files: FileEntry[];
  onSelect?: (file: FileEntry) => void;
  onToggleVisibility?: (fileId: string, next: FileEntry["visibility"]) => void;
  className?: string;
}

const KIND_ICON: Record<FileEntry["kind"], typeof FileText> = {
  pdf: FileText,
  image: ImageIcon,
  doc: FileText,
  other: FileIcon,
};

/** Right pane of the Files view: name, version badge, size, date, visibility, expiry, comments. */
export function FileTable({ files, onSelect, onToggleVisibility, className }: FileTableProps) {
  const t = useTranslations("ui.fileTable");

  if (files.length === 0) {
    return (
      <EmptyState
        title={t("emptyTitle")}
        description={t("emptyDescription")}
        className={className}
      />
    );
  }

  return (
    <div className={cn("overflow-x-auto rounded-xl border border-border", className)}>
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="px-4 py-2 font-medium">{t("columns.name")}</th>
            <th className="px-4 py-2 font-medium">{t("columns.version")}</th>
            <th className="px-4 py-2 font-medium">{t("columns.size")}</th>
            <th className="px-4 py-2 font-medium">{t("columns.updated")}</th>
            <th className="px-4 py-2 font-medium">{t("columns.visibility")}</th>
            <th className="px-4 py-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          {files.map((file) => {
            const Icon = KIND_ICON[file.kind];
            const expiring = isExpiringSoon(file.validUntil);
            return (
              <tr
                key={file.id}
                className="cursor-pointer border-b border-border last:border-0 transition-colors duration-150 hover:bg-secondary/40"
                onClick={() => onSelect?.(file)}
              >
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <Icon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate font-medium text-foreground">{file.name}</span>
                    {expiring && (
                      <TriangleAlert
                        className="size-3.5 shrink-0 text-status-in-progress"
                        aria-label={t("expiringSoon")}
                      />
                    )}
                  </div>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">v{file.version}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{file.sizeLabel}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{file.updatedAt}</td>
                <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <VisibilityToggle
                    visibility={file.visibility}
                    onToggle={(next) => onToggleVisibility?.(file.id, next)}
                  />
                </td>
                <td className="px-4 py-2.5 text-right text-muted-foreground">
                  {!!file.commentCount && (
                    <span className="inline-flex items-center gap-1">
                      <MessageSquare className="size-3.5" />
                      {file.commentCount}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
