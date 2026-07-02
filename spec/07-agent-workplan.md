# AI-Agent Work Plan

How to split the build across multiple AI coding agents with minimal merge conflicts.
Read `00-overview.md` §8 for the conflict-priority rule. Every work package (WP) states
its owned paths — an agent **must not** edit files outside its owned paths except
`messages/*.json` (append-only keys, prefixed by feature, e.g. `chat.composer.placeholder`).

## 0. Ground rules for every agent

1. Branch per WP: `wp<id>-<name>`; PR must pass `pnpm lint && pnpm typecheck && pnpm test`.
2. Ship tests with code (Vitest for logic, Playwright for one happy path per WP).
3. No new required env vars, no schema changes outside WP-1 without updating
   `03-data-model.md` + `.env.example` in the same PR.
4. All UI strings via next-intl keys added to **both** `sk.json` and `en.json`.
5. Use only the component inventory + shadcn/ui; new shared components go to
   `src/components` with a `/dev/ui` showcase entry.
6. Definition of done = acceptance criteria of the mapped sections in `04-features.md`.

## 1. Work packages

### WP-1 · Foundation (BLOCKS EVERYTHING — run first, single agent)
**Owns:** repo root, `Dockerfile`, `docker-compose*.yml`, `prisma/**`, `src/lib/**`,
`src/app/api/health`, `messages/` bootstrap, CI config.
**Builds:** repo scaffold per `02-architecture.md` §2; full Prisma schema from
`03-data-model.md` + migrations + seed (template "Rodinný dom SK" from
`01-domain-analysis.md`); Auth.js setup incl. invite/reset flows (`05-api.md` §1);
`requireProjectAccess`, `logActivity`, event bus, email transport, i18n plumbing,
progress functions (`02-architecture.md` §6); Docker Compose prod+dev; health endpoint.
**Done when:** `docker compose up` serves login; seed admin can log in; unit tests for
authz + progress pass.

### WP-2 · Design system & app shells
**Owns:** `src/components/**`, `src/styles/**`, `src/app/(admin)/layout*`,
`src/app/(client)/layout*`, `src/app/(auth)/**` (pages only), `/dev/ui`.
**Builds:** tokens/palette/typography from `06-ui-ux.md` §1–2, all shared components in
§6 (with mock data), admin sidebar shell, client top-bar shell, login/invite screens,
locale switcher, empty states.
**Depends on:** WP-1 (auth pages wiring). Can start against a stub layout in parallel;
integrate after WP-1 merges.

### WP-3 · Projects, dashboard & settings
**Owns:** `src/features/projects/**`, `src/app/(admin)/dashboard`,
`src/app/(admin)/projects/**` (overview + settings tabs), project APIs (`05-api.md` §2).
**Builds:** dashboard cards + aggregates, creation wizard with template pruning,
settings (members, invites, contacts, archive, weights). Maps to `04-features.md` §2–3.
**Depends on:** WP-1, WP-2.

### WP-4 · Phases & tasks (kanban)
**Owns:** `src/features/tasks/**`, phases/tasks APIs (`05-api.md` §3), admin
Phases & Tasks tab.
**Builds:** phase accordion, kanban with dnd-kit, task modal, reorder batch API,
phase-done flow, progress recompute. Maps to `04-features.md` §4.
**Depends on:** WP-1, WP-2.

### WP-5 · Files & folders
**Owns:** `src/features/files/**`, file/folder APIs (`05-api.md` §4), admin Files tab,
upload pipeline (streaming, versioning, thumbnails via sharp, ZIP streaming).
**Builds:** everything in `04-features.md` §5. Security-critical: download authz per
`02-architecture.md` §4.
**Depends on:** WP-1, WP-2.

### WP-6 · Chat, comments & notifications
**Owns:** `src/features/chat/**`, `src/features/comments/**`,
`src/features/notifications/**`, APIs `05-api.md` §5–7, SSE client hook, email templates
(`06-ui-ux.md` §5).
**Builds:** `04-features.md` §6, §7, §9. Attachment storage delegates to WP-5's upload
service (interface: `saveUpload(projectId, folderKey, file) → FileVersion`) — agreed
stub in WP-1 so WP-5/WP-6 can proceed in parallel.
**Depends on:** WP-1, WP-2; integrates with WP-5.

### WP-7 · Client portal
**Owns:** `src/app/(client)/**` (pages), `src/features/portal/**`.
**Builds:** Prehľad hero + progress ring + milestone timeline + feeds, Postup phase
cards, Dokumenty (read view reusing WP-5 components), Správy (reusing WP-6 thread),
GDPR profile pages. Maps to `04-features.md` §8, §12 — the showpiece; follow
`06-ui-ux.md` §3.6–3.7 closely.
**Depends on:** WP-2 heavily; data from WP-3–6 (can develop against seed/demo data).

### WP-8 · QA, hardening & release (single agent, last)
**Owns:** `tests/e2e/**`, `scripts/backup.sh|restore.sh`, docs.
**Builds:** full e2e suite (invite→login→see project; publish file→client downloads;
chat both ways; kanban flow; visibility leak probes from `05-api.md` §9.3), i18n
completeness check in CI, rate limiting verification, Lighthouse a11y ≥ 95 on client
pages, backup/restore scripts + runbook `docs/OPERATIONS.md`.
**Depends on:** everything.

## 2. Dependency graph & suggested schedule

```
WP-1 ──┬─ WP-2 ──┬─ WP-3 ─┐
       │         ├─ WP-4 ─┤
       │         ├─ WP-5 ─┼── WP-7 ── WP-8
       │         └─ WP-6 ─┘   (portal integrates all)
```

Waves: **1)** WP-1 · **2)** WP-2 (WP-3..6 may scaffold against stubs) ·
**3)** WP-3, WP-4, WP-5, WP-6 in parallel · **4)** WP-7 · **5)** WP-8.

## 3. Integration contract (recap)

- Database: only via Prisma schema of `03-data-model.md`; WP-1 owns migrations
  thereafter, others propose changes by PR to schema + this pack.
- Cross-feature calls: through exported functions of `src/features/<x>/server` or
  `src/lib` — never reach into another feature's components.
- Events: names fixed in `05-api.md` §7; payloads typed in `src/lib/events.ts` (WP-1).
- i18n keys: `feature.section.name`, append-only.

## 4. Milestone acceptance (what Lukas checks per wave)

1. **Wave 1:** compose stack boots on the server, admin logs in.
2. **Wave 2:** `/dev/ui` showcases every component in SK+EN; login/invite screens work.
3. **Wave 3:** architect can run a real project end-to-end internally (create → tasks →
   files → chat with a test client account).
4. **Wave 4:** wife-approval demo of the client portal on a phone. 😊 → seriously: the
   portal Prehľad screen matches `06-ui-ux.md` §3.6.
5. **Wave 5:** e2e suite green, backup restore drill done, tag `v1.0.0`.
