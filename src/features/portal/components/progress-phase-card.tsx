import { getTranslations } from "next-intl/server";
import { Check, Circle, Dot } from "lucide-react";
import { Badge, type badgeVariants } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { VariantProps } from "class-variance-authority";
import type { PortalPhase } from "@/features/portal/types";

const STATUS_VARIANT: Record<PortalPhase["status"], VariantProps<typeof badgeVariants>["variant"]> = {
  UPCOMING: "todo",
  ACTIVE: "in-progress",
  DONE: "done",
  SKIPPED: "outline",
};

interface ProgressPhaseCardProps {
  phase: PortalPhase;
}

/**
 * Postup phase card (spec/06-ui-ux.md §3.7): vertical list, no kanban — each phase a
 * card with progress bar and its visible tasks as a checklist (✓ done, ● in progress,
 * ○ todo), due dates only where set, milestones highlighted.
 */
export async function ProgressPhaseCard({ phase }: ProgressPhaseCardProps) {
  const t = await getTranslations("portal.progress");

  const statusLabel = t(`phaseStatus.${phase.status.toLowerCase()}` as never);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-4">
        <span className="font-serif text-xl text-muted-foreground tabular-nums">
          {String(phase.order).padStart(2, "0")}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-serif text-base text-foreground">{phase.name}</h3>
            <Badge variant={STATUS_VARIANT[phase.status]}>{statusLabel}</Badge>
          </div>
          {phase.description && <p className="mt-1 text-sm text-muted-foreground">{phase.description}</p>}
        </div>
      </div>

      <div className="px-5 py-4">
        <div className="mb-4 flex items-center gap-2">
          <Progress value={phase.progress} className="max-w-xs" />
          <span className="text-xs tabular-nums text-muted-foreground">{phase.progress}%</span>
        </div>

        {phase.tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noVisibleTasks")}</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {phase.tasks.map((task) => (
              <li key={task.id} className="flex items-start gap-2.5 text-sm">
                <span className="mt-0.5 shrink-0 text-muted-foreground">
                  {task.status === "DONE" ? (
                    <Check className="size-4 text-primary" />
                  ) : task.status === "IN_PROGRESS" ? (
                    <Dot className="size-4 text-status-in-progress" strokeWidth={4} />
                  ) : (
                    <Circle className="size-3.5" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "text-foreground",
                      task.status === "DONE" && "text-muted-foreground line-through decoration-muted-foreground/50",
                    )}
                  >
                    {task.title}
                    {task.milestone && (
                      <span className="ml-1.5 text-primary" aria-label={t("milestone")}>
                        ◆
                      </span>
                    )}
                  </span>
                  {task.description && (
                    <span className="block text-xs text-muted-foreground">{task.description}</span>
                  )}
                </span>
                {task.dueDate && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {new Date(task.dueDate).toLocaleDateString()}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
