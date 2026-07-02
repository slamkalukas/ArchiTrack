# Functional Specification

Each feature lists behavior + acceptance criteria (AC). "Architect" = ADMIN role,
"Client" = CLIENT role. Everything client-facing must respect the visibility rules in
`03-data-model.md` §3.

## 1. Authentication & accounts

- Login with email + password. Password reset via email link (1 h validity).
- Architect creates client accounts from project settings → **invite email** (SK/EN by
  chosen locale) with a link; client sets password and name, lands in their project.
- Invites expire after 14 days; can be re-sent. A user can belong to many projects.
- Session lifetime 30 days rolling. Logout everywhere (invalidate by rotating user token version).

AC: unauthenticated access to any app page redirects to login; accepting an invite twice
shows a friendly "already used" screen; a CLIENT hitting an admin URL gets 404 (not 403 —
don't leak existence).

## 2. Admin dashboard

- Cards per ACTIVE project: cover image, name, client names, current phase, project
  progress %, unread chat count, next due task, badges for "expiring vyjadrenia" (files
  with `validUntil` within 30 days) and overdue tasks.
- Filters: status (active/on hold/archived), text search. Sort: recent activity.
- Global "Inbox" panel: latest notifications across projects.

AC: dashboard loads in one query round-trip (aggregate via Prisma `$queryRaw` or grouped
queries — no N+1); counts match reality after any mutation (revalidate).

## 3. Project creation & settings

- New project wizard: name, client contact(s) (create user + invite now or later),
  location, cover image, template selection ("Rodinný dom SK" or blank), prune template
  phases/tasks in step 2 (checkboxes), confirm.
- Settings tab: edit metadata, manage members (add/remove client users, resend invites),
  manage contacts (statik etc.), archive project (client access frozen to read-only,
  hidden from client home after 90 days), phase weights editor.

AC: applying the template creates phases, tasks, and the folder tree per
`01-domain-analysis.md`; pruning in the wizard removes both tasks and their folders;
archiving immediately blocks client chat input.

## 4. Phases & tasks (kanban)

- Phase list (ordered, collapsible) with status chips and per-phase progress bars.
- Board view per project (default) and per phase: columns **To-do / In progress / Done**;
  drag & drop between columns and to reorder (dnd-kit). List view toggle with sort by due date.
- Task modal: title, description (markdown-lite), phase, status, due date, weight,
  milestone flag, visibility toggle ("Visible to client"), assignee (Architect /
  External → pick Contact), comments thread (if client-visible, clients see & write).
- Marking the last task of a phase Done prompts: "Mark phase as done?" Phase done →
  next UPCOMING phase becomes ACTIVE (confirmable).
- Client sees client-visible tasks read-only (status + title + description + due date),
  grouped by phase, plus milestones on a timeline. Clients cannot move tasks.

AC: drag & drop persists `(status, order)` and is optimistic with rollback on failure;
progress % recomputes immediately; a task made client-visible generates a notification
to clients only if its phase is client-visible.

## 5. Files

- Folder tree seeded from template (per phase; professions as sub-folders of "Profesie";
  plus system folder **"Od klienta" / "From client"** where clients can upload).
- Upload: drag & drop multi-file, progress bars, max size from env; allowlist per
  `02-architecture.md` §4. Uploading a file with an identical name into the same folder
  creates a **new version** (v1, v2…) with "restore/download previous versions".
- Per-file: rename, move, toggle client visibility, set `validUntil`, delete (soft if
  client-visible ever, else hard), download, preview (PDF inline viewer, image lightbox
  with thumbnails).
- Client view: only visible folders/files; prominent "Latest documents" section on their
  project home; download all as ZIP (server streams, visible files only).
- Comments on files (see §7).

AC: direct URL of a storageKey returns 404 without auth; a client can never see an
INTERNAL file even via version history, comments, ZIP export, or search; thumbnails
appear for images ≤ 50 MB; ZIP of 1 GB project streams without OOM.

## 6. Chat

- One thread per project. Participants: architect + that project's clients.
- Composer: text (markdown-lite: bold, italics, links, line breaks) + attachments
  (files land in the "Od klienta" folder when uploaded by clients, "Chat" folder when
  by the architect, and are auto `CLIENT_VISIBLE` because both sides saw them).
- Messages: edit (15 min window), soft delete; day separators; sender avatars; read
  receipts ("Seen") based on `ChatRead`; typing indicator via SSE (ephemeral, optional).
- Unread badge per project (admin dashboard + client header). New message → SSE push;
  if recipient has no open session in 5 min → email notification (respecting digest pref).

AC: messages arrive < 1 s for online users; unread counts survive reload; deleted
message shows placeholder for both sides; attachments obey the file authorization path.

## 7. Comments

- On tasks (client-visible only, for clients) and on files. One level of threading (reply).
- Mentions not required in v1 (only two parties). Edit/delete own comments (soft delete).
- Each comment notifies the other party (in-app + email rules as chat).

AC: a client cannot comment on internal entities even by ID probing; comment counts
show on file rows and task cards.

## 8. Client portal (the "representative" part)

- Client home = their project (or project switcher if multiple): hero with cover image,
  project name, elegant **progress ring**, current phase description in plain language,
  milestone timeline (done/upcoming), "Latest documents", "Recent updates" feed
  (activity filtered to client-visible events), chat entry point.
- Tabs: Prehľad (Overview) · Postup (Progress = phases & tasks) · Dokumenty (Files) ·
  Správy (Chat). Naming per i18n catalog.
- Zero empty-state dead ends: every empty tab explains what will appear there.

AC: everything reachable in ≤ 2 clicks from client home; fully responsive at 360 px;
Lighthouse a11y score ≥ 95 on client pages.

## 9. Notifications

- In-app bell with list (mark read, mark all read). Sources: chat message, comment,
  task status change (client-visible ones → clients), file added (client-visible →
  clients), phase done, milestone reached, expiring `validUntil` (architect only,
  30/7 days before), invite events (architect only).
- Email: immediate per event, or daily digest at 07:00 server time (user preference,
  default: clients immediate, architect digest). All emails bilingual templates,
  branded, with deep links.

AC: no notification is ever generated for content the recipient cannot see; digest
groups by project; unsubscribing from email keeps in-app intact.

## 10. Activity log

- Per project, admin-only tab: chronological actions (uploads, status changes,
  visibility changes, logins of clients optional off). Client "Recent updates" feed is
  the filtered, friendly-worded subset.

AC: every mutating endpoint writes exactly one ActivityLog row (enforced via shared
helper `logActivity()` — code review checklist item).

## 11. i18n & localization

- next-intl; locales `sk` (default), `en`; per-user `locale` switchable in profile and
  on the login screen. **No hard-coded user-facing strings** — CI greps for violations.
- Dates: `dd. MM. yyyy` (sk) / locale-appropriate (en); timezone Europe/Bratislava.
- Template phase/task names use `templateKey` translations when present; custom names
  stay as typed.

AC: switching locale re-renders everything including emails sent afterwards; both
catalogs 100 % complete (CI check compares key sets).

## 12. GDPR & data

- Profile: export my data (JSON of user + their messages/comments). Admin can
  deactivate a client (login blocked, content retained) or anonymize (name → "Bývalý
  klient", email removed) — hard user deletion only if no content.
- Privacy note page (static, SK/EN placeholder text to be replaced by owner).

## 13. Out of scope for v1 (explicitly)

Invoicing, calendar sync, multi-tenant/team roles UI, push notifications, native apps,
URBION integration, DWG in-browser rendering (download only), full-text search inside
PDFs.
