"use client";

import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Visibility } from "@/components/shared/types";

interface VisibilityToggleProps {
  visibility: Visibility;
  onToggle?: (next: Visibility) => void;
  /** Show label text next to the icon (default: icon only, per kanban card spec). */
  showLabel?: boolean;
  className?: string;
  disabled?: boolean;
}

/**
 * Eye icon toggle — publish/unpublish a task or file to the client.
 * spec/06-ui-ux.md §4.2: one click to publish, always explicit.
 */
export function VisibilityToggle({
  visibility,
  onToggle,
  showLabel = false,
  className,
  disabled,
}: VisibilityToggleProps) {
  const t = useTranslations("ui.visibility");
  const isVisible = visibility === "CLIENT_VISIBLE";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size={showLabel ? "sm" : "icon"}
          disabled={disabled}
          aria-pressed={isVisible}
          aria-label={isVisible ? t("clientVisible") : t("internal")}
          onClick={() => onToggle?.(isVisible ? "INTERNAL" : "CLIENT_VISIBLE")}
          className={cn(
            "text-muted-foreground transition-colors duration-150",
            isVisible && "text-primary",
            className,
          )}
        >
          {isVisible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
          {showLabel && <span>{isVisible ? t("clientVisible") : t("internal")}</span>}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{isVisible ? t("clientVisibleHint") : t("internalHint")}</TooltipContent>
    </Tooltip>
  );
}
