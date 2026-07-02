import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/authz";
import { EmptyState } from "@/components/shared/empty-state";
import { FilesView } from "@/features/files/components/files-view";
import { getPortalProjects, resolveActiveProject } from "@/features/portal/server/home";
import { ProjectSwitcher } from "@/features/portal/components/project-switcher";

/**
 * Client "Dokumenty" (Documents) tab (spec/04-features.md §5, §8): reuses WP-5's
 * `FilesView` in its CLIENT-role shape — visibility filtering, preview, download and ZIP
 * are already role-aware there; uploads are only permitted into the "Od klienta" folder.
 */
export default async function PortalDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const user = await requireUser();
  const { project: requestedProjectId } = await searchParams;
  const t = await getTranslations("portal.documents");

  const projects = await getPortalProjects(user.id);
  const active = resolveActiveProject(projects, requestedProjectId);

  if (!active) {
    return <EmptyState title={t("noProjectTitle")} description={t("noProjectDescription")} className="mt-12" />;
  }

  return (
    <div className="flex flex-col gap-4">
      <ProjectSwitcher projects={projects} activeProjectId={active.id} basePath="/portal/documents" />
      <FilesView projectId={active.id} role="CLIENT" />
    </div>
  );
}
