import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/authz";
import { db } from "@/lib/db";
import { EmptyState } from "@/components/shared/empty-state";
import { ChatPanel } from "@/features/chat/components/chat-panel";
import { getPortalProjects, resolveActiveProject } from "@/features/portal/server/home";
import { ProjectSwitcher } from "@/features/portal/components/project-switcher";

/**
 * Client "Správy" (Messages) tab (spec/06-ui-ux.md §3.5, spec/04-features.md §6, §8):
 * reuses WP-6's `ChatPanel` — the same thread + composer + SSE wiring as the admin side,
 * read-only once the project is archived (spec/04-features.md §3 AC).
 */
export default async function PortalMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const user = await requireUser();
  const { project: requestedProjectId } = await searchParams;
  const t = await getTranslations("portal.messages");

  const projects = await getPortalProjects(user.id);
  const active = resolveActiveProject(projects, requestedProjectId);

  if (!active) {
    return <EmptyState title={t("noProjectTitle")} description={t("noProjectDescription")} className="mt-12" />;
  }

  const project = await db.project.findUnique({ where: { id: active.id }, select: { status: true } });

  return (
    <div className="flex flex-col gap-4">
      <ProjectSwitcher projects={projects} activeProjectId={active.id} basePath="/portal/messages" />
      <div className="h-[calc(100vh-14rem)] min-h-[420px] overflow-hidden rounded-xl border border-border bg-card">
        <ChatPanel projectId={active.id} readOnly={project?.status === "ARCHIVED"} />
      </div>
    </div>
  );
}
