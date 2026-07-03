# Operations runbook

Deploy, back up, restore, and troubleshoot ArchiTrack in production. See
`spec/02-architecture.md` for the architecture this runbook operates, and
`docs/QA.md` for the QA pass this release went through.

## 1. Deploy from scratch

Target: a single host with Docker + Docker Compose v2 installed (`docker compose
version`).

1. **Clone the repo** onto the host, e.g. `/opt/architrack`.

2. **Create `.env`** from the template and fill in real values:

   ```
   cp .env.example .env
   ```

   | Variable | Notes |
   |---|---|
   | `DATABASE_URL` | Must match `POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB` below and point at `db:5432` (the compose service name), e.g. `postgresql://architrack:<strong-password>@db:5432/architrack?schema=public` |
   | `AUTH_SECRET` | Generate with `npx auth secret` or `openssl rand -base64 32` — **required**, do not ship the placeholder |
   | `APP_URL` | Public URL, e.g. `https://architrack.example.com` — used in invite/reset-password emails |
   | `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | Real SMTP credentials. **Important:** if these are absent entirely, the app falls back to a dev-only JSON transport that never sends real mail (see `src/lib/email.ts`) — fine for a demo box, wrong for production. If you set them, make sure they're a working SMTP relay: a broken host degrades gracefully now (mutations still succeed, see `docs/QA.md` §4) but real users will never receive invites/notifications/password resets. |
   | `UPLOADS_DIR` | Leave as `/data/uploads` in production — this is the path *inside* the container that the `uploads` named volume is mounted to (see `docker-compose.yml`) |
   | `MAX_UPLOAD_MB` | Upload size cap; also update Caddy's `request_body { max_size }` in `Caddyfile` if you raise this well beyond 512MB |
   | `DEFAULT_LOCALE` | `sk` or `en` |
   | `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Postgres credentials for the `db` service — pick a strong password, don't reuse the dev default |
   | `APP_DOMAIN` (Caddyfile) | Not in `.env` — set as an actual env var or edit `Caddyfile` directly; Caddy uses it for automatic HTTPS (Let's Encrypt) |

3. **Boot the stack:**

   ```
   docker compose up -d
   ```

   This builds the `app` image (standalone Next.js build, see `Dockerfile`), starts
   Postgres, waits for its healthcheck, then starts the app — whose entrypoint
   (`docker-entrypoint.sh`) runs `prisma migrate deploy` automatically before starting
   the server. Caddy starts last and proxies `:80`/`:443` to the app, obtaining a TLS
   cert automatically once `APP_DOMAIN` resolves to the host.

4. **Seed the database** (first boot only — creates the ADMIN user + the "Rodinný dom
   SK" template + a demo project):

   ```
   docker compose exec app node_modules/.bin/tsx prisma/seed.ts
   ```

   Uses `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` from `.env` if set, otherwise the
   defaults in `prisma/seed.ts` (`admin@architrack.local` / `ChangeMe123!` — **change
   this password immediately after first login in production**).

5. **First login:** visit `https://<APP_DOMAIN>/login` with the seed admin credentials.
   Change the password immediately (Settings → profile) if you used the seed default.

6. **Verify health:**

   ```
   curl -f https://<APP_DOMAIN>/api/health
   # {"ok":true,"db":true}
   ```

   This is also what `docker-compose.yml`'s `app` healthcheck polls internally.

## 2. Backups

Nightly `pg_dump` + a tar of the `uploads` volume, retention 30 daily / 12 monthly, per
`spec/02-architecture.md` §7.

### Running a backup

```
cd /opt/architrack
./scripts/backup.sh
```

Writes to `./backups/<YYYY-MM-DD_HHMMSS>/`:
- `db.dump` — a `pg_dump --format=custom` dump (restorable with `pg_restore`)
- `uploads.tar.gz` — a tarball of the entire `uploads` Docker volume

Then prunes old backup directories to the retention policy (see the script's own
comments for the exact algorithm — keeps the newest 30 daily snapshots plus one
snapshot per calendar month for the last 12 distinct months among anything older).

Env overrides: `BACKUP_DIR` (default `./backups`), `COMPOSE_PROJECT` (only needed if you
run `docker compose -p <name>`).

### Automating it (host cron)

```
# /etc/cron.d/architrack-backup
0 3 * * * root cd /opt/architrack && ./scripts/backup.sh >> /var/log/architrack-backup.log 2>&1
```

For off-host durability, layer `rsync` or `restic` on top of `./backups/` — the script
itself only writes locally.

### Restoring

**This is destructive** — it drops and recreates the database (and/or replaces the
uploads volume) from the chosen backup. `restore.sh` requires you to type the database
name to confirm, unless run with `--yes`.

```
./scripts/restore.sh backups/2026-07-01_030000
./scripts/restore.sh backups/2026-07-01_030000 --db-only       # database only
./scripts/restore.sh backups/2026-07-01_030000 --uploads-only  # uploads volume only
```

What it does, in order: stops the `app` container → drops/recreates the Postgres
database → `pg_restore`s the dump → replaces the `uploads` volume contents from the
tarball → starts `app` back up (which runs `prisma migrate deploy` again via the normal
entrypoint — harmless/idempotent if the dump is already at the current schema version).

### Restore drill (do this periodically, not just when something breaks)

1. Take a fresh backup: `./scripts/backup.sh`.
2. On a **staging** copy of the stack (never production), restore it:
   `./scripts/restore.sh backups/<latest> --yes`.
3. Confirm `GET /api/health` returns `{"ok":true,"db":true}`.
4. Log in as the seed admin and confirm the demo project, its files, and its chat
   history are all present and match what you expected from the backup's point in time.
5. Record the drill date and outcome somewhere durable (e.g. this file's git history, or
   an internal changelog) — spec/07-agent-workplan.md's wave-5 milestone explicitly
   calls for "a backup restore drill done" before tagging a release.

This was validated during WP-8 against a throwaway Postgres + alpine "drill" stack (not
the real production compose file) — `pg_dump`, the uploads-volume tarball, retention
pruning, and `pg_restore` were all confirmed to work end-to-end (a table was created,
backed up, dropped, and successfully restored with its rows intact). The real
`Dockerfile` was also built and run standalone (app + a throwaway Postgres, not the full
three-service compose stack with Caddy) to confirm the app boots and `/api/health`
passes — that pass is what surfaced and fixed the `prisma/seed.ts` runtime bug described
below. A full `docker compose up -d` → seed → backup → restore → verify drill against
the *actual* three-service compose stack is still worth doing at least once in a
non-production environment before relying on this operationally — see `docs/QA.md` §6-7
for exactly what was and wasn't covered.

#### Bug found & fixed during this validation: seeding was broken in the built image

The documented seed command (`docker compose exec app node_modules/.bin/tsx
prisma/seed.ts`, step 4 above) failed against the production image as it existed before
WP-8: the runtime image only copies specific `node_modules` subsets to stay small, and
`tsx` (needed only for this one admin command) plus a couple of its own dependencies
weren't among them. Fixed in `Dockerfile` — see `docs/QA.md` §6 for the full
explanation. Re-verified end-to-end: build the image, run `prisma migrate deploy`, then
`node_modules/.bin/tsx prisma/seed.ts` against a real Postgres — completes successfully.

## 3. Logs

The app logs to stdout/stderr (12-factor style) — no separate log files inside the
container.

```
docker compose logs -f app        # tail the app
docker compose logs -f db         # tail Postgres
docker compose logs --since 1h    # everything, last hour
```

For log rotation, configure the Docker daemon's `log-opts` (e.g. `max-size`/`max-file`)
in `/etc/docker/daemon.json` — this repo does not ship a rotation config since it
depends on the host's disk budget.

## 4. Health endpoint

`GET /api/health` — public, no auth. Returns `{ ok: boolean, db: boolean }`, HTTP 200
when healthy, 503 when the DB check fails. Used by:
- `docker-compose.yml`'s `app` service healthcheck (`interval: 30s`, `retries: 3`,
  `start_period: 20s`)
- Any external uptime monitor you point at `https://<APP_DOMAIN>/api/health`

## 5. Updating / deploying a new version

```
cd /opt/architrack
git pull
docker compose build app
docker compose up -d app
```

Migrations run automatically on container start (`docker-entrypoint.sh` →
`prisma migrate deploy`) — per `spec/02-architecture.md` §7, migrations in this repo are
required to be additive-first/backward-compatible, so this is safe to run without
downtime coordination. Take a backup (`./scripts/backup.sh`) before any update that
includes a schema migration, as a matter of habit.

## 6. Common failures

| Symptom | Likely cause | Fix |
|---|---|---|
| `docker compose up` — `app` never becomes healthy | DB not ready yet, or `DATABASE_URL` wrong | Check `docker compose logs db` for readiness; confirm `DATABASE_URL` host is `db` (the compose service name), not `localhost` |
| Login works but invites/password-reset emails never arrive | `SMTP_*` env vars unset (dev fallback active) or pointing at an unreachable host | Check `docker compose logs app \| grep "failed to send"` — these are now logged rather than silently swallowed (see `docs/QA.md` §4); fix the SMTP config and use "Resend invite" to retry |
| File upload fails with a generic error | Upload exceeds `MAX_UPLOAD_MB` or Caddy's `request_body max_size` | Raise both consistently (`.env` and `Caddyfile`) |
| `GET /api/health` returns `{"ok":false,"db":false}` | Postgres down or `DATABASE_URL` credentials wrong | `docker compose logs db`; verify `POSTGRES_*` vars match `DATABASE_URL` |
| A client sees a 404 for something that should be visible | Check `Visibility` on the file/folder/task/phase chain — spec/03-data-model.md §3.2: a file/task is only client-visible when its own flag **and** its entire folder/phase chain are `CLIENT_VISIBLE` | Toggle visibility from the admin UI (the eye icon) rather than the DB directly |
| Migrations fail on deploy | A destructive migration was shipped without a prior additive release | Never hand-edit the DB to unblock this — roll back the app image to the previous version, fix the migration, redeploy |
| Uploads volume fills the disk | No automatic cleanup of soft-deleted files' bytes (hard delete removes them per `spec/04-features.md` §5 rules; ever-client-visible files are only soft-deleted) | Monitor disk usage; there is no built-in retention job for uploads beyond the backup script's own retention of *backups* |

## 7. Test commands (for reference — see root README.md for the full list)

```
pnpm lint
pnpm typecheck
pnpm test              # unit (vitest)
pnpm build
pnpm exec playwright test   # e2e — cold server: kill port 3100 first, see docs/QA.md §1
```
