import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

/**
 * Nodemailer transport + sendMail helper (spec/02-architecture.md §1, §3).
 * Credentials come exclusively from `.env` (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`,
 * `SMTP_PASS`, `SMTP_FROM`) — see `.env.example`.
 */

const globalForMail = globalThis as unknown as { mailTransporter: Transporter | undefined };

function createTransporter(): Transporter {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    // Dev/test fallback: log emails instead of sending, so the app still boots and
    // flows (invite, reset password) are exercisable without real SMTP credentials.
    return nodemailer.createTransport({ jsonTransport: true });
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export function getMailTransporter(): Transporter {
  if (!globalForMail.mailTransporter) {
    globalForMail.mailTransporter = createTransporter();
  }
  return globalForMail.mailTransporter;
}

export interface SendMailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface SendMailResult {
  messageId: string;
  /** Present only when using the dev jsonTransport fallback — handy for tests/logging. */
  devPayload?: unknown;
}

/**
 * Send an email via the configured SMTP transport. Falls back to a JSON "dry run"
 * transport when SMTP env vars are absent (local dev without a mail server), logging the
 * message instead of failing the request.
 */
export async function sendMail(input: SendMailInput): Promise<SendMailResult> {
  const transporter = getMailTransporter();
  const from = process.env.SMTP_FROM ?? "ArchiTrack <noreply@architrack.local>";

  const info = await transporter.sendMail({
    from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });

  const isJsonTransport = typeof (info as { message?: unknown }).message === "string";
  if (isJsonTransport) {
    console.info(`[email:dev] to=${input.to} subject="${input.subject}"`);
    return {
      messageId: info.messageId ?? "dev",
      devPayload: JSON.parse((info as { message: string }).message),
    };
  }

  return { messageId: info.messageId };
}

/** Minimal shared HTML wrapper for transactional emails — bilingual templates build on this (spec/06-ui-ux.md §5). */
export function renderEmailLayout(opts: { heading: string; bodyHtml: string; buttonText?: string; buttonUrl?: string }): string {
  const button =
    opts.buttonText && opts.buttonUrl
      ? `<p style="margin:32px 0 0"><a href="${opts.buttonUrl}" style="background:#2F5D50;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-family:sans-serif;display:inline-block">${opts.buttonText}</a></p>`
      : "";

  return `<!doctype html>
<html>
  <body style="margin:0;padding:32px;background:#FAFAF8;font-family:sans-serif;color:#1A1A1A">
    <table role="presentation" width="100%" style="max-width:520px;margin:0 auto;background:#FFFFFF;border-radius:12px;padding:32px;border:1px solid #E5E5E0">
      <tr><td>
        <h1 style="font-family:Georgia,serif;font-size:22px;margin:0 0 16px">${opts.heading}</h1>
        <div style="font-size:15px;line-height:1.6;color:#1A1A1A">${opts.bodyHtml}</div>
        ${button}
      </td></tr>
    </table>
  </body>
</html>`;
}
