import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/authz";
import { EmptyState } from "@/components/shared/empty-state";
import { getPortalProjects, getPortalPhases, resolveActiveProject } from "@/features/portal/server/home";
import { ProjectSwitcher } from "@/features/portal/components/project-switcher";
import { ProgressPhaseCard } from "@/features/portal/components/progress-phase-card";

/**
 * Client "Postup" (Progress) tab (spec/06-ui-ux.md §3.7, spec/04-features.md §4, §8):
 * vertical phase list — no kanban, too "project-manager" for clients.
 */
export default async function PortalProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const user = await requireUser();
  const { project: requestedProjectId } = await searchParams;
  const t = await getTranslations("portal.progress");

  const projects = await getPortalProjects(user.id);
  const active = resolveActiveProject(projects, requestedProjectId);

  if (!active) {
    return <EmptyState title={t("noProjectTitle")} description={t("noProjectDescription")} className="mt-12" />;
  }

  const phases = await getPortalPhases(active.id, user);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-2xl text-foreground">{t("title")}</h1>
        <ProjectSwitcher projects={projects} activeProjectId={active.id} basePath="/portal/progress" />
      </div>

      {phases.length === 0 ? (
        <EmptyState title={t("emptyTitle")} description={t("emptyDescription")} />
      ) : (
        <div className="flex flex-col gap-4">
          {phases.map((phase) => (
            <ProgressPhaseCard key={phase.id} phase={phase} />
          ))}
        </div>
      )}
    </div>
  );
}
