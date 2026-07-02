/**
 * Barrel export for the shared component inventory — spec/06-ui-ux.md §6.
 * Feature work packages should import from `@/components/shared` rather than
 * reaching into individual files.
 */
export { ProgressRing } from "./progress-ring";
export { PhaseAccordion } from "./phase-accordion";
export { TaskCard } from "./task-card";
export { KanbanColumn } from "./kanban-column";
export { FileTable } from "./file-table";
export { FolderTree } from "./folder-tree";
export { PreviewDrawer } from "./preview-drawer";
export { ChatThread } from "./chat-thread";
export { MessageComposer } from "./message-composer";
export { MilestoneTimeline } from "./milestone-timeline";
export { VisibilityToggle } from "./visibility-toggle";
export { EmptyState } from "./empty-state";
export { NotificationBell, type NotificationItem } from "./notification-bell";
export { ProjectCard } from "./project-card";
export { CoverImagePicker } from "./cover-image-picker";
export { LocaleSwitcher } from "./locale-switcher";

export type {
  PhaseStatus,
  TaskStatus,
  Visibility,
  AssigneeType,
  TaskSummary,
  PhaseSummary,
  MilestoneItem,
  FileEntry,
  FolderNode,
  ChatMessageItem,
  ProjectCardData,
} from "./types";
