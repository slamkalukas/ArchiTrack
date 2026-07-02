"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { LayoutGrid, List, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PhaseAccordion } from "@/components/shared/phase-accordion";
import { EmptyState } from "@/components/shared/empty-state";
import { KanbanBoard } from "@/features/tasks/components/kanban-board";
import { TaskListView } from "@/features/tasks/components/task-list-view";
import { TaskModal, type TaskFormValues } from "@/features/tasks/components/task-modal";
import { PhaseModal, type PhaseFormValues } from "@/features/tasks/components/phase-modal";
import { ConfirmDialog } from "@/features/tasks/components/confirm-dialog";
import {
  createPhaseApi,
  createTaskApi,
  deletePhaseApi,
  deleteTaskApi,
  fetchPhases,
  updatePhaseApi,
  updateTaskApi,
} from "@/features/tasks/components/api-client";
import type { PhaseDTO, TaskDTO } from "@/features/tasks/schemas";
import type { Visibility } from "@/components/shared/types";

interface PhasesTasksBoardProps {
  projectId: string;
  initialPhases: PhaseDTO[];
}

type ViewMode = "board" | "list";

/**
 * Top-level admin "Phases & Tasks" tab (spec/04-features.md §4, spec/06-ui-ux.md §3.3):
 *   - phase accordion up top: order, name, status chip, progress bar, weight, and quick
 *     actions (edit phase, delete when empty, mark done).
 *   - one board/list below, scoped to "All phases" (project board, the default) or a
 *     single phase via the selector — dragging works the same either way since the
 *     kanban groups strictly by (status, order) regardless of how many phases are shown.
 */
