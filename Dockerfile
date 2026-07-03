# syntax=docker/dockerfile:1

# ---- Base ----------------------------------------------------------------
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# ---- Dependencies ----------------------------------------------------------
FROM base AS deps
RUN apk add --no-cache libc6-compat openssl
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

# ---- Build -------------------------------------------------------------
FROM base AS builder
RUN apk add --no-cache openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm exec prisma generate
RUN pnpm build

# ---- Runtime -----------------------------------------------------------
FROM base AS runner
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Standalone Next.js output (see next.config.ts `output: "standalone"`).
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.pnpm ./node_modules/.pnpm
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/.bin ./node_modules/.bin
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
# tsx + its runtime deps (dotenv, argon2, esbuild): needed to run `prisma/seed.ts`
# from inside the running container per docs/OPERATIONS.md ("docker compose exec app
# node_modules/.bin/tsx prisma/seed.ts" — the documented first-boot seeding step and
# the ops runbook's restore-drill verification step). Each of tsx/dotenv/argon2 mirrors
# the same top-level symlink pnpm creates for them in the builder stage. `esbuild`
# (tsx's own transitive dependency, not a direct one) has no such top-level symlink
# anywhere — pnpm only nests it under tsx's `.pnpm` entry — but Node's ESM resolver
# does not realpath through a symlinked node_modules/tsx before searching for sibling
# packages, so `import "esbuild"` from inside tsx's bundled cli.mjs fails unless esbuild
# is *also* reachable directly under the top-level node_modules. All of this was found
# by actually building and running this image while validating the ops runbook.
COPY --from=builder /app/node_modules/tsx ./node_modules/tsx
COPY --from=builder /app/node_modules/dotenv ./node_modules/dotenv
COPY --from=builder /app/node_modules/argon2 ./node_modules/argon2
RUN esbuild_dir="$(basename "$(find node_modules/.pnpm -maxdepth 1 -name 'esbuild@*' | head -n1)")" \
  && ln -s ".pnpm/${esbuild_dir}/node_modules/esbuild" ./node_modules/esbuild
COPY docker-entrypoint.sh ./docker-entrypoint.sh

RUN mkdir -p /data/uploads && chown -R nextjs:nodejs /data/uploads
RUN chmod +x ./docker-entrypoint.sh

USER nextjs

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
