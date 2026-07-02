"use client";

import { useCallback, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface UploadProgressItem {
  fileName: string;
  status: "uploading" | "done" | "error";
  message?: string;
}

interface UploadDropzoneProps {
  onFiles: (files: File[]) => void;
  className?: string;
  disabled?: boolean;
}

/**
 * Drag-and-drop multi-file upload area (spec/04-features.md §5: "Upload: drag & drop
 * multi-file, progress bars"). Purely presentational — the parent (`FilesView`) owns the
 * actual upload requests and progress state so this stays reusable for the "From client"
 * upload area too.
 */
export function UploadDropzone({ onFiles, className, disabled }: UploadDropzoneProps) {
  const t = useTranslations("files.upload");
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragActive(false);
      if (disabled) return;
      const files = Array.from(event.dataTransfer.files);
      if (files.length > 0) onFiles(files);
    },
    [onFiles, disabled],
  );

  return (
    <div
      role="button"
      tabIndex={0}
      aria-disabled={disabled}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !disabled) inputRef.current?.click();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={handleDrop}
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors duration-150",
        dragActive ? "border-primary bg-[var(--accent-soft)]" : "border-border",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:border-primary/60",
        className,
      )}
    >
      <UploadCloud className="size-8 text-muted-foreground" strokeWidth={1.25} />
      <p className="text-sm font-medium text-foreground">{t("dropPrompt")}</p>
      <p className="text-xs text-muted-foreground">{t("dropHint")}</p>
      <Button type="button" variant="outline" size="sm" disabled={disabled} tabIndex={-1}>
        {t("browse")}
      </Button>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length > 0) onFiles(files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
