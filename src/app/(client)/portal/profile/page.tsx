import { requireUser } from "@/lib/authz";
import { db } from "@/lib/db";
import { ProfileView } from "@/features/portal/components/profile-view";
import type { AppLocale } from "@/i18n/config";

/**
 * Client "Profil" tab (spec/04-features.md §8, §12): profile fields + GDPR actions.
 * Route: /portal/profile.
 */
export default async function PortalProfilePage() {
  const sessionUser = await requireUser();
  const user = await db.user.findUniqueOrThrow({
    where: { id: sessionUser.id },
    select: { name: true, email: true, locale: true, phone: true, emailDigest: true },
  });

  return (
    <ProfileView
      user={{
        name: user.name,
        email: user.email,
        locale: user.locale as AppLocale,
        phone: user.phone,
        emailDigest: user.emailDigest,
      }}
    />
  );
}
