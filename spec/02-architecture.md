# Technical Architecture

## 1. Stack (prescriptive)

| Layer | Choice | Rationale |
|---|---|---|
| Framework | **Next.js 15+ (App Router, TypeScript, standalone output)** | One codebase for UI + API route handlers; SSR for fast client portal; easy Docker |
| UI | **Tailwind CSS + shadcn/ui + lucide-react icons** | Fast to build, consistent, themeable to the design language in `06-ui-ux.md` |
| ORM / DB | **Prisma + PostgreSQL 16** | Typed schema shared by all agents; migrations as integration contract |
| Auth | **Auth.js (NextAuth v5), Credentials provider + email invite flow** | Self-hosted, no external IdP |
| Realtime | **Server-Sent Events (SSE)** for chat/notifications | No extra service; works through the reverse proxy; polling fallback |
| File storage | **Local filesystem volume** (`/data/uploads`), served only through an authorizing route handler | Simple, backed up with the volume; no MinIO needed at this scale |
| Email | **Nodemailer over SMTP** (credentials in `.env`) | Invites, notifications, password reset |
| i18n | **next-intl**, locales `sk` (default) and `en` | Message catalogs in `/messages/sk.json`, `/messages/en.json` |
| Validation | **Zod** shared schemas in `/src/lib/schemas` | Same validation client & server |
| Testing | **Vitest** (unit), **Playwright** (e2e) | Agents must ship tests with features |
| Lint/format | ESLint + Prettier, strict TS | Uniform output across agents |

Node 22 LTS. Package manager: **pnpm**.

## 2. Repository layout (monorepo, single app)

```
architrack/
├── docker-compose.yml
├── docker-compose.dev.yml
├── Dockerfile
├── .env.example
├── prisma/
│   ├── schema.prisma          # SINGLE SOURCE OF TRUTH for data (see 03-data-model.md)
│   ├── migrations/
│   └── seed.ts                # admin user + "Rodinný dom SK" template + demo project
├── messages/
│   ├── sk.json
│   └── en.json
├── public/
├── src/
│   ├── app/
│   │   ├── (auth)/            # login, invite acceptance, password reset
│   │   ├── (admin)/           # architect UI: dashboard, projects, settings
│   │   ├── (client)/          # customer portal
│   │   └── api/               # route handlers (REST + SSE + files) — see 05-api.md
│   ├── components/            # shared UI components
│   ├── features/              # feature modules: projects, tasks, files, chat, comments, notifications
│   ├── lib/                   # auth, db, i18n, email, authz helpers, schemas (Zod)
│   └── styles/
├── tests/
│   ├── unit/
│   └── e2e/
└── docs/                      # this spec pack lives here
```

Feature-module convention (important for parallel agents): each folder in `src/features/<name>/`
contains `components/`, `server/` (data access + route-handler logic), `schemas.ts`, and
`index.ts` exports. Agents own whole feature folders to minimize merge conflicts.

## 3. Runtime topology (production, Docker Compose)

```
[Internet] → Caddy (443, automatic Let's Encrypt TLS)
               → app  (Next.js standalone, port 3000)
                   → postgres:16 (internal network only)
                   → /data/uploads (named volume)
```

`docker-compose.yml` services:

```yaml
services:
  caddy:
    image: caddy:2
    ports: ["80:80", "443:443"]
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
    restart: unless-stopped

  app:
    build: .
    env_file: .env
    depends_on: [db]
    volumes:
      - uploads:/data/uploads
    restart: unless-stopped
    # runs prisma migrate deploy on start (entrypoint script)

  db:
    image: postgres:16-alpine
    env_file: .env
    volumes:
      - pgdata:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  caddy_data:
  uploads:
  pgdata:
```

Caddyfile must set `request_body max_size 512MB` for the upload route and enable
compression. SSE requires `flush_interval -1` (no buffering) on `/api/events*`.

`.env.example` keys (exhaustive; agents must not invent new required env vars without
updating this file): `DATABASE_URL`, `AUTH_SECRET`, `APP_URL`, `SMTP_HOST`, `SMTP_PORT`,
`SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `UPLOADS_DIR=/data/uploads`,
`MAX_UPLOAD_MB=500`, `DEFAULT_LOCALE=sk`.

Dev: `docker-compose.dev.yml` runs only Postgres; the app runs with `pnpm dev` locally.

## 4. Security

1. **All authorization server-side.** Every route handler resolves the session, loads the
   project membership, and checks the role. Helper: `requireProjectAccess(projectId, role?)`
   in `src/lib/authz.ts` — single choke point, unit-tested.
2. **Files are never publicly addressable.** Downloads go through
   `GET /api/files/:id/download`, which checks membership + `client_visible` before
   streaming from disk. Stored filenames are UUIDs; original names live in the DB.
3. Client role is **deny-by-default**: any entity without an explicit visibility flag is
   invisible to clients.
4. Passwords: argon2id. Sessions: Auth.js JWT cookies, `secure`, `httpOnly`, `sameSite=lax`.
5. Rate limiting on auth endpoints (in-memory token bucket is fine for this scale).
6. Upload hardening: extension + MIME allowlist (pdf, dwg, dxf, ifc, images, office docs,
   zip), size limit from env, no execution of uploads, `Content-Disposition: attachment`
   except for previewable types (pdf, images) which render inline in a sandboxed viewer.
7. CSRF: Auth.js built-in for auth routes; all mutating API routes require same-origin
   (check `Origin` header) since cookies are `sameSite=lax`.
8. Security headers via middleware: CSP (self + data: images), X-Frame-Options DENY,
   Referrer-Policy strict-origin-when-cross-origin.

## 5. Realtime design (SSE)

- One endpoint: `GET /api/events` (authenticated). Server keeps per-user connection set
  in memory; events: `chat.message`, `notification.new`, `task.updated`, `file.added`.
- Publisher: in-process event bus (`src/lib/events.ts`). Single app container ⇒ no Redis
  needed. If the app is ever scaled to >1 replica, swap the bus for Postgres LISTEN/NOTIFY —
  isolate the bus behind an interface now.
- Client hook `useLiveEvents()` reconnects with backoff; UI also refetches on window focus,
  so lost events self-heal.

## 6. Progress calculation

Pure function in `src/lib/progress.ts` (unit-tested, used by both admin and client UI):

```
phaseProgress  = done_tasks_weighted / all_tasks_weighted   (tasks default weight 1)
projectProgress = Σ(phase.weight × phaseProgress) / Σ(phase.weight)   (over non-skipped phases)
```

## 7. Backups & operations

- Nightly cron on the host: `pg_dump` to `/backups` + rsync/restic of the `uploads` volume;
  keep 30 daily, 12 monthly. Provide `scripts/backup.sh` and `scripts/restore.sh`.
- Logs: app logs to stdout (docker logs); optional log rotation via Docker daemon config.
- Health: `GET /api/health` returns app+db status; used by `docker compose` healthcheck.
- Migrations run automatically on container start (`prisma migrate deploy`) — migrations
  must therefore always be backward-safe (additive first, destructive in a later release).

## 8. Performance budgets

- Project page SSR TTFB < 500 ms with 50 projects / 5k tasks / 10k files in DB.
- File list virtualizes above 200 items; chat paginates by 50 messages (cursor-based).
- Images: thumbnails generated at upload (sharp), stored beside originals (`<uuid>.thumb.webp`).
