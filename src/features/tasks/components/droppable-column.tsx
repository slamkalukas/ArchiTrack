"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { SortableTaskCard } from "@/features/tasks/components/sortable-task-card";
import type { TaskStatus, TaskSummary } from "@/components/shared/types";

interface DroppableColumnProps {
  status: TaskStatus;
  tasks: TaskSummary[];
  onTaskClick: (taskId: string) => void;
  onToggleVisibility: (taskId: string, next: TaskSummary["visibility"]) => void;
}

const STATUS_DOT: Record<TaskStatus, string> = {
  TODO: "bg-status-todo",
  IN_PROGRESS: "bg-status-in-progress",
  DONE: "bg-status-done",
};

/** Kanban column that is both a dnd-kit droppable zone and a sortable list, mirroring
 * the static `KanbanColumn` shared component's look (spec/06-ui-ux.md §3.3). */
export function DroppableColumn({ status, tasks, onTaskClick, onToggleVisibility }: DroppableColumnProps) {
  const t = useTranslations("ui.kanban");
  const label = t(status === "TODO" ? "todo" : status === "IN_PROGRESS" ? "inProgress" : "done");
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div className="flex min-w-[260px] flex-1 flex-col gap-3">
      <div className="flex items-center gap-2 px-1">
        <span className={cn("size-2 rounded-full", STATUS_DOT[status])} />
        <h3 className="text-sm font-medium text-foreground">{label}</h3>
        <span className="text-xs text-muted-foreground">{tasks.length}</span>
      </div>
      <div
        ref={setNodeRef}
        role="list"
        aria-label={label}
        className={cn(
          "flex min-h-24 flex-col gap-2 rounded-xl bg-secondary/40 p-2 transition-colors duration-150",
          isOver && "bg-[var(--accent-soft)]",
        )}
      >
        <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
          {tasks.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">{t("empty")}</p>
          ) : (
            tasks.map((task) => (
              <div role="listitem" key={task.id}>
                <SortableTaskCard
                  task={task}
                  onClick={() => onTaskClick(task.id)}
                  onToggleVisibility={(next) => onToggleVisibility(task.id, next)}
                />
              </div>
            ))
          )}
        </SortableContext>
      </div>
    </div>
  );
}
