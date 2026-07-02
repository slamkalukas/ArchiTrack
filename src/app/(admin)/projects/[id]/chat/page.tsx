import { getTranslations } from "next-intl/server";
import { requireProjectAccess } from "@/lib/authz";
import { EmptyState } from "@/components/shared";

/**
 * Placeholder for the Chat tab — owned by WP-6 (spec/07-agent-workplan.md).
 * WP-3 only wires the tab navigation; WP-6 replaces this page with the chat thread.
 */
export default async function ProjectChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireProjectAccess(id, "ADMIN");
  const t = await getTranslations("projects.detail.tabsPlaceholder");

  return <EmptyState title={t("chat")} />;
}
