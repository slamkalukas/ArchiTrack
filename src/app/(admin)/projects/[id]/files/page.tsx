import { getTranslations } from "next-intl/server";
import { requireProjectAccess } from "@/lib/authz";
import { EmptyState } from "@/components/shared";

/**
 * Placeholder for the Files tab — owned by WP-5 (spec/07-agent-workplan.md).
 * WP-3 only wires the tab navigation; WP-5 replaces this page with the folder tree +
 * file table.
 */
export default async function ProjectFilesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireProjectAccess(id, "ADMIN");
  const t = await getTranslations("projects.detail.tabsPlaceholder");

  return <EmptyState title={t("files")} />;
}
