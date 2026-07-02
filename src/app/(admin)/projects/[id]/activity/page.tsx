import { requireProjectAccess } from "@/lib/authz";
import { db } from "@/lib/db";
import { EmptyState } from "@/components/shared";
import { getTranslations } from "next-intl/server";

/** Activity tab: chronological log of every mutating action (spec/04-features.md §10). */
export default async function ProjectActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireProjectAccess(id, "ADMIN");
  const t = await getTranslations("projects.detail.overview");

  const [entries, actors] = await db.$transaction(async (tx) => {
    const logs = await tx.activityLog.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    const actorIds = Array.from(new Set(logs.map((l) => l.actorId)));
    const users = actorIds.length
      ? await tx.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } })
      : [];
    return [logs, users];
  });

  const actorName = new Map(actors.map((a) => [a.id, a.name]));

  if (entries.length === 0) {
    return <EmptyState title={t("noActivity")} />;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <table className="w-full text-sm">
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id} className="border-b border-border last:border-none">
              <td className="px-4 py-2.5 text-muted-foreground">
                {entry.createdAt.toLocaleString("sk-SK")}
              </td>
              <td className="px-4 py-2.5 text-foreground">{actorName.get(entry.actorId) ?? "—"}</td>
              <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{entry.action}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
