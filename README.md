# ArchiTrack

A self-hosted project-tracking app for a solo architect running residential design
projects in Slovakia, with a polished, private client portal — progress, documents,
chat, and comments in one place instead of scattered email threads.

See `spec/` for the full specification pack (`spec/README.md` is the index) — it is the
source of truth for domain rules, data model, API, and UI/UX. This README is the
practical "how do I run this" companion.

## Stack

- **Next.js 16** (App Router) + **TypeScript**, React 19
- **PostgreSQL 16** via **Prisma**
- **Auth.js** (NextAuth v5) — credentials auth, ADMIN/CLIENT roles
- **Tailwind CSS 4** + shadcn/ui components
- **next-intl** — full SK (default) + EN bilingual UI
- **SSE** (Server-Sent Events) for realtime chat/notifications — no websocket server
- Local filesystem storage for uploads (Docker volume in production)
- **Caddy** for TLS termination in production
- **Playwright** (e2e) + **Vitest** (unit) + **@axe-core/playwright** (accessibility)

Two roles: **ADMIN** (the architect — exactly one in v1) and **CLIENT** (customers,
scoped per-project, deny-by-default visibility on everything).

## Quickstart — local development

Requirements: Node 22, pnpm, Docker (for the dev Postgres container).

```bash
pnpm install

# Start a local Postgres in Docker (dev-only compose file — the app itself runs on the host)
docker compose -f docker-compose.dev.yml up -d db

cp .env.example .env
# Edit .env: at minimum set AUTH_SECRET (npx auth secret) and DATABASE_URL's port to
# match ARCHITRACK_DB_PORT if you changed it.

pnpm db:migrate       # applies Prisma migrations
pnpm db:seed          # creates the seed admin + "Rodinný dom SK" template + demo project

pnpm dev              # http://localhost:3000
```

Seed credentials (change immediately in any real deployment):

| Role | Email | Password |
|---|---|---|
| Admin (architect) | `admin@architrack.local` | `ChangeMe123!` |
| Demo client | `klient@architrack.local` | `DemoClient123!` |

The seed also creates a demo project, **"RD Novákovci — Pezinok"**, populated from the
"Rodinný dom SK" template so there's real data to click through immediately.

Other useful dev commands:

```bash
pnpm db:studio        # Prisma Studio — browse the DB
pnpm format           # Prettier write
```

## Quickstart — production

```bash
cp .env.example .env   # fill in real AUTH_SECRET, SMTP credentials, APP_URL, Postgres password
docker compose up -d
docker compose exec app node_modules/.bin/tsx prisma/seed.ts   # first boot only
```

Full deploy/backup/restore/troubleshooting runbook: **`docs/OPERATIONS.md`**.

## Tests

```bash
pnpm lint              # eslint
pnpm typecheck         # tsc --noEmit
pnpm test              # unit tests (vitest) — tests/unit/**
pnpm build              # production build
pnpm exec playwright test   # full e2e suite — tests/e2e/**, see below
```

The e2e suite runs against a single dev server on port 3100 (`playwright.config.ts`
starts one automatically if `PLAYWRIGHT_BASE_URL` isn't set). Before a full cold run,
free the port first:

```bash
# POSIX / Git Bash on Windows:
for pid in $(netstat -ano | grep ":3100" | grep LISTENING | awk '{print $5}' | sort -u); do taskkill //F //PID "$pid"; done
# macOS/Linux with kill-port installed:
npx kill-port 3100
```

QA results for the current release (e2e coverage, visibility leak-probe results,
accessibility audit findings, rate-limit verification) are written up in **`docs/QA.md`**.

## Spec pack

`spec/` is the full specification this app was built from — start at
[`spec/README.md`](spec/README.md). Authority order on conflicts: data model > API >
features > UI/UX (see `spec/00-overview.md` §8).

## Project layout

```
src/app/            Next.js App Router routes (admin shell, client portal, API routes)
src/features/        Feature modules (projects, tasks, files, chat, comments, notifications, portal)
src/lib/             Shared server-only libs (db, auth, authz, rate-limit, email, events, uploads)
src/components/      Shared UI components (shadcn/ui primitives + app-specific shared components)
prisma/              Schema, migrations, seed script
tests/unit/          Vitest unit tests
tests/e2e/           Playwright end-to-end tests
scripts/             Ops scripts (backup.sh, restore.sh) + CI helpers (check-i18n-parity.mjs)
docs/                Operations runbook (OPERATIONS.md) and QA report (QA.md)
```
