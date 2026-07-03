"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Badge, type badgeVariants } from "@/components/ui/badge";
import type { VariantProps } from "class-variance-authority";
import type { PhaseSummary, PhaseStatus } from "@/components/shared/types";

const STATUS_VARIANT: Record<PhaseStatus, VariantProps<typeof badgeVariants>["variant"]> = {
  UPCOMING: "todo",
  ACTIVE: "in-progress",
  DONE: "done",
  SKIPPED: "outline",
};

interface PhaseAccordionProps {
  phase: PhaseSummary;
  defaultOpen?: boolean;
  children?: React.ReactNode;
  className?: string;
}

/** Phase accordion header: order number in serif, name, status chip, progress bar, weight. */
export function PhaseAccordion({
  phase,
  defaultOpen = false,
  children,
  className,
}: PhaseAccordionProps) {
  const t = useTranslations("ui.phase");
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(defaultOpen);
  const statusLabel = t(
    phase.status === "UPCOMING"
      ? "upcoming"
      : phase.status === "ACTIVE"
        ? "active"
        : phase.status === "DONE"
          ? "done"
          : "skipped",
  );

  return (
    <div className={cn("overflow-hidden rounded-xl border border-border bg-card", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors duration-150 hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="font-serif text-xl text-muted-foreground tabular-nums">
          {String(phase.order).padStart(2, "0")}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-serif text-base text-foreground">{phase.name}</h3>
            <Badge variant={STATUS_VARIANT[phase.status]}>{statusLabel}</Badge>
            {typeof phase.weight === "number" && (
              <span className="text-xs text-muted-foreground">
                {t("weight", { weight: phase.weight })}
              </span>
            )}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Progress
              value={phase.progress}
              className="max-w-xs"
              aria-label={tCommon("progressLabel", { percent: phase.progress })}
            />
            <span className="text-xs tabular-nums text-muted-foreground">{phase.progress}%</span>
          </div>
        </div>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-150",
            open && "rotate-180",
          )}
        />
      </button>
      {open && <div className="border-t border-border px-5 py-4">{children}</div>}
    </div>
  );
}
