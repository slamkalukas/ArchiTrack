import { cn } from "@/lib/utils";
import type { MilestoneItem } from "@/components/shared/types";

interface MilestoneTimelineProps {
  milestones: MilestoneItem[];
  className?: string;
}

/** Horizontal milestone timeline: done ◆ filled, upcoming ◆ outlined, with dates. */
export function MilestoneTimeline({ milestones, className }: MilestoneTimelineProps) {
  return (
    <ol className={cn("flex w-full items-start overflow-x-auto py-2", className)}>
      {milestones.map((m, i) => (
        <li key={m.id} className="flex flex-1 flex-col items-center gap-2 px-1 text-center">
          <div className="flex w-full items-center">
            <span className={cn("h-px flex-1 bg-border", i === 0 && "invisible")} aria-hidden />
            <span
              className={cn(
                "flex size-5 shrink-0 items-center justify-center text-base leading-none",
                m.done ? "text-primary" : "text-muted-foreground",
              )}
              aria-hidden
            >
              {m.done ? "◆" : "◇"}
            </span>
            <span
              className={cn("h-px flex-1 bg-border", i === milestones.length - 1 && "invisible")}
              aria-hidden
            />
          </div>
          <div className="max-w-[9rem]">
            <p
              className={cn(
                "text-xs font-medium",
                m.done ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {m.label}
            </p>
            {m.date && <p className="text-[11px] text-muted-foreground">{m.date}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
