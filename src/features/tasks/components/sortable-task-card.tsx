"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { TaskCard } from "@/components/shared/task-card";
import type { TaskSummary } from "@/components/shared/types";

interface SortableTaskCardProps {
  task: TaskSummary;
  onClick?: () => void;
  onToggleVisibility?: (next: TaskSummary["visibility"]) => void;
}

/** Drag-sortable wrapper around the shared `TaskCard`, keyboard-operable via dnd-kit's
 * built-in keyboard sensor (spec/06-ui-ux.md §4.7 a11y requirement). */
export function SortableTaskCard({ task, onClick, onToggleVisibility }: SortableTaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("cursor-grab active:cursor-grabbing", isDragging && "opacity-50")}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        // Avoid triggering the modal on the same interaction that starts a drag, and
        // don't open it when the click landed on the visibility-toggle button.
        if (isDragging) return;
        if ((e.target as HTMLElement).closest("[data-slot='button']")) return;
        onClick?.();
      }}
    >
      <TaskCard task={task} onToggleVisibility={onToggleVisibility} />
    </div>
  );
}