export function PhasesTasksBoard({ projectId, initialPhases }: PhasesTasksBoardProps) {
  const t = useTranslations("tasks");
  const tp = useTranslations("phases");

  const [phases, setPhases] = useState<PhaseDTO[]>(initialPhases);
  const [scope, setScope] = useState<string>("__all");
  const [view, setView] = useState<ViewMode>("board");

  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskDTO | null>(null);
  const [taskModalDefaultPhaseId, setTaskModalDefaultPhaseId] = useState<string>("");

  const [phaseModalOpen, setPhaseModalOpen] = useState(false);
  const [editingPhase, setEditingPhase] = useState<PhaseDTO | null>(null);

  const [phaseDoneConfirm, setPhaseDoneConfirm] = useState<{ phaseId: string } | null>(null);
  const [deletePhaseConfirm, setDeletePhaseConfirm] = useState<PhaseDTO | null>(null);

  const phasesById = useMemo(() => new Map(phases.map((p) => [p.id, p])), [phases]);

  // Fall back to "all phases" when the selected scope no longer exists (e.g. the phase
  // was deleted) — derived directly from render state, no reset-effect needed.
  const effectiveScope = scope !== "__all" && !phasesById.has(scope) ? "__all" : scope;

  const scopedPhaseIds = useMemo(
    () => new Set(effectiveScope === "__all" ? phases.map((p) => p.id) : [effectiveScope]),
    [phases, effectiveScope],
  );

  const scopedTasks = useMemo(
    () => phases.filter((p) => scopedPhaseIds.has(p.id)).flatMap((p) => p.tasks),
    [phases, scopedPhaseIds],
  );

  async function refresh() {
    try {
      const next = await fetchPhases(projectId);
      setPhases(next);
      return next;
    } catch {
      toast.error(t("loadError"));
      return null;
    }
  }

  function replaceTaskLocally(phaseId: string, taskId: string, updater: (task: TaskDTO) => TaskDTO) {
    setPhases((prev) =>
      prev.map((phase) =>
        phase.id === phaseId
          ? { ...phase, tasks: phase.tasks.map((task) => (task.id === taskId ? updater(task) : task)) }
          : phase,
      ),
    );
  }

  function openCreateTask(phaseId?: string) {
    setEditingTask(null);
    setTaskModalDefaultPhaseId(phaseId ?? (effectiveScope !== "__all" ? effectiveScope : (phases[0]?.id ?? "")));
    setTaskModalOpen(true);
  }

  function openEditTask(taskId: string) {
    const task = phases.flatMap((p) => p.tasks).find((tsk) => tsk.id === taskId);
    if (!task) return;
    setEditingTask(task);
    setTaskModalDefaultPhaseId(task.phaseId);
    setTaskModalOpen(true);
  }

  async function handleTaskSubmit(values: TaskFormValues) {
    const payload = {
      title: values.title,
      description: values.description || null,
      status: values.status,
      dueDate: values.dueDate ? new Date(values.dueDate).toISOString() : null,
      weight: values.weight,
      milestone: values.milestone,
      visibility: values.visibility,
      assigneeType: values.assigneeType,
      contactId: values.assigneeType === "EXTERNAL" ? values.contactId : null,
    };

    if (editingTask) {
      await updateTaskApi(editingTask.id, { ...payload, phaseId: values.phaseId });
    } else {
      await createTaskApi(values.phaseId, payload);
    }
    await refresh();
    await maybePromptPhaseDone(values.phaseId);
  }

  async function handleTaskDelete() {
    if (!editingTask) return;
    await deleteTaskApi(editingTask.id);
    await refresh();
  }

  async function handleToggleVisibility(taskId: string, next: Visibility) {
    const phase = phases.find((p) => p.tasks.some((tsk) => tsk.id === taskId));
    if (!phase) return;
    const previous = phase.tasks.find((tsk) => tsk.id === taskId)?.visibility;
    replaceTaskLocally(phase.id, taskId, (task) => ({ ...task, visibility: next }));
    try {
      await updateTaskApi(taskId, { visibility: next });
    } catch {
      if (previous) replaceTaskLocally(phase.id, taskId, (task) => ({ ...task, visibility: previous }));
      toast.error(t("saveError"));
    }
  }

  /** spec/04-features.md §4: marking the last task of a phase Done prompts "Mark phase as done?" */
  async function maybePromptPhaseDone(phaseId: string) {
    const phase = phasesById.get(phaseId);
    if (!phase || phase.status === "DONE") return;
    const latest = await fetchPhases(projectId).catch(() => null);
    const freshPhase = latest?.find((p) => p.id === phaseId);
    if (!freshPhase || freshPhase.tasks.length === 0) return;
    const allDone = freshPhase.tasks.every((task) => task.status === "DONE");
    if (allDone) {
      setPhaseDoneConfirm({ phaseId });
    }
  }

  async function confirmPhaseDone() {
    if (!phaseDoneConfirm) return;
    try {
      await updatePhaseApi(phaseDoneConfirm.phaseId, { status: "DONE", activateNext: true });
      await refresh();
    } catch {
      toast.error(t("saveError"));
    }
  }

  function openCreatePhase() {
    setEditingPhase(null);
    setPhaseModalOpen(true);
  }

  function openEditPhase(phase: PhaseDTO) {
    setEditingPhase(phase);
    setPhaseModalOpen(true);
  }

  async function handlePhaseSubmit(values: PhaseFormValues) {
    if (editingPhase) {
      await updatePhaseApi(editingPhase.id, values);
    } else {
      await createPhaseApi(projectId, values);
    }
    await refresh();
  }

  async function confirmDeletePhase() {
    if (!deletePhaseConfirm) return;
    try {
      await deletePhaseApi(deletePhaseConfirm.id);
      await refresh();
    } catch {
      toast.error(tp("deleteNotEmpty"));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-2xl text-foreground">{tp("title")}</h1>
        <Button variant="outline" size="sm" onClick={openCreatePhase}>
          <Plus className="size-4" />
          {tp("addPhase")}
        </Button>
      </div>

      {phases.length === 0 ? (
        <EmptyState title={tp("empty.title")} description={tp("empty.description")} />
      ) : (
        <>
          <div className="space-y-3">
            {phases.map((phase) => (
              <PhaseAccordion
                key={phase.id}
                phase={{
                  id: phase.id,
                  order: phase.order,
                  name: phase.name,
                  status: phase.status,
                  progress: phase.progress,
                  weight: phase.weight,
                  description: phase.description,
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-muted-foreground">
                    {phase.description ?? "—"}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => openEditPhase(phase)}>
                      {tp("editPhaseTitle")}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openCreateTask(phase.id)}>
                      <Plus className="size-4" />
                      {t("addTask")}
                    </Button>
                    {phase.tasks.length === 0 && (
                      <Button variant="ghost" size="sm" onClick={() => setDeletePhaseConfirm(phase)}>
                        {tp("deleteConfirmTitle")}
                      </Button>
                    )}
                  </div>
                </div>
              </PhaseAccordion>
            ))}
          </div>

          <section className="space-y-3 border-t border-border pt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Select value={effectiveScope} onValueChange={setScope}>
                <SelectTrigger className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">{tp("scope.allPhases")}</SelectItem>
                  {phases.map((phase) => (
                    <SelectItem key={phase.id} value={phase.id}>
                      {phase.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
                  <Button
                    variant={view === "board" ? "secondary" : "ghost"}
                    size="sm"
                    aria-pressed={view === "board"}
                    onClick={() => setView("board")}
                  >
                    <LayoutGrid className="size-4" />
                    {tp("viewToggle.board")}
                  </Button>
                  <Button
                    variant={view === "list" ? "secondary" : "ghost"}
                    size="sm"
                    aria-pressed={view === "list"}
                    onClick={() => setView("list")}
                  >
                    <List className="size-4" />
                    {tp("viewToggle.list")}
                  </Button>
                </div>
                <Button size="sm" onClick={() => openCreateTask()}>
                  <Plus className="size-4" />
                  {t("addTask")}
                </Button>
              </div>
            </div>

            {scopedTasks.length === 0 ? (
              <EmptyState title={t("empty.title")} description={t("empty.description")} />
            ) : view === "board" ? (
              <KanbanBoard
                tasks={scopedTasks}
                onTasksChange={(updater) =>
                  setPhases((prev) => {
                    const updated = updater(prev.filter((p) => scopedPhaseIds.has(p.id)).flatMap((p) => p.tasks));
                    return prev.map((phase) =>
                      scopedPhaseIds.has(phase.id)
                        ? { ...phase, tasks: updated.filter((task) => task.phaseId === phase.id) }
                        : phase,
                    );
                  })
                }
                onTaskClick={openEditTask}
                onToggleVisibility={handleToggleVisibility}
              />
            ) : (
              <TaskListView
                tasks={scopedTasks}
                phasesById={phasesById}
                onTaskClick={openEditTask}
                onToggleVisibility={handleToggleVisibility}
              />
            )}
          </section>
        </>
      )}

      <TaskModal
        open={taskModalOpen}
        onOpenChange={setTaskModalOpen}
        phases={phases}
        defaultPhaseId={taskModalDefaultPhaseId}
        task={editingTask}
        projectId={projectId}
        onSubmit={handleTaskSubmit}
        onDelete={editingTask ? handleTaskDelete : undefined}
      />

      <PhaseModal open={phaseModalOpen} onOpenChange={setPhaseModalOpen} phase={editingPhase} onSubmit={handlePhaseSubmit} />

      <ConfirmDialog
        open={!!phaseDoneConfirm}
        onOpenChange={(open) => !open && setPhaseDoneConfirm(null)}
        title={tp("markDoneConfirmTitle")}
        description={tp("markDoneConfirmDescription")}
        confirmLabel={tp("markDone")}
        onConfirm={confirmPhaseDone}
      />

      <ConfirmDialog
        open={!!deletePhaseConfirm}
        onOpenChange={(open) => !open && setDeletePhaseConfirm(null)}
        title={tp("deleteConfirmTitle")}
        description={tp("deleteConfirmDescription")}
        confirmLabel={t("delete")}
        destructive
        onConfirm={confirmDeletePhase}
      />
    </div>
  );
}
