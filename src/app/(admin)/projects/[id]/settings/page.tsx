import { notFound } from "next/navigation";
import { requireProjectAccess } from "@/lib/authz";
import { getAdminProjectDetail, getPendingInvitesByUser } from "@/features/projects";
import { projectProgress, toPercent } from "@/lib/progress";
import { SettingsView } from "@/features/projects/components/settings-view";
import type { AdminProjectDetailDto } from "@/features/projects/types";

/** Project settings tab route (spec/04-features.md §3). */
export default async function ProjectSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireProjectAccess(id, "ADMIN");

  const project = await getAdminProjectDetail(id);
  if (!project) notFound();

  const clientUserIds = project.members.filter((m) => m.user.role === "CLIENT").map((m) => m.userId);
  const pendingInvites = await getPendingInvitesByUser(clientUserIds);

  const currentPhase =
    project.phases.find((p) => p.status === "ACTIVE") ?? project.phases.find((p) => p.status === "UPCOMING");

  const dto: AdminProjectDetailDto = {
    id: project.id,
    name: project.name,
    slug: project.slug,
    status: project.status,
    locationText: project.locationText,
    description: project.description,
    coverImageId: project.coverImageId,
    coverImageUrl: null,
    startDate: project.startDate?.toISOString() ?? null,
    targetDate: project.targetDate?.toISOString() ?? null,
    archivedAt: project.archivedAt?.toISOString() ?? null,
    progress: toPercent(
      projectProgress(
        project.phases.map((p) => ({
          status: p.status,
          weight: p.weight,
          tasks: p.tasks.filter((tk) => !tk.deletedAt),
        })),
      ),
    ),
    currentPhaseName: currentPhase?.name ?? null,
    clientNames: project.members.filter((m) => m.user.role === "CLIENT").map((m) => m.user.name),
    members: project.members.map((m) => ({
      userId: m.userId,
      addedAt: m.addedAt.toISOString(),
      user: m.user,
      invite: pendingInvites.has(m.userId)
        ? {
            id: pendingInvites.get(m.userId)!.id,
            expiresAt: pendingInvites.get(m.userId)!.expiresAt.toISOString(),
          }
        : null,
    })),
    contacts: project.contacts.map((c) => ({
      id: c.id,
      name: c.name,
      role: c.role,
      email: c.email,
      phone: c.phone,
      note: c.note,
    })),
    phases: project.phases.map((p) => ({
      id: p.id,
      name: p.name,
      order: p.order,
      weight: p.weight,
      status: p.status,
    })),
  };

  return <SettingsView project={dto} />;
}
