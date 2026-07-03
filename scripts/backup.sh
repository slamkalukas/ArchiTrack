#!/bin/sh
# ArchiTrack backup script (spec/02-architecture.md §7).
#
# Takes a Postgres dump (via `pg_dump` inside the running `db` container) and a tar
# snapshot of the `uploads` Docker volume, writes both into a dated subdirectory of
# BACKUP_DIR, and prunes old backups per the retention policy: keep the last 30 daily
# backups plus the 1st-of-month backup for the last 12 months.
#
# Usage (run from the repo root, next to docker-compose.yml):
#   ./scripts/backup.sh
#
# Env overrides (all optional):
#   BACKUP_DIR        Where dated backup folders are written. Default: ./backups
#   COMPOSE_PROJECT    Passed to `docker compose -p` if your stack uses a non-default
#                      project name. Default: unset (docker compose infers it).
#
# Intended to run from host cron, e.g. nightly at 03:00:
#   0 3 * * * cd /opt/architrack && ./scripts/backup.sh >> /var/log/architrack-backup.log 2>&1
#
# See docs/OPERATIONS.md for the full backup/restore runbook.

set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_DIR"

BACKUP_DIR="${BACKUP_DIR:-$REPO_DIR/backups}"
DAILY_KEEP=30
MONTHLY_KEEP=12

COMPOSE="docker compose"
if [ -n "${COMPOSE_PROJECT:-}" ]; then
  COMPOSE="docker compose -p $COMPOSE_PROJECT"
fi

# Load POSTGRES_* / DATABASE_URL-adjacent vars from .env if present, so this script
# works the same whether invoked by a human or by cron (which has no shell env).
if [ -f "$REPO_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$REPO_DIR/.env"
  set +a
fi

POSTGRES_USER="${POSTGRES_USER:-architrack}"
POSTGRES_DB="${POSTGRES_DB:-architrack}"

TIMESTAMP="$(date +%Y-%m-%d_%H%M%S)"
DEST="$BACKUP_DIR/$TIMESTAMP"
mkdir -p "$DEST"

echo "[backup] $TIMESTAMP — writing to $DEST"

# --- 1. Postgres dump ------------------------------------------------------------
echo "[backup] dumping database ($POSTGRES_DB)…"
$COMPOSE exec -T db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom \
  > "$DEST/db.dump"
echo "[backup] database dump written: $DEST/db.dump ($(du -h "$DEST/db.dump" | cut -f1))"

# --- 2. Uploads volume ------------------------------------------------------------
# Stream a tar of the named `uploads` volume out via a disposable alpine container
# mounting it read-only — works whether or not the app container is running, and never
# touches the volume's contents. Resolve the actual volume name (docker compose
# prefixes it with the project name, e.g. "architrack_uploads") by inspecting the `app`
# container's mounts — robust regardless of COMPOSE_PROJECT_NAME / directory-derived
# project name, and needs nothing beyond `docker` itself.
APP_CONTAINER="$($COMPOSE ps -q app 2>/dev/null || true)"
UPLOADS_VOLUME=""
if [ -n "$APP_CONTAINER" ]; then
  UPLOADS_VOLUME="$(docker inspect "$APP_CONTAINER" \
    --format '{{range .Mounts}}{{if eq .Destination "/data/uploads"}}{{.Name}}{{end}}{{end}}' 2>/dev/null || true)"
fi

if [ -z "$UPLOADS_VOLUME" ]; then
  # Fallback when the app container isn't running: guess the compose default naming
  # ("<project>_uploads") and confirm it exists.
  PROJECT_NAME="${COMPOSE_PROJECT:-$(basename "$REPO_DIR")}"
  UPLOADS_VOLUME="$(docker volume ls --format '{{.Name}}' | grep -E "^${PROJECT_NAME}_?uploads$" | head -n1 || true)"
fi

if [ -z "$UPLOADS_VOLUME" ]; then
  echo "[backup] WARNING: could not resolve the 'uploads' Docker volume name — skipping file backup." >&2
  echo "[backup] Run 'docker volume ls' to find it and set UPLOADS_VOLUME manually if needed." >&2
else
  echo "[backup] archiving uploads volume ($UPLOADS_VOLUME)…"
  docker run --rm \
    -v "$UPLOADS_VOLUME:/data:ro" \
    -v "$DEST:/backup" \
    alpine:3 \
    tar -czf /backup/uploads.tar.gz -C /data .
  echo "[backup] uploads archive written: $DEST/uploads.tar.gz ($(du -h "$DEST/uploads.tar.gz" | cut -f1))"
fi

echo "[backup] done: $DEST"

# --- 3. Retention: 30 daily + 12 monthly ------------------------------------------
# Policy (spec/02-architecture.md §7): keep 30 daily, 12 monthly. A "monthly" backup is
# simply the oldest surviving backup within each of the last 12 calendar months (usually
# the 1st run of that month) — anything else past the daily window is pruned.
# Iterates by newline (not word-splitting) throughout, so this is safe even if
# BACKUP_DIR contains spaces.
echo "[backup] applying retention (30 daily, 12 monthly)…"

ALL_BACKUPS="$(find "$BACKUP_DIR" -maxdepth 1 -mindepth 1 -type d -name '20*' | sort)"
TOTAL_COUNT=0
if [ -n "$ALL_BACKUPS" ]; then
  TOTAL_COUNT="$(printf '%s\n' "$ALL_BACKUPS" | wc -l | tr -d ' ')"
fi

if [ "$TOTAL_COUNT" -gt "$DAILY_KEEP" ]; then
  PRUNE_COUNT=$((TOTAL_COUNT - DAILY_KEEP))
  CANDIDATES_FOR_PRUNE="$(printf '%s\n' "$ALL_BACKUPS" | head -n "$PRUNE_COUNT")"

  # Of the candidates older than the daily window, keep at most one per calendar month
  # (the newest in that month), for up to MONTHLY_KEEP distinct months. Walk oldest to
  # newest and remember the last-seen dir per month; that "last seen" is the newest
  # backup in that month among the candidates, since the list is sorted ascending.
  MONTHS_FILE="$(mktemp)"
  KEEP_FILE="$(mktemp)"
  trap 'rm -f "$MONTHS_FILE" "$KEEP_FILE"' EXIT

  printf '%s\n' "$CANDIDATES_FOR_PRUNE" | while IFS= read -r dir; do
    [ -z "$dir" ] && continue
    month="$(basename "$dir" | cut -c1-7)" # YYYY-MM
    echo "$month $dir" >> "$MONTHS_FILE"
  done

  # For each distinct month (there are at most ~a few hundred candidates in practice),
  # keep the newest entry; cap at MONTHLY_KEEP most-recent distinct months.
  cut -d' ' -f1 "$MONTHS_FILE" | sort -u | tail -n "$MONTHLY_KEEP" | while IFS= read -r month; do
    grep "^$month " "$MONTHS_FILE" | tail -n1 | cut -d' ' -f2- >> "$KEEP_FILE"
  done

  printf '%s\n' "$CANDIDATES_FOR_PRUNE" | while IFS= read -r dir; do
    [ -z "$dir" ] && continue
    if grep -Fxq "$dir" "$KEEP_FILE" 2>/dev/null; then
      echo "[backup] keeping monthly backup: $dir"
    else
      echo "[backup] pruning old backup: $dir"
      rm -rf "$dir"
    fi
  done

  rm -f "$MONTHS_FILE" "$KEEP_FILE"
  trap - EXIT
fi

echo "[backup] retention applied. Current backups:"
find "$BACKUP_DIR" -maxdepth 1 -mindepth 1 -type d -name '20*' | sort
