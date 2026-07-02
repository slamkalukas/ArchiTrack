/**
 * Shared mock/display types for WP-2 shared components.
 * These mirror the shapes in spec/03-data-model.md closely enough for the shared
 * components' props, but are intentionally decoupled from `@prisma/client` — feature
 * work packages (WP-3..7) pass their own Prisma-backed data through these same props.
 */

export type PhaseStatus = "UPCOMING" | "ACTIVE" | "DONE" | "SKIPPED";
export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";
export type Visibility = "INTERNAL" | "CLIENT_VISIBLE";
export type AssigneeType = "ARCHITECT" | "EXTERNAL";

export interface TaskSummary {
  id: string;
  title: string;
  status: TaskStatus;
  visibility: Visibility;
  dueDate?: string | null;
  isMilestone?: boolean;
  commentCount?: number;
  assignee?: string | null;
}

export interface PhaseSummary {
  id: string;
  order: number;
  name: string;
  status: PhaseStatus;
  progress: number;
  weight?: number;
  description?: string | null;
  tasks?: TaskSummary[];
}

export interface MilestoneItem {
  id: string;
  label: string;
  date?: string | null;
  done: boolean;
}

export interface FileEntry {
  id: string;
  name: string;
  version: number;
  sizeLabel: string;
  updatedAt: string;
  visibility: Visibility;
  validUntil?: string | null;
  commentCount?: number;
  kind: "pdf" | "image" | "doc" | "other";
}

export interface FolderNode {
  id: string;
  name: string;
  children?: FolderNode[];
}

export interface ChatMessageItem {
  id: string;
  authorName: string;
  own: boolean;
  body: string;
  createdAt: string;
  attachments?: { id: string; name: string; kind: "pdf" | "image" | "doc" | "other" }[];
}

export interface ProjectCardData {
  id: string;
  name: string;
  clientNames: string[];
  phaseName: string;
  progress: number;
  coverImageUrl?: string | null;
  unreadCount?: number;
  overdueCount?: number;
}
