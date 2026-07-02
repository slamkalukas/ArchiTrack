# UI / UX Specification

The application must look like it was designed by an architect: calm, precise, generous
whitespace, confident typography. It is shown to paying clients — polish is a functional
requirement, not decoration.

## 1. Design language

- **Mood**: gallery-like minimalism. White/warm-paper surfaces, near-black ink text,
  one restrained accent. Think architectural portfolio, not SaaS admin.
- **Palette** (CSS variables, themable):
  - `--surface` #FAFAF8 (warm paper), `--surface-raised` #FFFFFF
  - `--ink` #1A1A1A, `--ink-muted` #6B6B66
  - `--accent` #2F5D50 (deep architectural green) — links, active states, progress
  - `--accent-soft` #E8EFEC — fills, selected rows
  - Status: todo #9CA3AF · in-progress #B07C3F (ochre) · done #2F5D50
  - Danger #B04A3F. Never more than these on one screen.
- **Typography**: headings **Fraunces** (or Canela-like serif) for the representative
  feel; UI text **Inter**. Base 16 px, 1.5 line height. Project names in serif — this is
  the signature detail on cards, client hero, and PDFs of the future.
- **Geometry**: 4 px spacing grid; radius 8 px (cards 12 px); hairline borders
  (#E5E5E0) instead of shadows; one soft shadow level for modals only.
- **Imagery**: project cover images are first-class (cards, client hero). Elegant
  fallback: generated blueprint-style monogram on `--accent-soft`.
- **Motion**: 150–200 ms ease-out transitions; progress ring animates on load once.
  No bouncing, no confetti — except a single subtle moment when a **milestone**
  completes on the client timeline (drawn check animation).
- Charts/progress visuals follow the dataviz skill conventions (thin ring, muted
  track, accent fill, numeral in serif).

## 2. Layout system

- **Admin**: left sidebar (logo, Projects, Inbox, Settings, profile) → project pages use
  horizontal tab nav (Overview · Phases & Tasks · Files · Chat · Activity · Settings).
- **Client**: top bar only (logo/architect brand left, language switch, bell, avatar
  right), content max-width 1100 px centered. Tabs: Prehľad · Postup · Dokumenty · Správy.
- Fully responsive; client portal designed mobile-first (they'll open it on phones).
  Admin optimized for desktop but usable on tablet.

## 3. Key screens

### 3.1 Login / invite
Split screen: left = brand panel with large serif wordmark and a duotone architectural
photo; right = minimal form. Locale switch top-right. Invite acceptance shows the
project name they're joining ("Boli ste pozvaní do projektu **RD Novákovci**").

### 3.2 Admin dashboard
Grid of project cards (cover, serif name, client names, phase chip, thin progress bar,
unread/overdue badges). Right rail: notification inbox + "Expiring documents" list.

### 3.3 Phases & tasks
Phase accordion header: order number in serif, name, status chip, progress bar, weight.
Kanban: three columns, cards show title, due date chip (red when overdue), milestone
flag (small diamond ◆), visibility eye icon (toggles on hover — one click to publish a
task to the client), comment count. Drag with dnd-kit; keyboard reordering supported
(a11y).

### 3.4 Files
Two-pane: folder tree left, file table right (name, version badge "v3", size, date,
visibility eye, validUntil warning icon when < 30 days, comments count). Drop anywhere
to upload into the open folder. Preview drawer from the right (PDF viewer / image
lightbox) with the comment thread underneath.

### 3.5 Chat
Classic thread, right-aligned own messages on `--accent-soft`, day separators, "Seen"
under last read message, attachment tiles with thumbnails. Composer sticks to bottom.

### 3.6 Client — Prehľad (the showpiece)
1. Hero: cover image with soft gradient, project name in large serif, location line.
2. Progress ring (large, animated once) + current phase name and its plain-language
   description ("Práve prebieha: Povoľovací proces — čakáme na vyjadrenia sietí").
3. Horizontal milestone timeline: done ◆ filled, upcoming ◆ outlined, with dates.
4. Two columns: "Najnovšie dokumenty" (5 latest visible files with type icons) and
   "Aktuality" (friendly activity feed: "Ing. arch. pridala 3 nové výkresy").
5. Persistent chat button (floating on mobile).

### 3.7 Client — Postup
Vertical phase list (no kanban — too "project-manager" for clients): each phase a card
with progress bar and its visible tasks as a checklist (✓ done, ● in progress, ○ todo),
due dates only where set. Milestones highlighted.

## 4. UX rules

1. **Two-click rule** (client): any content ≤ 2 clicks from landing.
2. **Publish is explicit**: internal→visible always requires a click on the eye icon or
   the "share with client" checkbox at upload time; bulk "publish folder" exists with a
   confirmation listing what becomes visible.
3. **Empty states teach**: every empty tab shows a one-line explanation + illustration
   (thin-line architectural sketches).
4. **Optimistic UI** everywhere with rollback toasts ("Nepodarilo sa uložiť — skúste znova").
5. **Confirmations** only for destructive/visible-to-client actions; everything else is
   undoable via toast "Späť".
6. Errors in human Slovak/English, never codes; global error boundary with a "napíšte mi"
   mailto fallback.
7. A11y: WCAG 2.1 AA; all dnd has keyboard path; focus states visible (2 px accent
   outline); contrast checked for the ochre chip.
8. Language switcher on every screen incl. login; user choice persists to profile.

## 5. Email templates

Shared layout: white card on paper background, serif heading, one accent button, plain-text
alternative. Templates: invite, password reset, new message, new comment, task/phase
update, milestone reached, daily digest, expiring document (admin). All bilingual via the
same message catalogs.

## 6. Component inventory (shadcn/ui base + custom)

Custom components agents must build once and reuse: `ProgressRing`, `PhaseAccordion`,
`TaskCard`, `KanbanColumn`, `FileTable`, `FolderTree`, `PreviewDrawer`, `ChatThread`,
`MessageComposer`, `MilestoneTimeline`, `VisibilityToggle` (eye), `EmptyState`,
`NotificationBell`, `ProjectCard`, `CoverImagePicker`, `LocaleSwitcher`.
Storybook-like showcase page at `/dev/ui` (dev only) so visual QA is easy.
