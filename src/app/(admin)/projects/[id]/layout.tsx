import { notFound } from "next/navigation";
import { requireProjectAccess } from "@/lib/authz";
import { db } from "@/lib/db";
import { ProjectTabNav } from "@/components/layout/project-tab-nav";

/**
 * Minimal project-detail shell (header + `ProjectTabNav`) so the Files tab
 * (`/projects/:id/files`, owned by WP-5) is reachable in this worktree.
 *
 * NOTE for integration: WP-3 owns `src/app/(admin)/projects/**` long-term (overview +
 * settings tabs, richer header with cover image/status/members — spec/07-agent-workplan.md).
 * This file is intentionally minimal (just enough chrome for the Files tab to sit inside)
 * so WP-3's version can replace it wholesale without special-casing WP-5's routes.
 */
export default async function ProjectDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user } = await requireProjectAccess(id);
  void user;

  const project = await db.project.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!project) notFound();

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="font-serif text-2xl text-foreground">{project.name}</h1>
      <ProjectTabNav projectId={project.id} className="mt-6" />
      <div className="mt-6">{children}</div>
    </div>
  );
}
