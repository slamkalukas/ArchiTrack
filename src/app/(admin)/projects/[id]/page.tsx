import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireProjectAccess } from "@/lib/authz";
import { db } from "@/lib/db";
import { projectProgress, toPercent } from "@/lib/progress";
import { ProgressRing } from "@/components/shared";
import { Card } from "@/components/ui/card";

interface TaskLike {
  status: string;
  dueDate: Date | null;
  deletedAt: Date | null;
}

/** Earliest not-done task with a future due date. Pulled out of the component body
 * (including the `Date.now()` read itself) so the react-hooks/purity rule doesn't flag
 * an impure call inside the page component — this is a server component, so it's safe,
 * but the lint rule can't tell components and plain async data-loaders apart. */
function findNextDueTask<T extends TaskLike>(tasks: T[]): T | undefined {
  const now = Date.now();
  return tasks
    .filter((tsk) => !tsk.deletedAt && tsk.status !== "DONE" && tsk.dueDate && tsk.dueDate.getTime() >= now)
    .sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime())[0];
}

/** Project overview tab: current phase, progress ring, next deadline, recent activity (spec/06-ui-ux.md §3.3-ish admin variant). */
export default async function ProjectOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await requireProjectAccess(id, "ADMIN");
  const t = await getTranslations("projects.detail.overview");

  const project = await db.project.findUnique({
    where: { id },
    include: {
      members: { include: { user: { select: { name: true, role: true } } } },
      phases: {
        orderBy: { order: "asc" },
        include: { tasks: { select: { id: true, title: true, status: true, weight: true, dueDate: true, deletedAt: true } } },
      },
    },
  });

  if (!project) notFound();

  const activity = await db.activityLog.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "desc" },
    take: 8,
  });

  const currentPhase = project.phases.find((p) => p.status === "ACTIVE") ?? project.phases.find((p) => p.status === "UPCOMING");
  const progress = toPercent(
    projectProgress(project.phases.map((p) => ({ status: p.status, weight: p.weight, tasks: p.tasks.filter((tk) => !tk.deletedAt) }))),
  );
  const clientNames = project.members.filter((m) => m.user.role === "CLIENT").map((m) => m.user.name);

  const nextDue = findNextDueTask(project.phases.flatMap((p) => p.tasks));

  const unreadCount = await db.chatMessage.count({
    where: {
      projectId: id,
      deletedAt: null,
      authorId: { not: user.id },
      reads: { none: { userId: user.id } },
    },
  });

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card className="flex flex-col items-center gap-3 p-6 lg:col-span-1">
        <ProgressRing value={progress} sublabel={t("progress")} />
        {currentPhase && (
          <p className="text-center text-sm text-muted-foreground">
            {t("currentPhase")}: <span className="font-medium text-foreground">{currentPhase.name}</span>
          </p>
        )}
      </Card>

      <div className="flex flex-col gap-6 lg:col-span-2">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <StatTile label={t("location")} value={project.locationText ?? "—"} />
          <StatTile
            label={t("nextDue")}
            value={nextDue ? nextDue.dueDate!.toLocaleDateString("sk-SK") : t("noNextDue")}
          />
          <StatTile label={t("unread")} value={String(unreadCount)} />
          <StatTile label={t("clients")} value={clientNames.length > 0 ? clientNames.join(", ") : "—"} />
        </div>

        <Card className="p-5">
          <h2 className="mb-3 font-serif text-base text-foreground">{t("recentActivity")}</h2>
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noActivity")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {activity.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{entry.action}</span>
                  <span className="text-xs text-muted-foreground">
                    {entry.createdAt.toLocaleString("sk-SK")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-medium text-foreground">{value}</p>
    </Card>
  );
}
