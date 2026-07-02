import { notFound } from "next/navigation";
import { requireProjectAccess } from "@/lib/authz";
import { db } from "@/lib/db";
import { ProjectTabNav } from "@/components/layout/project-tab-nav";

/**
 * Shared shell for all `/projects/:id/*` admin pages: horizontal tab nav per
 * spec/06-ui-ux.md §2 (Overview · Phases & Tasks · Files · Chat · Activity · Settings).
 * WP-4/5/6 own the Tasks/Files/Chat tab *content*; this layout (owned by WP-3) is what
 * makes those tabs navigable and provides the project header above them.
 */
export default async function ProjectDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  try {
    await requireProjectAccess(id, "ADMIN");
  } catch {
    notFound();
  }

  const project = await db.project.findUnique({ where: { id }, select: { name: true } });
  if (!project) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="font-serif text-2xl text-foreground">{project.name}</h1>
      <ProjectTabNav projectId={id} className="mt-4" />
      <div className="mt-6">{children}</div>
    </div>
  );
}
