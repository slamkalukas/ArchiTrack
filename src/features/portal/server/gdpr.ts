import "server-only";
import { db } from "@/lib/db";
import { sendMail, renderEmailLayout } from "@/lib/email";
import type { SessionUser } from "@/lib/authz";

/**
 * GDPR data export (spec/04-features.md §12, spec/05-api.md §8 `GET /api/me/export`):
 * "JSON of user + their messages/comments". Scoped to exactly what the user authored or
 * owns — never another user's content, never internal-only fields from other entities.
 */
export async function buildUserDataExport(userId: string) {
  const [user, memberships, messages, comments, notifications] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        locale: true,
        phone: true,
        emailDigest: true,
        createdAt: true,
      },
    }),
    db.projectMember.findMany({
      where: { userId },
      select: { addedAt: true, project: { select: { id: true, name: true } } },
    }),
    db.chatMessage.findMany({
      where: { authorId: userId },
      orderBy: { createdAt: "asc" },
      select: { id: true, projectId: true, body: true, createdAt: true, editedAt: true, deletedAt: true },
    }),
    db.comment.findMany({
      where: { authorId: userId },
      orderBy: { createdAt: "asc" },
      select: { id: true, taskId: true, fileId: true, body: true, createdAt: true, deletedAt: true },
    }),
    db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { id: true, kind: true, titleKey: true, createdAt: true, readAt: true },
    }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    profile: user,
    projects: memberships.map((m) => ({
      projectId: m.project.id,
      projectName: m.project.name,
      memberSince: m.addedAt,
    })),
    chatMessages: messages,
    comments,
    notifications,
  };
}

/**
 * Client-initiated account deletion request (spec/04-features.md §12: admin actions are
 * "deactivate"/"anonymize"; there is no self-service hard-delete endpoint in v1). This
 * portal-owned flow emails every ADMIN so they can action it manually — no schema change
 * needed for a request flag, and it keeps the audit trail in the architect's inbox.
 */
export async function requestAccountDeletion(user: SessionUser): Promise<void> {
  const admins = await db.user.findMany({
    where: { role: "ADMIN", isActive: true },
    select: { email: true, locale: true },
  });

  await Promise.all(
    admins.map(async (admin) => {
      const isSk = admin.locale === "sk";
      const heading = isSk ? "Žiadosť o vymazanie konta" : "Account deletion request";
      const body = isSk
        ? `Klient <strong>${escapeHtml(user.name)}</strong> (${escapeHtml(user.email)}) požiadal o vymazanie svojho konta v ArchiTrack. Posúďte žiadosť a konto podľa potreby deaktivujte alebo anonymizujte v nastaveniach projektu.`
        : `Client <strong>${escapeHtml(user.name)}</strong> (${escapeHtml(user.email)}) has requested deletion of their ArchiTrack account. Review the request and deactivate or anonymize the account from project settings as appropriate.`;

      const html = renderEmailLayout({ heading, bodyHtml: `<p>${body}</p>` });
      const text = `${heading}\n\n${user.name} (${user.email}) — ${isSk ? "žiadosť o vymazanie konta" : "account deletion request"}.`;

      try {
        await sendMail({
          to: admin.email,
          subject: isSk ? "Žiadosť o vymazanie konta — ArchiTrack" : "Account deletion request — ArchiTrack",
          html,
          text,
        });
      } catch (error) {
        // Best-effort per admin — a broken SMTP config (or one bad admin address) must
        // not fail the client's deletion request as a whole. See the matching fix in
        // src/app/api/projects/[id]/members/route.ts.
        console.error("[gdpr] deletion-request email failed to send", error);
      }
    }),
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
