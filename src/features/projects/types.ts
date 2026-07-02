/**
 * Client-safe DTO types for the projects feature — mirror the server `server/*` return
 * shapes but with `Date` fields as ISO strings (post-`NextResponse.json` serialization).
 * Kept import-free of `server-only` modules so client components can import this file.
 */

export interface DashboardProjectCardDto {
  id: string;
  name: string;
  slug: string;
  status: "ACTIVE" | "ON_HOLD" | "ARCHIVED";
  coverImageUrl: string | null;
  clientNames: string[];
  phaseName: string | null;
  progress: number;
  unreadCount: number;
  nextDueTask: { id: string; title: string; dueDate: string } | null;
  expiringFileCount: number;
  overdueTaskCount: number;
  updatedAt: string;
}

export interface ClientProjectSummaryDto {
  id: string;
  name: string;
  slug: string;
  locationText: string | null;
  description: string | null;
  coverImageUrl: string | null;
  progress: number;
  currentPhase: { id: string; name: string; description: string | null } | null;
}

export interface TemplateListItemDto {
  id: string;
  name: string;
}

export interface TemplateTaskDto {
  id: string;
  titleSk: string;
  titleEn: string;
  order: number;
  milestone: boolean;
}

export interface TemplatePhaseDto {
  id: string;
  key: string;
  nameSk: string;
  nameEn: string;
  order: number;
  weight: number;
  tasks: TemplateTaskDto[];
}

export interface TemplateDetailDto {
  id: string;
  name: string;
  phases: TemplatePhaseDto[];
}

export interface ProjectMemberDto {
  userId: string;
  addedAt: string;
  user: { id: string; name: string; email: string; role: "ADMIN" | "CLIENT"; isActive: boolean };
  invite: { id: string; expiresAt: string } | null;
}

export interface ContactDto {
  id: string;
  name: string;
  role: string;
  email: string | null;
  phone: string | null;
  note: string | null;
}

export interface PhaseWeightDto {
  id: string;
  name: string;
  order: number;
  weight: number;
  status: "UPCOMING" | "ACTIVE" | "DONE" | "SKIPPED";
}

export interface AdminProjectDetailDto {
  id: string;
  name: string;
  slug: string;
  status: "ACTIVE" | "ON_HOLD" | "ARCHIVED";
  locationText: string | null;
  description: string | null;
  coverImageId: string | null;
  coverImageUrl: string | null;
  startDate: string | null;
  targetDate: string | null;
  archivedAt: string | null;
  progress: number;
  currentPhaseName: string | null;
  clientNames: string[];
  members: ProjectMemberDto[];
  contacts: ContactDto[];
  phases: PhaseWeightDto[];
}

export interface ActivityItemDto {
  id: string;
  action: string;
  entityId: string | null;
  actorId?: string;
  meta?: unknown;
  createdAt: string;
}
