import "server-only";
import type { Locale, Notification, User } from "@prisma/client";
import { sendMail } from "@/lib/email";
import { buildNotificationEmail } from "@/features/notifications/emails/templates";

type EmailRecipient = Pick<User, "email" | "locale" | "name">;

/** Send a single-event transactional notification email (spec/06-ui-ux.md §5). */
export async function sendNotificationEmail(
  recipient: EmailRecipient,
  notification: Pick<Notification, "kind" | "projectId" | "entityId">,
): Promise<void> {
  const locale: Locale = recipient.locale;
  const content = buildNotificationEmail(notification, locale);

  await sendMail({
    to: recipient.email,
    subject: content.subject,
    html: content.bodyHtml,
    text: content.bodyText,
  });
}
