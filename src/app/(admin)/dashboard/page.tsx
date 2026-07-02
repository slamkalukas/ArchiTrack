import { requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { getDashboardProjects } from "@/features/projects";
import { DashboardView } from "@/features/projects/components/dashboard-view";
import type { DashboardProjectCardDto } from "@/features/projects/types";
import type { NotificationItem } from "@/components/shared";

/** Admin dashboard: project cards + aggregates, right rail (spec/04-features.md §2). */
export default async function DashboardPage() {
  const user = await requireRole("ADMIN");

  const [projects, notifications] = await Promise.all([
    getDashboardProjects({ status: "ACTIVE", userId: user.id }),
    db.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const projectDtos: DashboardProjectCardDto[] = projects.map((p) => ({
    ...p,
    nextDueTask: p.nextDueTask
      ? { id: p.nextDueTask.id, title: p.nextDueTask.title, dueDate: p.nextDueTask.dueDate.toISOString() }
      : null,
    updatedAt: p.updatedAt.toISOString(),
  }));

  const notificationItems: NotificationItem[] = notifications.map((n) => ({
    id: n.id,
    title: n.titleKey,
    timeLabel: n.createdAt.toLocaleDateString("sk-SK"),
    read: !!n.readAt,
  }));

  return <DashboardView initialProjects={projectDtos} notifications={notificationItems} />;
}
