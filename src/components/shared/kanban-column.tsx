import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { TaskCard } from "@/components/shared/task-card";
import type { TaskStatus, TaskSummary } from "@/components/shared/types";

interface KanbanColumnProps {
  status: TaskStatus;
  tasks: TaskSummary[];
  onToggleVisibility?: (taskId: string, next: TaskSummary["visibility"]) => void;
  className?: string;
}

const STATUS_DOT: Record<TaskStatus, string> = {
  TODO: "bg-status-todo",
  IN_PROGRESS: "bg-status-in-progress",
  DONE: "bg-status-done",
};

/** One column of the three-column kanban (To-do / In progress / Done). Keyboard-reorderable
 * drag is wired by WP-4 (dnd-kit); this component renders the static column shell + cards. */
export function KanbanColumn({ status, tasks, onToggleVisibility, className }: KanbanColumnProps) {
  const t = useTranslations("ui.kanban");
  const label = t(status === "TODO" ? "todo" : status === "IN_PROGRESS" ? "inProgress" : "done");

  return (
    <div className={cn("flex min-w-[260px] flex-1 flex-col gap-3", className)}>
      <div className="flex items-center gap-2 px-1">
        <span className={cn("size-2 rounded-full", STATUS_DOT[status])} />
        <h3 className="text-sm font-medium text-foreground">{label}</h3>
        <span className="text-xs text-muted-foreground">{tasks.length}</span>
      </div>
      <div
        role="list"
        aria-label={label}
        className="flex min-h-24 flex-col gap-2 rounded-xl bg-secondary/40 p-2"
      >
        {tasks.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">{t("empty")}</p>
        ) : (
          tasks.map((task) => (
            <div role="listitem" key={task.id}>
              <TaskCard
                task={task}
                onToggleVisibility={(next) => onToggleVisibility?.(task.id, next)}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
