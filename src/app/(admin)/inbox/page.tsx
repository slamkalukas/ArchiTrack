import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/authz";
import { InboxView } from "@/features/notifications/components/inbox-view";

/** Global admin Inbox: latest notifications across projects (spec/04-features.md §2). */
export default async function InboxPage() {
  await requireRole("ADMIN");
  const t = await getTranslations("inbox");

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="font-serif text-2xl text-foreground">{t("title")}</h1>
      <div className="mt-6">
        <InboxView />
      </div>
    </div>
  );
}
