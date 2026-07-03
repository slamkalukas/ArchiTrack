"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CommentThread } from "@/features/comments/components/comment-thread";
import type { AssigneeType, TaskStatus, Visibility } from "@/components/shared/types";
import type { PhaseDTO, TaskDTO } from "@/features/tasks/schemas";

export interface TaskFormValues {
  title: string;
  description: string;
  status: TaskStatus;
  phaseId: string;
  dueDate: string; // yyyy-mm-dd or ""
  weight: number;
  milestone: boolean;
  visibility: Visibility;
  assigneeType: AssigneeType;
  contactId: string | null;
}

interface ContactOption {
  id: string;
  name: string;
  role: string;
}

interface TaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phases: PhaseDTO[];
  defaultPhaseId: string;
  task?: TaskDTO | null;
  projectId: string;
  onSubmit: (values: TaskFormValues) => Promise<void>;
  onDelete?: () => Promise<void>;
}

function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function initialValues(defaultPhaseId: string, task?: TaskDTO | null): TaskFormValues {
  if (!task) return emptyValues(defaultPhaseId);
  return {
    title: task.title,
    description: task.description ?? "",
    status: task.status,
    phaseId: task.phaseId,
    dueDate: toDateInputValue(task.dueDate),
    weight: task.weight,
    milestone: task.milestone,
    visibility: task.visibility,
    assigneeType: task.assigneeType,
    contactId: task.contactId,
  };
}

/** Task create/edit modal — spec/04-features.md §4: title, description, phase, status,
 * due date, weight, milestone flag, visibility toggle, assignee.
 *
 * Mounts `TaskModalForm` fresh (keyed by open task id) whenever it opens so form state
 * initializes directly from props with no reset-effect needed. */
export function TaskModal(props: TaskModalProps) {
  if (!props.open) {
    return <Dialog open={false} onOpenChange={props.onOpenChange} />;
  }
  return <TaskModalForm key={props.task?.id ?? "new"} {...props} />;
}

function TaskModalForm({
  open,
  onOpenChange,
  phases,
  defaultPhaseId,
  task,
  projectId,
  onSubmit,
  onDelete,
}: TaskModalProps) {
  const t = useTranslations("tasks");
  const tc = useTranslations("common");
  const tk = useTranslations("ui.kanban");
  const isEdit = !!task;

  const [values, setValues] = useState<TaskFormValues>(() => initialValues(defaultPhaseId, task));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contacts, setContacts] = useState<ContactOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/projects/${projectId}/contacts`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((data: { items?: ContactOption[] }) => {
        if (!cancelled) setContacts(data.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setContacts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!values.title.trim()) {
      setError(t("title"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit(values);
      onOpenChange(false);
    } catch {
      setError(t("saveError"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    setSaving(true);
    try {
      await onDelete();
      onOpenChange(false);
    } catch {
      setError(t("saveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? t("editTaskTitle") : t("newTaskTitle")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="task-title">{t("title")}</Label>
            <Input
              id="task-title"
              value={values.title}
              onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
              required
              maxLength={300}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-description">{t("description")}</Label>
            <Textarea
              id="task-description"
              value={values.description}
              onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("phase")}</Label>
              <Select value={values.phaseId} onValueChange={(phaseId) => setValues((v) => ({ ...v, phaseId }))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {phases.map((phase) => (
                    <SelectItem key={phase.id} value={phase.id}>
                      {phase.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>{t("status")}</Label>
              <Select
                value={values.status}
                onValueChange={(status) => setValues((v) => ({ ...v, status: status as TaskStatus }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODO">{tk("todo")}</SelectItem>
                  <SelectItem value="IN_PROGRESS">{tk("inProgress")}</SelectItem>
                  <SelectItem value="DONE">{tk("done")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="task-due">{t("dueDate")}</Label>
              <Input
                id="task-due"
                type="date"
                value={values.dueDate}
                onChange={(e) => setValues((v) => ({ ...v, dueDate: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-weight">{t("weight")}</Label>
              <Input
                id="task-weight"
                type="number"
                min={0}
                max={1000}
                value={values.weight}
                onChange={(e) => setValues((v) => ({ ...v, weight: Number(e.target.value) || 0 }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("assignee")}</Label>
              <Select
                value={values.assigneeType}
                onValueChange={(assigneeType) =>
                  setValues((v) => ({ ...v, assigneeType: assigneeType as AssigneeType, contactId: assigneeType === "ARCHITECT" ? null : v.contactId }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ARCHITECT">{t("assigneeArchitect")}</SelectItem>
                  <SelectItem value="EXTERNAL">{t("assigneeExternal")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {values.assigneeType === "EXTERNAL" && (
              <div className="space-y-1.5">
                <Label>{t("contact")}</Label>
                <Select
                  value={values.contactId ?? "__none"}
                  onValueChange={(contactId) => setValues((v) => ({ ...v, contactId: contactId === "__none" ? null : contactId }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">{t("contactNone")}</SelectItem>
                    {contacts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} — {c.role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <Checkbox
                checked={values.milestone}
                onCheckedChange={(checked) => setValues((v) => ({ ...v, milestone: checked === true }))}
              />
              {t("milestone")}
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <Checkbox
                checked={values.visibility === "CLIENT_VISIBLE"}
                onCheckedChange={(checked) =>
                  setValues((v) => ({ ...v, visibility: checked === true ? "CLIENT_VISIBLE" : "INTERNAL" }))
                }
              />
              {t("visibility")}
            </label>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter className="pt-2">
            {isEdit && onDelete && (
              <Button type="button" variant="destructive" onClick={handleDelete} disabled={saving} className="sm:mr-auto">
                {t("delete")}
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              {tc("cancel")}
            </Button>
            <Button type="submit" disabled={saving}>
              {isEdit ? t("save") : t("create")}
            </Button>
          </DialogFooter>
        </form>

        {isEdit && task && (
          <div className="border-t border-border pt-4">
            <h3 className="mb-3 text-sm font-medium text-foreground">{t("commentsHeading")}</h3>
            <CommentThread subjectKind="task" subjectId={task.id} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function emptyValues(phaseId: string): TaskFormValues {
  return {
    title: "",
    description: "",
    status: "TODO",
    phaseId,
    dueDate: "",
    weight: 1,
    milestone: false,
    visibility: "INTERNAL",
    assigneeType: "ARCHITECT",
    contactId: null,
  };
}
