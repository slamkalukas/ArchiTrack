import { requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { ProfileView } from "@/features/portal/components/profile-view";
import type { AppLocale } from "@/i18n/config";

/**
 * Admin Settings (sidebar entry per spec/06-ui-ux.md §2): the architect's own profile —
 * name/phone, password, language, e-mail digest, GDPR export. Reuses the portal
 * ProfileView (which renders its own heading) and the shared /api/me endpoints.
 */
export default async function AdminSettingsPage() {
  const sessionUser = await requireRole("ADMIN");
  const user = await db.user.findUniqueOrThrow({
    where: { id: sessionUser.id },
    select: { name: true, email: true, locale: true, phone: true, emailDigest: true },
  });

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <ProfileView
        user={{
          name: user.name,
          email: user.email,
          locale: user.locale as AppLocale,
          phone: user.phone,
          emailDigest: user.emailDigest,
        }}
      />
    </div>
  );
}
