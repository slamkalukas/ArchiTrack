# ArchiTrack — Specification Pack v1.0

Web application for a solo architect in Slovakia: project progress tracking for
family-house design projects, with a representative customer portal (files, chat,
comments, to-do/in-progress/done tasks). Self-hosted via Docker Compose.

| # | File | What it defines | Authority |
|---|---|---|---|
| 0 | [00-overview.md](00-overview.md) | Vision, roles, feature summary, quality bars | — |
| 1 | [01-domain-analysis.md](01-domain-analysis.md) | Slovak family-house phases, professions, permits (zákon 25/2025 Z. z.) | domain truth |
| 2 | [02-architecture.md](02-architecture.md) | Stack, repo layout, Docker Compose, security, ops | tech truth |
| 3 | [03-data-model.md](03-data-model.md) | Prisma schema — **highest authority** | ★★★★ |
| 4 | [04-features.md](04-features.md) | Functional spec + acceptance criteria | ★★ |
| 5 | [05-api.md](05-api.md) | API routes, SSE, cross-cutting rules | ★★★ |
| 6 | [06-ui-ux.md](06-ui-ux.md) | Design language, screens, UX rules | ★ |
| 7 | [07-agent-workplan.md](07-agent-workplan.md) | Work packages WP-1…WP-8 for parallel AI agents | process |

## How to use with AI agents

1. Give **every** agent the whole pack (it's small) + its assigned WP from
   `07-agent-workplan.md`.
2. Run WP-1 first and alone. Then WP-2. Then WP-3…WP-6 in parallel. Then WP-7, then WP-8.
3. Hold agents to the ground rules in `07-agent-workplan.md` §0 — especially "own paths
   only" and "tests with code".
4. On spec conflicts: `03 > 05 > 04 > 06` (see `00-overview.md` §8).

## Quick facts

- Stack: Next.js 15 + TypeScript, Prisma + PostgreSQL 16, Auth.js, Tailwind + shadcn/ui,
  next-intl (SK default + EN), SSE realtime, local-volume file storage, Caddy TLS.
- Roles: ADMIN (the architect) and CLIENT (customers, per-project, deny-by-default
  visibility).
- Deployment: `docker compose up -d` on Lukas's server; nightly pg_dump + uploads backup.
