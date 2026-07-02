"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge, type badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VisibilityToggle } from "@/components/shared/visibility-toggle";
import { isOverdue } from "@/components/shared/date-helpers";
import type { VariantProps } from "class-variance-authority";
import type { PhaseDTO, TaskDTO } from "@/features/tasks/schemas";
import type { Visibility } from "@/components/shared/types";

const STATUS_VARIANT: Record<TaskDTO["status"], VariantProps<typeof badgeVariants>["variant"]> = {
  TODO: "todo",
  IN_PROGRESS: "in-progress",
  DONE: "done",
};

interface TaskListViewProps {
  tasks: TaskDTO[];
  phasesById: Map<string, PhaseDTO>;
  onTaskClick: (taskId: string) => void;
  onToggleVisibility: (taskId: string, next: Visibility) => void;
}

/** List view toggle: sort by due date (spec/04-features.md §4). */
export function TaskListView({ tasks, phasesById, onTaskClick, onToggleVisibility }: TaskListViewProps) {
  const t = useTranslations("tasks");
  const tk = useTranslations("ui.kanban");
  const [sortByDue, setSortByDue] = useState(false);

  const sorted = useMemo(() => {
    if (!sortByDue) return tasks;
    return [...tasks].sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
  }, [tasks, sortByDue]);

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="flex items-center justify-end border-b border-border bg-secondary/30 px-3 py-2">
        <Button variant="ghost" size="sm" onClick={() => setSortByDue((v) => !v)} aria-pressed={sortByDue}>
          <ArrowUpDown className="size-3.5" />
          {t("sortByDueDate")}
        </Button>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="px-3 py-2 font-medium">{t("listView.columns.title")}</th>
            <th className="px-3 py-2 font-medium">{t("listView.columns.phase")}</th>
            <th className="px-3 py-2 font-medium">{t("listView.columns.status")}</th>
            <th className="px-3 py-2 font-medium">{t("listView.columns.dueDate")}</th>
            <th className="px-3 py-2 font-medium">{t("listView.columns.visibility")}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((task) => {
            const overdue = isOverdue(task.dueDate) && task.status !== "DONE";
            return (
              <tr
                key={task.id}
                className="cursor-pointer border-b border-border last:border-0 hover:bg-secondary/30"
                onClick={() => onTaskClick(task.id)}
              >
                <td className="px-3 py-2.5">
                  <span className="flex items-center gap-1.5 font-medium text-foreground">
                    {task.milestone && (
                      <span className="text-primary" aria-hidden>
                        ◆
                      </span>
                    )}
                    {task.title}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">{phasesById.get(task.phaseId)?.name ?? "—"}</td>
                <td className="px-3 py-2.5">
                  <Badge variant={STATUS_VARIANT[task.status]}>
                    {tk(task.status === "TODO" ? "todo" : task.status === "IN_PROGRESS" ? "inProgress" : "done")}
                  </Badge>
                </td>
                <td className="px-3 py-2.5">
                  {task.dueDate ? (
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs",
                        overdue ? "bg-destructive/10 text-destructive" : "text-muted-foreground",
                      )}
                    >
                      {new Date(task.dueDate).toLocaleDateString()}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">{t("noDueDate")}</span>
                  )}
                </td>
                <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <VisibilityToggle
                    visibility={task.visibility}
                    onToggle={(next) => onToggleVisibility(task.id, next)}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
