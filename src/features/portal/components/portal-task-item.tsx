"use client";

import { useState } from "react";
import { Check, Circle, Dot, MessageSquare } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { CommentThread } from "@/features/comments/components/comment-thread";
import { cn } from "@/lib/utils";
import type { PortalPhaseTask } from "@/features/portal/types";

interface PortalTaskItemProps {
  task: PortalPhaseTask;
  phaseName: string;
}

/**
 * One task row on the Postup checklist. Clicking opens a detail dialog with the task's
 * description and a comment thread, so clients can leave feedback, insights and change
 * requests directly on the task (spec/04-features.md §7 — comments on client-visible
 * tasks; the server notifies the architect about every client comment).
 */
export function PortalTaskItem({ task, phaseName }: PortalTaskItemProps) {
  const t = useTranslations("portal.progress");
  const format = useFormatter();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(task.commentCount);

  const statusIcon =
    task.status === "DONE" ? (
      <Check className="size-4 text-primary" />
    ) : task.status === "IN_PROGRESS" ? (
      <Dot className="size-4 text-status-in-progress" strokeWidth={4} />
    ) : (
      <Circle className="size-3.5" />
    );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="-mx-2 flex w-[calc(100%+1rem)] items-start gap-2.5 rounded-lg px-2 py-1 text-left text-sm transition-colors duration-150 hover:bg-secondary/60 focus-visible:outline-2 focus-visible:outline-ring"
        aria-label={t("openTask", { title: task.title })}
      >
        <span className="mt-0.5 shrink-0 text-muted-foreground">{statusIcon}</span>
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
          {task.description && <span className="block text-xs text-muted-foreground">{task.description}</span>}
        </span>
        {count > 0 && (
          <span
            className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground"
            aria-label={t("commentCount", { count })}
          >
            <MessageSquare className="size-3.5" />
            {count}
          </span>
        )}
        {task.dueDate && (
          <span className="shrink-0 text-xs text-muted-foreground">
            {format.dateTime(new Date(task.dueDate), { dateStyle: "medium" })}
          </span>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2 pr-6">
              {task.title}
              <Badge variant={task.status === "DONE" ? "done" : task.status === "IN_PROGRESS" ? "in-progress" : "todo"}>
                {t(`taskStatus.${task.status.toLowerCase()}` as never)}
              </Badge>
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">{phaseName}</p>
          {task.description && <p className="text-sm text-foreground">{task.description}</p>}
          {task.dueDate && (
            <p className="text-xs text-muted-foreground">
              {t("dueDate", { date: format.dateTime(new Date(task.dueDate), { dateStyle: "long" }) })}
            </p>
          )}
          <Separator />
          <div>
            <h3 className="mb-3 text-sm font-medium text-foreground">{t("commentsHeading")}</h3>
            <p className="mb-3 text-xs text-muted-foreground">{t("commentsHint")}</p>
            {open && <CommentThread subjectKind="task" subjectId={task.id} onCountChange={setCount} />}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
