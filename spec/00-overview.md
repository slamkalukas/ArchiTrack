# ArchiTrack — Product Overview

> Spec pack version 1.0 · 2026-07-02 · Language of spec: English (UI is bilingual SK/EN)

## 1. Vision

ArchiTrack is a web application for a **solo architect in Slovakia** to manage residential
design projects (primarily family houses) and to give each **customer a polished, private
portal** where they can follow progress, view and download documents, chat with the
architect, and comment on files and tasks.

The application must feel **representative** — it is part of the architect's brand and will
be shown to paying clients — while remaining **simple enough for non-technical customers**
(a couple building their first house should understand it in under a minute).

## 2. Goals

1. One place for the architect to track every project through its real-life phases
   (study → permit documentation → professions → permits → construction support).
2. Customers see honest, up-to-date progress without phoning or emailing.
3. All project files (drawings, PDFs, photos, official statements) stored and versioned per project.
4. Communication (chat + comments) attached to the project context instead of scattered email threads.
5. Task tracking with a simple **To-do / In progress / Done** board, per project.
6. Self-hosted: runs on the owner's own server via **Docker Compose**. No third-party SaaS dependencies at runtime except outbound SMTP.

## 3. Non-goals (v1)

- No invoicing/accounting (may come later; data model must not block it).
- No multi-architect team accounts (data model is prepared for it — see `03-data-model.md` — but no UI).
- No native mobile apps; the web UI must be fully responsive instead.
- No public marketing site (separate concern).
- No integration with Slovak state systems (URBION e-filing etc.) — permits are tracked manually as tasks/documents.

## 4. Users and roles

| Role | Who | Capabilities |
|---|---|---|
| **ADMIN** (architect) | The owner, exactly one active in v1 | Everything: create projects, invite customers, manage phases/tasks/files, chat, settings |
| **CLIENT** (customer) | 1–n people per project (e.g. husband + wife) | See *their* project(s) only: progress, phases, tasks (read-only status), files marked visible, chat, comments; upload files to a dedicated "From client" area |

Rules:

- A client account can be linked to **multiple projects** (repeat customers) and a project can have **multiple client users**.
- Clients never see other projects, internal notes, internal files, or internal tasks.
- Every entity that a client could see carries an explicit **visibility flag** (`internal` vs `client_visible`). Default for new items: tasks `internal`, files `internal`, phases `client_visible`. The architect consciously publishes.

## 5. Core feature summary

1. **Project dashboard** (admin): all projects as cards with phase, % progress, unread messages, next deadline.
2. **Project detail** with tabs: Overview · Phases & Tasks · Files · Chat · Comments/Activity · Settings.
3. **Phase templates** modelled on the Slovak family-house workflow (see `01-domain-analysis.md`): creating a project can pre-populate phases and tasks from the "Rodinný dom SK" template.
4. **Kanban task board** (To-do / In progress / Done) + list view; tasks belong to phases; optional due dates and assignee (architect or "external" — e.g. statik).
5. **File management**: folders per phase/profession, drag-and-drop upload, versioning of same-named files, previews for PDF and images, per-file client visibility.
6. **Chat**: one thread per project between architect and that project's clients, with file attachments; real-time via SSE; unread counters; email notification if the recipient is offline.
7. **Comments**: on files and on tasks (client-visible ones), threaded one level.
8. **Progress calculation**: phase progress = weighted done tasks; project progress = weighted phases; both shown as elegant progress indicators to the customer.
9. **Notifications**: in-app bell + daily/immediate email digests (configurable per user).
10. **i18n**: full SK + EN, per-user language preference; SK is the default for clients.
11. **Audit/activity log** per project (who uploaded/changed what, when).

## 6. Quality attributes

- **Representative UI** — clean, architectural aesthetic; see `06-ui-ux.md`. This is a selling point, not an afterthought.
- **Easy** — customers receive an email invitation, set a password, land directly in their project.
- **Fast** — first meaningful paint of project page < 1.5 s on the target server; file upload up to 500 MB per file.
- **Safe** — HTTPS only, per-project authorization enforced server-side on every request and on every file download (no guessable public file URLs).
- **Durable** — Postgres + uploaded files live in named Docker volumes; documented backup procedure (see `02-architecture.md` §7).
- **GDPR-aware** — data stays on the owner's server in the EU; users can be exported/erased; see `04-features.md` §12.

## 7. Deliverable & deployment context

- Production: single Linux server owned by Lukas, `docker compose up -d` — services: reverse proxy (TLS), app, PostgreSQL. See `02-architecture.md`.
- Domain and SMTP credentials supplied via `.env`.

## 8. Spec pack map

| File | Contents |
|---|---|
| `00-overview.md` | This document |
| `01-domain-analysis.md` | Slovak family-house project anatomy: phases, professions, permits |
| `02-architecture.md` | Tech stack, repository layout, Docker Compose, security, backups |
| `03-data-model.md` | Entities, relations, Prisma-style schema |
| `04-features.md` | Functional requirements, feature by feature, with acceptance criteria |
| `05-api.md` | API surface (route handlers), auth, SSE, file endpoints |
| `06-ui-ux.md` | Design language, page-by-page UI spec, i18n rules |
| `07-agent-workplan.md` | Work packages for parallel AI agents, dependency graph, integration contract |

**Conflict rule for implementing agents:** if documents disagree, the priority order is
`03-data-model.md` > `05-api.md` > `04-features.md` > `06-ui-ux.md`. Update the spec in the
same PR when a deviation is unavoidable.
