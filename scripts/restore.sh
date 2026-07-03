#!/bin/sh
# ArchiTrack restore script (spec/02-architecture.md §7).
#
# Restores a Postgres dump and/or the uploads volume from a backup directory produced
# by scripts/backup.sh. DESTRUCTIVE: this drops and recreates data in the target
# database/volume — it asks for explicit confirmation before touching anything, unless
# run with --yes (for scripted/tested use).
#
# Usage (run from the repo root, next to docker-compose.yml):
#   ./scripts/restore.sh <backup-dir> [--yes] [--db-only|--uploads-only]
#
# Examples:
#   ./scripts/restore.sh backups/2026-07-01_030000
#   ./scripts/restore.sh backups/2026-07-01_030000 --db-only
#   ./scripts/restore.sh backups/2026-07-01_030000 --yes   # skip confirmation prompt
#
# See docs/OPERATIONS.md for the full backup/restore runbook and drill checklist.

set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_DIR"

usage() {
  echo "Usage: $0 <backup-dir> [--yes] [--db-only|--uploads-only]" >&2
  exit 1
}

BACKUP_PATH=""
ASSUME_YES=0
MODE="both"

for arg in "$@"; do
  case "$arg" in
    --yes) ASSUME_YES=1 ;;
    --db-only) MODE="db" ;;
    --uploads-only) MODE="uploads" ;;
    -h|--help) usage ;;
    *)
      if [ -z "$BACKUP_PATH" ]; then
        BACKUP_PATH="$arg"
      else
        echo "[restore] Unexpected argument: $arg" >&2
        usage
      fi
      ;;
  esac
done

[ -z "$BACKUP_PATH" ] && usage

# Accept either an absolute/relative path or a bare timestamp under BACKUP_DIR.
BACKUP_DIR="${BACKUP_DIR:-$REPO_DIR/backups}"
if [ ! -d "$BACKUP_PATH" ] && [ -d "$BACKUP_DIR/$BACKUP_PATH" ]; then
  BACKUP_PATH="$BACKUP_DIR/$BACKUP_PATH"
fi

if [ ! -d "$BACKUP_PATH" ]; then
  echo "[restore] Backup directory not found: $BACKUP_PATH" >&2
  exit 1
fi

DB_DUMP="$BACKUP_PATH/db.dump"
UPLOADS_ARCHIVE="$BACKUP_PATH/uploads.tar.gz"

if [ "$MODE" != "uploads" ] && [ ! -f "$DB_DUMP" ]; then
  echo "[restore] No db.dump found in $BACKUP_PATH — nothing to restore for the database." >&2
  [ "$MODE" = "db" ] && exit 1
fi
if [ "$MODE" != "db" ] && [ ! -f "$UPLOADS_ARCHIVE" ]; then
  echo "[restore] No uploads.tar.gz found in $BACKUP_PATH — nothing to restore for uploads." >&2
  [ "$MODE" = "uploads" ] && exit 1
fi

COMPOSE="docker compose"
if [ -n "${COMPOSE_PROJECT:-}" ]; then
  COMPOSE="docker compose -p $COMPOSE_PROJECT"
fi

if [ -f "$REPO_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$REPO_DIR/.env"
  set +a
fi
POSTGRES_USER="${POSTGRES_USER:-architrack}"
POSTGRES_DB="${POSTGRES_DB:-architrack}"

echo "=================================================================="
echo " ArchiTrack RESTORE — this is DESTRUCTIVE."
echo "  Source backup : $BACKUP_PATH"
echo "  Target DB     : $POSTGRES_DB (via docker compose service 'db')"
echo "  Mode          : $MODE"
echo "=================================================================="
if [ "$MODE" != "uploads" ]; then
  echo " -> The current '$POSTGRES_DB' database will be DROPPED and recreated from the dump."
fi
if [ "$MODE" != "db" ]; then
  echo " -> The current contents of the 'uploads' volume will be REPLACED."
fi
echo

if [ "$ASSUME_YES" -ne 1 ]; then
  printf 'Type the database name (%s) to confirm and continue: ' "$POSTGRES_DB"
  read -r CONFIRM
  if [ "$CONFIRM" != "$POSTGRES_DB" ]; then
    echo "[restore] Confirmation did not match — aborting. Nothing was changed." >&2
    exit 1
  fi
fi

# --- 1. Database restore ----------------------------------------------------------
if [ "$MODE" != "uploads" ]; then
  echo "[restore] stopping the app so nothing writes during restore…"
  $COMPOSE stop app >/dev/null 2>&1 || true

  echo "[restore] dropping and recreating database '$POSTGRES_DB'…"
  $COMPOSE exec -T db psql -U "$POSTGRES_USER" -d postgres \
    -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$POSTGRES_DB' AND pid <> pg_backend_pid();" \
    >/dev/null
  $COMPOSE exec -T db dropdb -U "$POSTGRES_USER" --if-exists "$POSTGRES_DB"
  $COMPOSE exec -T db createdb -U "$POSTGRES_USER" -O "$POSTGRES_USER" "$POSTGRES_DB"

  echo "[restore] restoring dump ($DB_DUMP)…"
  $COMPOSE exec -T db pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --role="$POSTGRES_USER" \
    < "$DB_DUMP"
  echo "[restore] database restored."
fi

# --- 2. Uploads volume restore -----------------------------------------------------
if [ "$MODE" != "db" ]; then
  APP_CONTAINER="$($COMPOSE ps -q app 2>/dev/null || true)"
  UPLOADS_VOLUME=""
  if [ -n "$APP_CONTAINER" ]; then
    UPLOADS_VOLUME="$(docker inspect "$APP_CONTAINER" \
      --format '{{range .Mounts}}{{if eq .Destination "/data/uploads"}}{{.Name}}{{end}}{{end}}' 2>/dev/null || true)"
  fi
  if [ -z "$UPLOADS_VOLUME" ]; then
    PROJECT_NAME="${COMPOSE_PROJECT:-$(basename "$REPO_DIR")}"
    UPLOADS_VOLUME="$(docker volume ls --format '{{.Name}}' | grep -E "^${PROJECT_NAME}_?uploads$" | head -n1 || true)"
  fi

  if [ -z "$UPLOADS_VOLUME" ]; then
    echo "[restore] WARNING: could not resolve the 'uploads' Docker volume — skipping uploads restore." >&2
  else
    echo "[restore] clearing and restoring uploads volume ($UPLOADS_VOLUME)…"
    docker run --rm \
      -v "$UPLOADS_VOLUME:/data" \
      -v "$BACKUP_PATH:/backup:ro" \
      alpine:3 \
      sh -c 'rm -rf /data/* /data/.[!.]* 2>/dev/null; tar -xzf /backup/uploads.tar.gz -C /data'
    echo "[restore] uploads volume restored."
  fi
fi

# --- 3. Restart -------------------------------------------------------------------
if [ "$MODE" != "uploads" ]; then
  echo "[restore] starting the app back up (runs pending migrations via docker-entrypoint.sh)…"
  $COMPOSE up -d app
fi

echo "[restore] done. Verify with: curl -f http://localhost/api/health (or your configured APP_DOMAIN)."
