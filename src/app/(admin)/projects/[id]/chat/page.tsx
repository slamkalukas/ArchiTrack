import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireProjectAccess } from "@/lib/authz";
import { ChatPanel } from "@/features/chat/components/chat-panel";

/**
 * Admin "Chat" tab (spec/06-ui-ux.md §2 tab nav, §3.5 chat screen; spec/04-features.md §6).
 * The project header and tab nav come from WP-3's shared project-detail layout; this page
 * renders only the tab content.
 */
export default async function ProjectChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  await requireProjectAccess(projectId, "ADMIN");

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { id: true, status: true },
  });
  if (!project) notFound();

  return (
    <div className="h-[calc(100vh-16rem)] overflow-hidden rounded-xl border border-border bg-card">
      <ChatPanel projectId={project.id} readOnly={project.status === "ARCHIVED"} />
    </div>
  );
}
