import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/shared/empty-state";
import type { PortalActivityItem } from "@/features/portal/types";

interface ActivityFeedProps {
  items: PortalActivityItem[];
}

/**
 * Friendly-worded "Aktuality" feed (spec/06-ui-ux.md §3.6 step 4: "Ing. arch. pridala 3
 * nové výkresy"). Maps the raw ActivityLog `action` string to a translated sentence —
 * the same allowlist the server already restricted to (spec/04-features.md §10).
 */
export async function ActivityFeed({ items }: ActivityFeedProps) {
  const t = await getTranslations("portal.activity");

  if (items.length === 0) {
    return <EmptyState title={t("emptyTitle")} description={t("emptyDescription")} className="py-10" />;
  }

  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.id} className="flex items-start justify-between gap-3 text-sm">
          <span className="text-foreground">{translateAction(t, item.textKey)}</span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {new Date(item.createdAt).toLocaleDateString()}
          </span>
        </li>
      ))}
    </ul>
  );
}

function translateAction(t: Awaited<ReturnType<typeof getTranslations>>, action: string): string {
  const key = action.replace(/\./g, "_");
  try {
    return t(key as Parameters<typeof t>[0]);
  } catch {
    return t("fallback");
  }
}
