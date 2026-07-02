#!/bin/sh
set -e

echo "[entrypoint] Running database migrations (prisma migrate deploy)…"
node_modules/.bin/prisma migrate deploy --schema=./prisma/schema.prisma

echo "[entrypoint] Starting ArchiTrack…"
exec "$@"
