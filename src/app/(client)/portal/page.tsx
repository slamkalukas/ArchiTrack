import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/authz";
import { MilestoneTimeline } from "@/components/shared/milestone-timeline";
import { EmptyState } from "@/components/shared/empty-state";
import { getPortalProjects, getPortalHomeData, resolveActiveProject } from "@/features/portal/server/home";
import { PortalHero } from "@/features/portal/components/portal-hero";
import { ProjectSwitcher } from "@/features/portal/components/project-switcher";
import { ActivityFeed } from "@/features/portal/components/activity-feed";
import { RecentDocuments } from "@/features/portal/components/recent-documents";
import { FloatingChatButton } from "@/features/portal/components/floating-chat-button";

/**
 * Client "Prehľad" (Overview) — the showpiece screen (spec/06-ui-ux.md §3.6,
 * spec/04-features.md §8). Hero + progress ring + milestone timeline + two-column
 * "Najnovšie dokumenty" / "Aktuality" + persistent chat entry point.
 */
export default async function PortalHomePage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const user = await requireUser();
  const { project: requestedProjectId } = await searchParams;

  const t = await getTranslations("portal.home");
  const projects = await getPortalProjects(user.id);
  const active = resolveActiveProject(projects, requestedProjectId);

  if (!active) {
    return (
      <EmptyState
        title={t("noProjectTitle")}
        description={t("noProjectDescription")}
        className="mt-12"
      />
    );
  }

  const data = await getPortalHomeData(active.id, user);
  if (!data) notFound();

  return (
    <div className="flex flex-col gap-6 pb-20">
      <ProjectSwitcher projects={projects} activeProjectId={active.id} basePath="/portal" />

      <PortalHero project={data.project} />

      {data.milestones.length > 0 && (
        <section className="rounded-2xl border border-border bg-card px-4 py-5 sm:px-6">
          <h2 className="mb-2 font-serif text-lg text-foreground">{t("milestones")}</h2>
          <MilestoneTimeline
            milestones={data.milestones.map((m) => ({
              id: m.id,
              label: m.label,
              date: m.date ? new Date(m.date).toLocaleDateString() : null,
              done: m.done,
            }))}
          />
        </section>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-3 font-serif text-lg text-foreground">{t("recentDocuments")}</h2>
          <RecentDocuments documents={data.recentDocuments} />
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-3 font-serif text-lg text-foreground">{t("recentUpdates")}</h2>
          <ActivityFeed items={data.activity} />
        </section>
      </div>

      <FloatingChatButton unreadCount={data.unreadChatCount} />
    </div>
  );
}
