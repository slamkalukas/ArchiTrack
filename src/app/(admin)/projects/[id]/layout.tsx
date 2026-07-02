import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireProjectAccess } from "@/lib/authz";
import { ProjectTabNav } from "@/components/layout/project-tab-nav";

/**
 * Minimal project-detail shell shared by every `/projects/:id/*` admin tab (Overview ·
 * Phases & Tasks · Files · Chat · Activity · Settings — spec/06-ui-ux.md §2). WP-4 only
 * owns the "Phases & Tasks" tab itself; this layout is the small amount of shared
 * scaffolding (header + tab nav) needed for that tab to render standalone in this
 * worktree. WP-3 owns the Overview/Settings tab pages and may extend this layout further
 * (e.g. richer header with cover image) when the branches merge.
 */
export default async function ProjectDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireProjectAccess(id, "ADMIN");

  const project = await db.project.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!project) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="font-serif text-2xl text-foreground">{project.name}</h1>
      <ProjectTabNav projectId={project.id} className="mt-4" />
      <div className="py-6">{children}</div>
    </div>
  );
}
