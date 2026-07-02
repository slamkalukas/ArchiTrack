# API Specification

Next.js route handlers under `/api`. JSON request/response validated with the shared Zod
schemas in `src/lib/schemas` (client and server import the same schemas). All routes
require a session unless marked *public*. Authorization via `requireProjectAccess()` —
see `02-architecture.md` §4.

Conventions: REST-ish, kebab-case URLs, `id` = uuid. Errors:
`{ error: { code: string, message: string } }` with proper HTTP status; 404 for
"exists but you may not know it exists".
Pagination: `?cursor=<id>&limit=<n>` → `{ items, nextCursor }`.

## 1. Auth

| Method & path | Purpose |
|---|---|
| `POST /api/auth/*` | Auth.js handlers (login, logout, session) |
| `POST /api/invites/:token/accept` *public* | body `{ name, password, locale }` → activates account |
| `POST /api/auth/forgot-password` *public* | body `{ email }` → always 200 |
| `POST /api/auth/reset-password` *public* | body `{ token, password }` |

## 2. Projects

| Method & path | Role | Purpose |
|---|---|---|
| `GET /api/projects` | any | ADMIN: all + dashboard aggregates; CLIENT: own projects (portal shape) |
| `POST /api/projects` | ADMIN | create; body includes `templateId?`, `prunedTaskTemplateIds?` |
| `GET /api/projects/:id` | member | detail (shape depends on role) |
| `PATCH /api/projects/:id` | ADMIN | metadata, status, weights |
| `POST /api/projects/:id/members` | ADMIN | `{ email, name, locale }` → creates CLIENT user + invite |
| `DELETE /api/projects/:id/members/:userId` | ADMIN | remove member |
| `POST /api/projects/:id/invites/:userId/resend` | ADMIN | resend invite |
| `GET /api/projects/:id/activity` | ADMIN | full log (paginated); `?clientFeed=1` member → filtered feed |
| `GET /api/projects/:id/contacts` / `POST` / `PATCH /api/contacts/:id` / `DELETE` | ADMIN | external contacts CRUD |

## 3. Phases & tasks

| Method & path | Role | Purpose |
|---|---|---|
| `GET /api/projects/:id/phases` | member | phases with tasks (role-filtered) + progress numbers |
| `POST /api/projects/:id/phases` | ADMIN | create phase |
| `PATCH /api/phases/:id` | ADMIN | rename, status, weight, order, visibility, description |
| `DELETE /api/phases/:id` | ADMIN | only when empty |
| `POST /api/phases/:id/tasks` | ADMIN | create task |
| `PATCH /api/tasks/:id` | ADMIN | any field incl. `{ status, order }` for dnd |
| `POST /api/tasks/reorder` | ADMIN | `{ moves: [{taskId, status, order}] }` batch, transactional |
| `DELETE /api/tasks/:id` | ADMIN | soft if ever client-visible |

## 4. Folders & files

| Method & path | Role | Purpose |
|---|---|---|
| `GET /api/projects/:id/folders` | member | tree + files (role-filtered), `?folderId=` for lazy loading |
| `POST /api/projects/:id/folders` | ADMIN | create folder |
| `PATCH /api/folders/:id` / `DELETE` | ADMIN | rename/move/visibility; delete only when empty |
| `POST /api/projects/:id/files` | member* | multipart upload (multiple). CLIENT allowed **only** into folder with `systemKey="from_client"`. Same name in folder ⇒ new version |
| `GET /api/files/:id` | member* | metadata + versions + comments |
| `PATCH /api/files/:id` | ADMIN | rename, move, visibility, validUntil |
| `DELETE /api/files/:id` | ADMIN | soft/hard per rules |
| `GET /api/files/:id/download?version=n` | member* | streams; checks visibility for CLIENT |
| `GET /api/files/:id/thumbnail` | member* | webp thumb (images/pdf page 1) |
| `GET /api/projects/:id/files/zip` | member* | streamed ZIP of (visible) files |

`member*` = CLIENT restricted by visibility chain.

## 5. Chat

| Method & path | Role | Purpose |
|---|---|---|
| `GET /api/projects/:id/chat?cursor&limit=50` | member | messages, newest first, with attachments + read receipts |
| `POST /api/projects/:id/chat` | member | `{ body }` or multipart with attachments |
| `PATCH /api/chat/:messageId` | author | edit within 15 min |
| `DELETE /api/chat/:messageId` | author/ADMIN | soft delete |
| `POST /api/projects/:id/chat/read` | member | `{ lastMessageId }` → upserts ChatRead rows |

## 6. Comments

| Method & path | Role | Purpose |
|---|---|---|
| `GET /api/{tasks|files}/:id/comments` | member* | thread |
| `POST /api/{tasks|files}/:id/comments` | member* | `{ body, parentId? }` |
| `PATCH /api/comments/:id` / `DELETE` | author/ADMIN | edit / soft delete |

## 7. Notifications & events

| Method & path | Role | Purpose |
|---|---|---|
| `GET /api/notifications?cursor` | any | own notifications |
| `POST /api/notifications/read` | any | `{ ids }` or `{ all: true }` |
| `GET /api/events` | any | **SSE**: `chat.message`, `notification.new`, `task.updated`, `file.added`, `typing` — each `{ projectId, entityId, ... }`, filtered server-side to what the user may see |
| `GET /api/health` *public* | — | `{ ok, db }` |

## 8. Profile & GDPR

| Method & path | Role | Purpose |
|---|---|---|
| `GET/PATCH /api/me` | any | profile, locale, emailDigest, password change |
| `GET /api/me/export` | any | JSON export |
| `POST /api/users/:id/deactivate` / `anonymize` | ADMIN | GDPR actions |

## 9. Cross-cutting requirements

1. Every mutating handler: Zod-validate → authorize → mutate in transaction →
   `logActivity()` → publish SSE event → create Notifications (visibility-filtered) →
   return fresh entity.
2. Uploads stream to disk (no buffering whole file in memory); reject at first byte over limit.
3. All list endpoints role-shape their output — **CLIENT responses must not contain**
   internal fields (`visibility` values of other items, internal task titles, contact
   emails, activity raw log, storageKeys).
4. Rate limits: auth 5/min/IP; uploads 60/h/user; chat 30/min/user.
5. OpenAPI not required, but each route handler exports its Zod schemas so agents/tests
   can import request/response types.
