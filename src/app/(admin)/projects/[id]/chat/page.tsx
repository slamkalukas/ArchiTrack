import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireProjectAccess } from "@/lib/authz";
import { ProjectTabNav } from "@/components/layout/project-tab-nav";
import { ChatPanel } from "@/features/chat/components/chat-panel";

/**
 * Admin "Chat" tab (spec/06-ui-ux.md §2 tab nav, §3.5 chat screen; spec/04-features.md §6).
 * WP-3 owns `src/app/(admin)/projects/**` for the overview/settings tabs and will bring
 * its own project detail layout; this route is created here (per WP-6 instructions) so
 * the Chat tab exists at the spec-correct path even though WP-3's placeholder tree isn't
 * present in this worktree. It renders the same `ProjectTabNav` used elsewhere so the
 * tab strip looks correct standalone, and will simply nest under WP-3's shared project
 * layout once branches are integrated (Next.js layouts compose by directory).
 */
export default async function ProjectChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  await requireProjectAccess(projectId, "ADMIN");

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true, status: true },
  });
  if (!project) notFound();

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-6 pt-6">
        <h1 className="font-serif text-2xl text-foreground">{project.name}</h1>
        <ProjectTabNav projectId={project.id} className="mt-4" />
      </div>
      <div className="flex-1 overflow-hidden px-6 py-4">
        <div className="h-full overflow-hidden rounded-xl border border-border bg-card">
          <ChatPanel projectId={project.id} readOnly={project.status === "ARCHIVED"} />
        </div>
      </div>
    </div>
  );
}
