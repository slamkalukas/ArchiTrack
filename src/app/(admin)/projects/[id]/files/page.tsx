import { requireProjectAccess } from "@/lib/authz";
import { FilesView } from "@/features/files";

/**
 * Admin Files tab (spec/06-ui-ux.md §3.4, spec/04-features.md §5).
 * Route: /projects/:id/files — matches `ProjectTabNav`'s `files` link.
 */
export default async function ProjectFilesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const { user } = await requireProjectAccess(projectId);

  return <FilesView projectId={projectId} role={user.role} />;
}
