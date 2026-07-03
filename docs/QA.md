# QA report — WP-8

This document records the QA pass done for WP-8 (final work package): the full
end-to-end suite, the visibility leak-probe results, the accessibility audit, and the
rate-limiting verification. See `spec/07-agent-workplan.md` §WP-8 for the brief and
`spec/05-api.md` §9 for the security requirements being verified.

## 1. End-to-end suite

All specs live in `tests/e2e/` and run against the single shared Playwright config
(`playwright.config.ts`, port 3100, single worker — the suite runs against one dev
server, see the config's own comments for why). Run with:

```
pnpm test:e2e
```

or, from a cold server (recommended before release, and what CI does):

```
npx kill-port 3100   # or the platform equivalent — see below for Windows
pnpm exec playwright test
```

On Windows/Git Bash, `npx kill-port` may not be on PATH; an equivalent is:

```
for pid in $(netstat -ano | grep ":3100" | grep LISTENING | awk '{print $5}' | sort -u); do taskkill //F //PID "$pid"; done
```

### Specs and what they cover

| Spec | Covers |
|---|---|
| `login.spec.ts` | WP-2 happy path: login screen renders, seed admin signs in |
| `wp3-project-wizard.spec.ts` | WP-3: project creation wizard, template pruning |
| `tasks.spec.ts` | WP-4: kanban create/move task, phase progress recompute |
| `wp5-files-upload.spec.ts` | WP-5: upload → list → authorized download |
| `chat.spec.ts` | WP-6: admin→client chat message + unread notification |
| `wp7-client-portal.spec.ts` | WP-7: client login lands in portal, tours all 4 tabs |
| `wp8-invite-flow.spec.ts` | Full invite flow: admin invites a new client from Settings → Members, token is read from the DB (dev email transport is JSON-only, see §1.1 below), new client sets a password, lands in the portal seeing the project |
| `wp8-publish-file.spec.ts` | Admin uploads two files (root, private by default), publishes one via the visibility toggle; client sees + downloads the published one, cannot see the still-internal one (UI listing **and** direct API probe) |
| `wp8-chat-bidirectional.spec.ts` | Client → admin chat direction (complements `chat.spec.ts`'s admin → client), plus the notification bell's unread flag actually clearing via `POST /api/notifications/read` |
| `wp8-kanban-client-progress.spec.ts` | Admin completes a task on the kanban board; the client's Postup tab shows the same updated phase percentage; the (internal-by-default) task itself does not leak into the client's task list |
| `wp8-visibility-leak-probes.spec.ts` | The security-critical suite — see §2 below |
| `wp8-rate-limit.spec.ts` | Auth endpoint returns 429 once the per-IP bucket is exhausted (real server, spoofed IP so it doesn't interfere with the rest of the suite's shared login bucket) |
| `wp8-a11y.spec.ts` | Automated accessibility audit — see §3 below |

### 1.1 How the invite flow test reads the invite link

`src/lib/email.ts` falls back to Nodemailer's `jsonTransport` whenever `SMTP_HOST` /
`SMTP_USER` / `SMTP_PASS` aren't all set — in that mode it never actually connects to an
SMTP server, just logs `[email:dev] to=... subject="..."` and returns the composed
message as `devPayload`. In dev/test, however, `.env` (and `.github/workflows/ci.yml`)
set *placeholder* SMTP values that look "real" (a host, user, and pass are all present),
so the fallback doesn't trigger and `sendMail()` genuinely tries to reach
`smtp.example.com` — which fails. This turned out to be a real bug (see §4) rather than
just a test inconvenience: it was fixed so a broken/placeholder SMTP config never fails
the underlying request (the invite/membership is already committed to the DB before the
email step). The e2e test itself reads the invite token straight from the `Invite` table
via Prisma — the same thing a human tester would do by checking the dev mail log.

## 2. Visibility leak-probe results (spec/05-api.md §9.3)

`tests/e2e/wp8-visibility-leak-probes.spec.ts` logs in as the demo **CLIENT**
(`klient@architrack.local`) and issues direct API requests for entities the client must
not be able to see, in two categories:

1. **Cross-project IDOR** — a second project is created directly via Prisma (the client
   has *zero* membership in it) with a `CLIENT_VISIBLE` phase, task, folder, file, and a
   chat message. Every one of these — including entities marked `CLIENT_VISIBLE` — must
   be unreachable by a non-member, proving membership is checked independently of
   per-item visibility flags.
2. **Same-project, task/file-level visibility** — an `INTERNAL` task and an `INTERNAL`
   file are created inside the client's *own* project (the demo project they're already
   a legitimate member of). These must still 404 for the client.

Endpoints probed (all must return exactly **404**, never 403 or 200):

```
GET    /api/projects/:otherProjectId
GET    /api/projects/:otherProjectId/phases
GET    /api/projects/:otherProjectId/folders
GET    /api/projects/:otherProjectId/chat
GET    /api/projects/:otherProjectId/activity
GET    /api/projects/:otherProjectId/files/zip
PATCH  /api/tasks/:otherTaskId
GET    /api/files/:otherFileId
GET    /api/files/:otherFileId/download
GET    /api/files/:otherFileId/thumbnail
PATCH  /api/folders/:otherFolderId
GET    /api/tasks/:otherTaskId/comments
GET    /api/files/:otherFileId/comments
PATCH  /api/chat/:otherChatMessageId
DELETE /api/chat/:otherChatMessageId
GET    /api/files/:ownInternalFileId            (same project, task/file-level)
GET    /api/files/:ownInternalFileId/download
GET    /api/tasks/:ownInternalTaskId/comments
GET    /api/files/:nonexistentId                (well-formed uuid, no row at all)
GET    /api/projects/:nonexistentId
```

**Result: all pass.** Every probe returns 404. The design already in place
(`requireProjectAccess()` in `src/lib/authz.ts`, which throws a uniform `AuthzError(404,
…)` for both "not a member" and "role mismatch", plus the file/task/comment visibility
helpers in `src/features/*/server/visibility.ts` which also 404 rather than 403 on a
denied-but-existing entity) held up under every probe tried — no source changes were
needed to pass this part of the audit.

The test also asserts the folder-tree **list** endpoint
(`GET /api/projects/:id/folders`) never includes the internal folder/file's name in its
response body — i.e. the list-endpoint role-shaping requirement (§9.3 item 3), not just
direct-id probes, holds.

## 3. Accessibility audit

Spec (`spec/07-agent-workplan.md` §WP-8) asks for **Lighthouse a11y ≥ 95** on client
pages. Lighthouse itself needs a full Chrome-devtools-protocol audit pass and isn't
practical to wire into this Playwright-based suite headlessly; as a documented proxy,
`@axe-core/playwright` (axe-core is the same underlying engine Lighthouse's a11y
category uses) was added as a devDependency and used to assert **zero serious/critical
violations** (WCAG 2.0/2.1 A+AA rule sets) on:

- `/login`
- `/portal` (Prehľad)
- `/portal/progress` (Postup)
- `/portal/documents` (Dokumenty)

Run standalone with:

```
pnpm exec playwright test tests/e2e/wp8-a11y.spec.ts
```

### Violations found and fixed

1. **`aria-hidden-focus` (serious, WCAG 4.1.2)** — `PreviewDrawer`
   (`src/components/shared/preview-drawer.tsx`) is always mounted (even when closed) and
   was only marked `aria-hidden="true"` while closed; its "Close" button remained
   focusable via Tab despite being hidden from assistive tech. **Fix:** added the
   `inert` attribute alongside `aria-hidden`, which also removes the subtree from the
   tab order while hidden.

2. **`color-contrast` (serious, WCAG 1.4.3)** — the "todo"/"upcoming" status badge
   (`bg-status-todo/15 text-status-todo`, used for phase/task status chips) rendered at
   ~2.24:1 contrast against its own badge background — well under the 4.5:1 AA
   threshold for body text. Same issue for the "in-progress" badge at ~3.06:1. **Fix:**
   darkened `--status-todo` (`#9ca3af` → `#4b5563`) and `--status-in-progress`
   (`#b07c3f` → `#7a5427`) in `src/app/globals.css`, keeping each color's hue but
   bringing text contrast comfortably over 4.5:1 (verified 6.69:1 and 5.69:1
   respectively). `--status-done` (`#2f5d50`) already passed at 6.42:1 — untouched.

3. **`aria-label` / `non-empty-title` (serious, WCAG 1.1.1)** — every `role="progressbar"`
   element (the shadcn `Progress` bar and the custom `ProgressRing`) had no accessible
   name. **Fix:** added a new append-only i18n key, `common.progressLabel` (`"Priebeh:
   {percent} %"` / `"Progress: {percent}%"`), and wired an `aria-label` using it at every
   call site: `ProgressRing` (portal hero + admin project overview), the shadcn
   `Progress` component's call sites in `progress-phase-card.tsx` (Postup),
   `phase-accordion.tsx` (admin kanban), and `project-card.tsx` (dashboard project
   cards). The dev-only `/dev/ui` component showcase was left as-is (not a real
   end-user-facing page).

After these three fixes, all four audited pages report **zero serious/critical
violations**. Minor/moderate-impact axe findings (if any linger — e.g. informational
`best-practice` tag violations) were not chased further, matching the "serious/critical
violation-free" proxy bar stated in the WP-8 brief.

## 4. Real bugs found and fixed while building the e2e suite

The brief allows small, minimal fixes anywhere in `src/` when tests uncover a real bug.
Two were found:

1. **Unguarded `sendMail()` calls could 500 an otherwise-successful request.**
   `src/lib/email.ts`'s dev-transport fallback only activates when `SMTP_HOST` /
   `SMTP_USER` / `SMTP_PASS` are *all absent*; both `.env` (local dev) and
   `.github/workflows/ci.yml` (CI) set placeholder-but-present SMTP values, so
   `sendMail()` genuinely tries to reach `smtp.example.com` and throws
   `ENOTFOUND`. Several routes awaited that call *after* already committing the
   real mutation (new membership + invite row, a new project, a password-reset
   token, a GDPR deletion-request notice) — so a broken mail config turned a
   successful mutation into a 500 for the caller, or (for
   `forgot-password`, whose contract is "always 200 to avoid leaking account
   existence") into a **contract-breaking 500** whenever the email happened to be a
   real active user.

   Fixed by wrapping each `sendMail()` call in a local try/catch that logs and
   continues, in:
   - `src/app/api/projects/[id]/members/route.ts` (invite a client)
   - `src/app/api/projects/[id]/invites/[userId]/resend/route.ts` (resend invite)
   - `src/app/api/projects/route.ts` (create project with initial clients)
   - `src/app/api/auth/forgot-password/route.ts` (password reset)
   - `src/features/portal/server/gdpr.ts` (`requestAccountDeletion`, per-admin)

   (`src/features/notifications/server/notify.ts`'s two email call sites already had
   this exact guard — no change needed there. `src/features/notifications/server/
   digest.ts`, the daily digest cron job, was left as-is: it's not a user-facing
   request path and stopping a batch loop early on a mail error is a separate,
   lower-priority concern than breaking a live HTTP request.)

2. **`SettingsView` never resynced after `router.refresh()`.**
   `src/features/projects/components/settings-view.tsx` seeded its `current` state via
   a plain `useState(project)` — that initializer only runs on the component's first
   render. Every settings mutation that *doesn't* also call `setCurrent` locally (adding
   a member, adding a contact, changing phase weights — anything routed only through the
   shared `refresh()` → `router.refresh()` path) re-rendered the *parent* server
   component with fresh data, but the already-mounted `SettingsView` client component
   kept its stale first-render `current` forever, so the UI silently never showed the
   change (confirmed live: a newly invited client's row never appeared in the Members
   list, even though the server-side `POST` had already returned 201 and the row existed
   in the DB). Fixed using the React-documented "adjust state during render when a prop
   changes" pattern (comparing `project` against a `prevProject` state slice and
   resetting `current` inline during render, rather than via a `useEffect` — the
   codebase's lint config forbids `setState` calls inside effect bodies). This was
   the actual root cause behind the invite-flow e2e test's initial failure, not a test
   bug.

## 5. Rate limiting (spec/05-api.md §9.4)

Two layers of coverage:

- **Unit** (`tests/unit/rate-limit.test.ts`): isolates `TokenBucketRateLimiter`
  (`src/lib/rate-limit.ts`) — capacity/rejection, independent per-key buckets, token
  refill proportional to elapsed time (via fake timers), and `sweep()` eviction of idle
  buckets.
- **E2e** (`tests/e2e/wp8-rate-limit.spec.ts`): hits the real, running
  `POST /api/auth/forgot-password` endpoint over 100+ requests and asserts a 429 with
  `error.code === "rate_limited"` appears once the bucket is exhausted. Since the shared
  e2e server runs with `AUTH_RATE_LIMIT_PER_MINUTE=100` (so the rest of the suite's real
  logins don't 429 each other — see `playwright.config.ts`), this test spoofs a unique
  `x-forwarded-for` value per run so it exercises its *own* independent bucket rather
  than exhausting the one the rest of the suite's logins share.

## 6. Production Docker image: `prisma/seed.ts` was unrunnable at runtime

While validating the ops runbook's seeding step (`docker compose exec app
node_modules/.bin/tsx prisma/seed.ts`) against a real build of the production image
(`Dockerfile`), the command failed — `Cannot find package 'esbuild'` (later, after a
first fix, `Cannot find package 'dotenv/config'`). The runner stage only copies specific
`node_modules` subsets from the builder stage (`.pnpm`, `.bin`, `prisma`, `@prisma`) to
keep the final image small; `tsx` (a devDependency needed at runtime purely for this one
seeding/admin command) and its own top-level symlinks were never among them, and Node's
ESM resolver does not realpath through a symlinked `node_modules/tsx` before searching
for `tsx`'s own sibling dependency `esbuild` — so even a plain symlink copy of `tsx`
alone wasn't enough.

**Fixed** in `Dockerfile`'s runner stage by additionally copying the `tsx`, `dotenv`,
and `argon2` top-level symlinks pnpm creates for them, plus creating a top-level
`esbuild` symlink pointing at its `.pnpm` store entry (resolved dynamically at build
time via `find`, not hardcoded to a version string). Verified by actually building the
image and running `node_modules/.bin/tsx prisma/seed.ts` against a real throwaway
Postgres container — it completed successfully end-to-end (admin user, template,
demo project all created), and the normal `node server.js` boot path / `/api/health`
were re-confirmed unaffected by the change.

Also added a `.dockerignore` (didn't exist before) — `docker build` was sending
`node_modules/`, `.next/`, `.git/`, and every test/spec/docs file to the Docker daemon
as part of the build context on every build (several hundred MB, observed directly
during this validation). None of `tests/`, `docs/`, `scripts/`, or `spec/` are needed to
build or run the production image.

## 7. What's intentionally out of scope / left for the operator

- Full Lighthouse a11y scoring (only the axe-core proxy above was run — see §3).
- `src/features/notifications/server/digest.ts` (the daily digest cron entrypoint) was
  not given the same mail-error guard as the request-path routes — see §4.1. It's not
  exercised by the e2e suite (no in-process scheduler exists yet, per its own docblock)
  and is lower risk since it's an offline batch job an operator would notice failing in
  logs, not a live user-facing request.
- The production Docker Compose stack's full `docker compose up -d` (all three
  services together) was **not** run by this WP (per instructions — the orchestrator
  does that after WP-8). What *was* validated directly, by actually building the real
  `Dockerfile` and running containers against a real (throwaway) Postgres: the `app`
  image builds, boots, passes `/api/health`, and the documented seed command works (see
  §6) — plus `scripts/backup.sh` and `scripts/restore.sh`'s core operations (pg_dump,
  uploads-volume tar, retention pruning, pg_restore — see `docs/OPERATIONS.md` §2). A
  full end-to-end `docker compose up -d` → seed → backup → restore → verify-health drill
  against the *actual* three-service compose stack (with Caddy) is left for the
  operator, documented as a checklist in `docs/OPERATIONS.md`.
