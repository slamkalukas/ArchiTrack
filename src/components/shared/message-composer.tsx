"use client";

import { useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Paperclip, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MessageComposerProps {
  onSend?: (body: string, files: File[]) => void;
  className?: string;
  disabled?: boolean;
}

/** Sticky-bottom composer with attachment support for ChatThread. */
export function MessageComposer({ onSend, className, disabled }: MessageComposerProps) {
  const t = useTranslations("ui.chat");
  const [value, setValue] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed && files.length === 0) return;
    onSend?.(trimmed, files);
    setValue("");
    setFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "sticky bottom-0 flex flex-col gap-2 border-t border-border bg-card p-3",
        className,
      )}
    >
      {files.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {files.map((f, i) => (
            <span
              key={i}
              className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-muted-foreground"
            >
              {f.name}
            </span>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          onClick={() => fileInputRef.current?.click()}
          aria-label={t("attach")}
        >
          <Paperclip className="size-4" />
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
        />
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
          placeholder={t("placeholder")}
          rows={1}
          disabled={disabled}
          className="max-h-32 flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button type="submit" size="icon" disabled={disabled} aria-label={t("send")}>
          <Send className="size-4" />
        </Button>
      </div>
    </form>
  );
}
