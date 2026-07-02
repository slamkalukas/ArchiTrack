import { requireRole } from "@/lib/authz";
import { listTemplates } from "@/features/projects";
import { ProjectWizard } from "@/features/projects/components/project-wizard";

/** New project creation wizard route (spec/04-features.md §3). */
export default async function NewProjectPage() {
  await requireRole("ADMIN");
  const templates = await listTemplates();

  return <ProjectWizard templates={templates} />;
}
