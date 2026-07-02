import "server-only";
import type { Locale, Notification, NotifKind } from "@prisma/client";
import { renderEmailLayout } from "@/lib/email";

/**
 * Bilingual email copy for notification kinds (spec/06-ui-ux.md §5, spec/04-features.md §9).
 * Shares the layout wrapper from src/lib/email.ts (serif heading, one accent button,
 * plain-text alternative). This file owns per-kind subject/body copy only.
 */

export interface NotificationEmailContent {
  subject: string;
  heading: string;
  bodyHtml: string;
  bodyText: string;
  buttonText: string;
}

interface CopyEntry {
  subject: string;
  heading: string;
  body: string;
  button: string;
}

const COPY: Record<NotifKind, Record<Locale, CopyEntry>> = {
  CHAT_MESSAGE: {
    sk: {
      subject: "Nová správa v ArchiTrack",
      heading: "Máte novú správu",
      body: "V projekte pribudla nová správa v chate. Otvorte ArchiTrack a odpovedzte.",
      button: "Otvoriť chat",
    },
    en: {
      subject: "New message in ArchiTrack",
      heading: "You have a new message",
      body: "A new chat message was posted in your project. Open ArchiTrack to reply.",
      button: "Open chat",
    },
  },
  COMMENT: {
    sk: {
      subject: "Nový komentár v ArchiTrack",
      heading: "Niekto pridal komentár",
      body: "Vo vašom projekte pribudol nový komentár. Pozrite si ho v ArchiTrack.",
      button: "Zobraziť komentár",
    },
    en: {
      subject: "New comment in ArchiTrack",
      heading: "Someone left a comment",
      body: "A new comment was added in your project. View it in ArchiTrack.",
      button: "View comment",
    },
  },
  TASK_STATUS: {
    sk: {
      subject: "Zmena stavu úlohy",
      heading: "Stav úlohy sa zmenil",
      body: "Stav jednej z úloh vo vašom projekte sa zmenil.",
      button: "Zobraziť úlohu",
    },
    en: {
      subject: "Task status changed",
      heading: "A task status has changed",
      body: "One of the tasks in your project changed status.",
      button: "View task",
    },
  },
  FILE_ADDED: {
    sk: {
      subject: "Nový súbor v projekte",
      heading: "Pribudol nový dokument",
      body: "Do vášho projektu bol nahraný nový dokument.",
      button: "Zobraziť dokumenty",
    },
    en: {
      subject: "New file in your project",
      heading: "A new document was added",
      body: "A new document was uploaded to your project.",
      button: "View documents",
    },
  },
  PHASE_DONE: {
    sk: {
      subject: "Fáza projektu bola dokončená",
      heading: "Fáza je hotová",
      body: "Jedna z fáz vášho projektu bola označená ako dokončená.",
      button: "Zobraziť postup",
    },
    en: {
      subject: "A project phase is complete",
      heading: "Phase completed",
      body: "One of the phases in your project was marked as done.",
      button: "View progress",
    },
  },
  MILESTONE: {
    sk: {
      subject: "Míľnik dosiahnutý",
      heading: "Dosiahli ste míľnik",
      body: "Vo vašom projekte bol dosiahnutý dôležitý míľnik.",
      button: "Zobraziť postup",
    },
    en: {
      subject: "Milestone reached",
      heading: "You reached a milestone",
      body: "An important milestone was reached in your project.",
      button: "View progress",
    },
  },
  INVITE: {
    sk: {
      subject: "Udalosť pozvánky v ArchiTrack",
      heading: "Aktualizácia pozvánky",
      body: "Nastala zmena súvisiaca s pozvánkou používateľa.",
      button: "Zobraziť projekt",
    },
    en: {
      subject: "Invite event in ArchiTrack",
      heading: "Invite update",
      body: "There was an update related to a user invite.",
      button: "View project",
    },
  },
  EXPIRY_WARNING: {
    sk: {
      subject: "Platnosť dokumentu čoskoro vyprší",
      heading: "Dokument čoskoro stráca platnosť",
      body: "Platnosť jedného z dokumentov vo vašom projekte čoskoro vyprší.",
      button: "Zobraziť dokument",
    },
    en: {
      subject: "A document is expiring soon",
      heading: "Document expiring soon",
      body: "One of the documents in your project is about to expire.",
      button: "View document",
    },
  },
};

function deepLinkFor(notification: Pick<Notification, "kind" | "projectId" | "entityId">): string {
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  if (!notification.projectId) return appUrl;

  const base = `${appUrl}/projects/${notification.projectId}`;
  switch (notification.kind) {
    case "CHAT_MESSAGE":
      return `${base}/chat`;
    case "COMMENT":
    case "TASK_STATUS":
    case "PHASE_DONE":
    case "MILESTONE":
      return `${base}/tasks`;
    case "FILE_ADDED":
    case "EXPIRY_WARNING":
      return `${base}/files`;
    default:
      return base;
  }
}

/** Build the subject/HTML/text for a single notification, per the recipient's locale. */
export function buildNotificationEmail(
  notification: Pick<Notification, "kind" | "projectId" | "entityId">,
  locale: Locale,
): NotificationEmailContent {
  const copy = COPY[notification.kind][locale];
  const url = deepLinkFor(notification);

  const html = renderEmailLayout({
    heading: copy.heading,
    bodyHtml: `<p>${copy.body}</p>`,
    buttonText: copy.button,
    buttonUrl: url,
  });

  return {
    subject: copy.subject,
    heading: copy.heading,
    bodyHtml: html,
    bodyText: `${copy.heading}\n\n${copy.body}\n\n${copy.button}: ${url}`,
    buttonText: copy.button,
  };
}

/** Daily digest email grouping several notifications by project (spec/04-features.md §9: "digest groups by project"). */
export function buildDigestEmail(
  locale: Locale,
  groups: { projectName: string; items: { kind: NotifKind; count: number }[] }[],
): { subject: string; html: string; text: string } {
  const isSk = locale === "sk";
  const subject = isSk ? "Denný prehľad z ArchiTrack" : "Your daily ArchiTrack digest";
  const heading = isSk ? "Denný prehľad" : "Daily digest";
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";

  const kindLabel = (kind: NotifKind): string => COPY[kind][locale].heading;

  const bodyHtml = groups
    .map((group) => {
      const items = group.items
        .map((item) => `<li>${kindLabel(item.kind)}${item.count > 1 ? ` × ${item.count}` : ""}</li>`)
        .join("");
      return `<p style="margin:16px 0 4px"><strong>${group.projectName}</strong></p><ul style="margin:0;padding-left:20px">${items}</ul>`;
    })
    .join("");

  const html = renderEmailLayout({
    heading,
    bodyHtml: bodyHtml || `<p>${isSk ? "Žiadne nové udalosti." : "No new activity."}</p>`,
    buttonText: isSk ? "Otvoriť ArchiTrack" : "Open ArchiTrack",
    buttonUrl: appUrl,
  });

  const text = groups
    .map(
      (group) =>
        `${group.projectName}:\n` + group.items.map((i) => `- ${kindLabel(i.kind)} x${i.count}`).join("\n"),
    )
    .join("\n\n");

  return { subject, html, text: text || (isSk ? "Žiadne nové udalosti." : "No new activity.") };
}
