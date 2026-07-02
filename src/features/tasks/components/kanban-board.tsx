"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { TaskCard } from "@/components/shared/task-card";
import { DroppableColumn } from "@/features/tasks/components/droppable-column";
import { reorderTasksApi, type ReorderMoveInput } from "@/features/tasks/components/api-client";
import type { TaskDTO } from "@/features/tasks/schemas";
import type { TaskStatus, TaskSummary, Visibility } from "@/components/shared/types";

const COLUMNS: TaskStatus[] = ["TODO", "IN_PROGRESS", "DONE"];

function toSummary(task: TaskDTO): TaskSummary {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    visibility: task.visibility,
    dueDate: task.dueDate,
    isMilestone: task.milestone,
    commentCount: task.commentCount,
    assignee: task.assigneeType === "EXTERNAL" ? (task.contactName ?? undefined) : undefined,
  };
}

interface KanbanBoardProps {
  tasks: TaskDTO[];
  onTasksChange: (updater: (prev: TaskDTO[]) => TaskDTO[]) => void;
  onTaskClick: (taskId: string) => void;
  onToggleVisibility: (taskId: string, next: Visibility) => void;
}

/** Board view: To-do / In progress / Done columns, drag & drop via dnd-kit
 * (spec/04-features.md §4). Optimistic UI with rollback on failure (spec/06-ui-ux.md §4.4). */
export function KanbanBoard({ tasks, onTasksChange, onTaskClick, onToggleVisibility }: KanbanBoardProps) {
  const t = useTranslations("tasks");
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const byColumn = useMemo(() => {
    const grouped: Record<TaskStatus, TaskDTO[]> = { TODO: [], IN_PROGRESS: [], DONE: [] };
    for (const task of [...tasks].sort((a, b) => a.order - b.order)) {
      grouped[task.status].push(task);
    }
    return grouped;
  }, [tasks]);

  const activeTask = activeId ? tasks.find((task) => task.id === activeId) : undefined;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = String(active.id);
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const overId = String(over.id);
    const targetStatus: TaskStatus = COLUMNS.includes(overId as TaskStatus)
      ? (overId as TaskStatus)
      : (tasks.find((t) => t.id === overId)?.status ?? task.status);

    const destination = byColumn[targetStatus].filter((t) => t.id !== taskId);
    const overIndex = destination.findIndex((t) => t.id === overId);
    const insertAt = overIndex === -1 ? destination.length : overIndex;
    destination.splice(insertAt, 0, task);

    const moves: ReorderMoveInput[] = destination.map((t, index) => ({
      taskId: t.id,
      status: targetStatus,
      order: index + 1,
    }));

    const previousSnapshot = tasks;
    // Optimistic update: apply the new (status, order) locally right away.
    onTasksChange((prev) =>
      prev.map((t) => {
        const move = moves.find((m) => m.taskId === t.id);
        if (!move) return t;
        return {
          ...t,
          status: move.status,
          order: move.order,
          doneAt: move.status === "DONE" && t.status !== "DONE" ? new Date().toISOString() : move.status !== "DONE" ? null : t.doneAt,
        };
      }),
    );

    try {
      await reorderTasksApi(moves);
    } catch {
      onTasksChange(() => previousSnapshot);
      toast.error(t("reorderError"));
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {COLUMNS.map((status) => (
          <DroppableColumn
            key={status}
            status={status}
            tasks={byColumn[status].map(toSummary)}
            onTaskClick={onTaskClick}
            onToggleVisibility={onToggleVisibility}
          />
        ))}
      </div>
      <DragOverlay>{activeTask ? <TaskCard task={toSummary(activeTask)} className="shadow-lg" /> : null}</DragOverlay>
    </DndContext>
  );
}
