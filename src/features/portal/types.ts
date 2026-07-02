/**
 * Client-safe DTO types for the portal feature (WP-7). Mirror server `server/*` return
 * shapes with `Date` fields as ISO strings — see spec/06-ui-ux.md §3.6-3.7.
 */

export interface PortalProjectSummary {
  id: string;
  name: string;
  slug: string;
  locationText: string | null;
  description: string | null;
  coverImageUrl: string | null;
  progress: number;
  currentPhase: { id: string; name: string; description: string | null } | null;
}

export interface PortalMilestone {
  id: string;
  label: string;
  date: string | null;
  done: boolean;
}

export interface PortalDocument {
  id: string;
  name: string;
  kind: "pdf" | "image" | "doc" | "other";
  updatedAt: string;
}

export interface PortalActivityItem {
  id: string;
  textKey: string;
  createdAt: string;
}

export interface PortalHomeData {
  project: PortalProjectSummary;
  milestones: PortalMilestone[];
  recentDocuments: PortalDocument[];
  activity: PortalActivityItem[];
  unreadChatCount: number;
}

export interface PortalPhaseTask {
  id: string;
  title: string;
  description: string | null;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  dueDate: string | null;
  milestone: boolean;
}

export interface PortalPhase {
  id: string;
  order: number;
  name: string;
  description: string | null;
  status: "UPCOMING" | "ACTIVE" | "DONE" | "SKIPPED";
  progress: number;
  weight: number;
  tasks: PortalPhaseTask[];
}
