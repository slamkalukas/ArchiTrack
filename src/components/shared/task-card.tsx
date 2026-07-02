"use client";

import { useTranslations } from "next-intl";
import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { VisibilityToggle } from "@/components/shared/visibility-toggle";
import { isOverdue } from "@/components/shared/date-helpers";
import type { TaskSummary } from "@/components/shared/types";

interface TaskCardProps {
  task: TaskSummary;
  onToggleVisibility?: (next: TaskSummary["visibility"]) => void;
  className?: string;
  /** Render as a plain button (kanban drag handle use case) instead of a div. */
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}

/** Kanban task card: title, due chip, milestone flag, visibility eye, comment count. */
export function TaskCard({ task, onToggleVisibility, className, dragHandleProps }: TaskCardProps) {
  const t = useTranslations("ui.taskCard");
  const overdue = isOverdue(task.dueDate) && task.status !== "DONE";

  return (
    <div
      className={cn(
        "group flex flex-col gap-2 rounded-lg border border-border bg-card p-3 text-left shadow-none transition-shadow duration-150 hover:shadow-sm",
        className,
      )}
      {...dragHandleProps}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          {task.isMilestone && (
            <span className="text-primary" aria-label={t("milestone")} title={t("milestone")}>
              ◆
            </span>
          )}
          {task.title}
        </p>
        <VisibilityToggle
          visibility={task.visibility}
          onToggle={onToggleVisibility}
          className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 data-[state=visible]:opacity-100"
        />
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {task.dueDate && (
          <span
            className={cn(
              "rounded-full px-2 py-0.5",
              overdue ? "bg-destructive/10 text-destructive" : "bg-secondary text-muted-foreground",
            )}
          >
            {new Date(task.dueDate).toLocaleDateString()}
          </span>
        )}
        {task.assignee && <span>{task.assignee}</span>}
        {!!task.commentCount && (
          <span className="ml-auto flex items-center gap-1">
            <MessageSquare className="size-3" />
            {task.commentCount}
          </span>
        )}
      </div>
    </div>
  );
}
