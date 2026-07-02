"use client";

import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface PreviewDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: React.ReactNode;
  commentThread?: React.ReactNode;
  className?: string;
}

/** Right-side drawer for file preview (PDF viewer / image lightbox) with a comment thread underneath. */
export function PreviewDrawer({
  open,
  onClose,
  title,
  children,
  commentThread,
  className,
}: PreviewDrawerProps) {
  const t = useTranslations("common");

  return (
    <div
      className={cn(
        "fixed inset-0 z-40 transition-opacity duration-200",
        open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
      )}
      aria-hidden={!open}
    >
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <aside
        role="dialog"
        aria-label={title}
        className={cn(
          "absolute top-0 right-0 flex h-full w-full max-w-md flex-col border-l border-border bg-card shadow-lg transition-transform duration-200 ease-out",
          open ? "translate-x-0" : "translate-x-full",
          className,
        )}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="truncate font-serif text-lg text-foreground">{title}</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label={t("close")}>
            <X className="size-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {commentThread && <div className="border-t border-border p-5">{commentThread}</div>}
      </aside>
    </div>
  );
}
