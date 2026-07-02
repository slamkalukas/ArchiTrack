import { getTranslations } from "next-intl/server";
import { requireProjectAccess } from "@/lib/authz";
import { EmptyState } from "@/components/shared";

/**
 * Placeholder for the Phases & Tasks tab — owned by WP-4 (spec/07-agent-workplan.md).
 * WP-3 only wires the tab navigation; WP-4 replaces this page with the kanban board.
 */
export default async function ProjectTasksPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireProjectAccess(id, "ADMIN");
  const t = await getTranslations("projects.detail.tabsPlaceholder");

  return <EmptyState title={t("tasks")} />;
}
