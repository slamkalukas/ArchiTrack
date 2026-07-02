"use client";

import { useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CoverImagePickerProps {
  value?: string | null;
  onChange?: (file: File | null, previewUrl: string | null) => void;
  className?: string;
}

/** Cover image upload/preview control used on project creation & settings. */
export function CoverImagePicker({ value, onChange, className }: CoverImagePickerProps) {
  const t = useTranslations("ui.coverImagePicker");
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(value ?? null);

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    onChange?.(file, url);
  }

  function clear() {
    setPreview(null);
    onChange?.(null, null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div
        className="group relative flex h-40 w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-secondary/50 transition-colors hover:border-primary/50"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFiles(e.dataTransfer.files);
        }}
      >
        {preview ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="" className="h-full w-full object-cover" />
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="absolute top-2 right-2"
              onClick={clear}
              aria-label={t("remove")}
            >
              <X className="size-4" />
            </Button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex flex-col items-center gap-2 px-6 py-8 text-center text-muted-foreground"
          >
            <ImagePlus className="size-6 stroke-[1.25]" />
            <span className="text-sm">{t("prompt")}</span>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
