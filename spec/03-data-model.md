# Data Model

**This file is the highest-authority document in the pack.** The Prisma schema below is the
integration contract between agents. Changes require updating this file in the same PR.

## 1. Entity overview

```
User ──< ProjectMember >── Project ──< Phase ──< Task ──< Comment
                              │            │
                              │            └──< TaskAssignment (external contacts)
                              ├──< Folder ──< File ──< FileVersion, Comment
                              ├──< ChatMessage (── File attachments)
                              ├──< ActivityLog
                              └──< Contact (external: statik, geodet, úrady…)
ProjectTemplate ──< PhaseTemplate ──< TaskTemplate      (seed: "Rodinný dom SK")
Notification >── User
```

## 2. Prisma schema (authoritative)

```prisma
// prisma/schema.prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }

enum Role            { ADMIN CLIENT }
enum ProjectStatus   { ACTIVE ON_HOLD ARCHIVED }
enum PhaseStatus     { UPCOMING ACTIVE DONE SKIPPED }
enum TaskStatus      { TODO IN_PROGRESS DONE }
enum AssigneeType    { ARCHITECT EXTERNAL }
enum Visibility      { INTERNAL CLIENT_VISIBLE }
enum NotifKind       { CHAT_MESSAGE COMMENT TASK_STATUS FILE_ADDED PHASE_DONE MILESTONE INVITE EXPIRY_WARNING }
enum Locale          { sk en }

model User {
  id            String   @id @default(uuid())
  email         String   @unique
  name          String
  passwordHash  String?              // null until invite accepted
  role          Role
  locale        Locale   @default(sk)
  phone         String?
  avatarUrl     String?
  emailDigest   Boolean  @default(true)   // immediate emails vs daily digest
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
  memberships   ProjectMember[]
  messages      ChatMessage[]
  comments      Comment[]
  notifications Notification[]
  invites       Invite[]
}

model Invite {
  id        String   @id @default(uuid())
  token     String   @unique
  user      User     @relation(fields: [userId], references: [id])
  userId    String
  expiresAt DateTime
  usedAt    DateTime?
}

model Project {
  id           String        @id @default(uuid())
  name         String                        // "RD Novákovci — Pezinok"
  slug         String        @unique
  status       ProjectStatus @default(ACTIVE)
  locationText String?                       // site address / parcel
  coverImageId String?                       // File id, shown on cards & client home
  description  String?                       // client-visible intro text
  startDate    DateTime?
  targetDate   DateTime?
  createdAt    DateTime      @default(now())
  archivedAt   DateTime?
  members      ProjectMember[]
  phases       Phase[]
  folders      Folder[]
  files        File[]
  chat         ChatMessage[]
  contacts     Contact[]
  activity     ActivityLog[]
}

model ProjectMember {
  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  projectId String
  user      User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId    String
  // role is read from User.role; kept simple for v1, table exists so team roles can land later
  addedAt   DateTime @default(now())
  @@id([projectId, userId])
}

model Phase {
  id          String      @id @default(uuid())
  project     Project     @relation(fields: [projectId], references: [id], onDelete: Cascade)
  projectId   String
  name        String                       // SK name; EN handled via UI when from template key
  templateKey String?                      // e.g. "sk_house.permits" → enables translated names
  order       Int
  status      PhaseStatus @default(UPCOMING)
  weight      Int         @default(10)     // % weight for project progress
  description String?                      // client-visible explanation of the phase
  visibility  Visibility  @default(CLIENT_VISIBLE)
  tasks       Task[]
  @@unique([projectId, order])
}

model Task {
  id           String     @id @default(uuid())
  phase        Phase      @relation(fields: [phaseId], references: [id], onDelete: Cascade)
  phaseId      String
  title        String
  description  String?
  status       TaskStatus @default(TODO)
  order        Int                          // order within status column (kanban)
  weight       Int        @default(1)
  milestone    Boolean    @default(false)
  visibility   Visibility @default(INTERNAL)
  assigneeType AssigneeType @default(ARCHITECT)
  contact      Contact?   @relation(fields: [contactId], references: [id])
  contactId    String?                      // when assigneeType = EXTERNAL
  dueDate      DateTime?
  doneAt       DateTime?
  createdAt    DateTime   @default(now())
  comments     Comment[]
}

model Contact {                             // external parties: statik, geodet, stavebný úrad…
  id        String  @id @default(uuid())
  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  projectId String
  name      String
  role      String                          // "Statik", "Projektant ZTI", "Stavebný úrad Pezinok"
  email     String?
  phone     String?
  note      String?
  tasks     Task[]
}

model Folder {
  id         String     @id @default(uuid())
  project    Project    @relation(fields: [projectId], references: [id], onDelete: Cascade)
  projectId  String
  parent     Folder?    @relation("FolderTree", fields: [parentId], references: [id])
  parentId   String?
  children   Folder[]   @relation("FolderTree")
  name       String
  order      Int        @default(0)
  systemKey  String?                        // "from_client" folder is special: clients may upload
  visibility Visibility @default(INTERNAL)
  files      File[]
  @@unique([projectId, parentId, name])
}

model File {
  id          String      @id @default(uuid())
  project     Project     @relation(fields: [projectId], references: [id], onDelete: Cascade)
  projectId   String
  folder      Folder?     @relation(fields: [folderId], references: [id])
  folderId    String?
  name        String                       // original display name, e.g. "podorys_1np_v3.pdf"
  visibility  Visibility  @default(INTERNAL)
  validUntil  DateTime?                    // for vyjadrenia with limited validity
  createdAt   DateTime    @default(now())
  versions    FileVersion[]
  comments    Comment[]
  chatMessage ChatMessage? @relation(fields: [chatMessageId], references: [id])
  chatMessageId String?                    // set when the file arrived as a chat attachment
}

model FileVersion {
  id         String   @id @default(uuid())
  file       File     @relation(fields: [fileId], references: [id], onDelete: Cascade)
  fileId     String
  version    Int                            // 1..n; latest = max(version)
  storageKey String   @unique               // uuid path under UPLOADS_DIR
  size       Int
  mimeType   String
  uploadedBy String                         // User id
  createdAt  DateTime @default(now())
  @@unique([fileId, version])
}

model ChatMessage {
  id        String   @id @default(uuid())
  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  projectId String
  author    User     @relation(fields: [authorId], references: [id])
  authorId  String
  body      String                          // markdown-lite (bold, links, line breaks)
  createdAt DateTime @default(now())
  editedAt  DateTime?
  deletedAt DateTime?                       // soft delete, shows "message removed"
  attachments File[]
  reads     ChatRead[]
}

model ChatRead {                            // read receipts / unread counters
  message   ChatMessage @relation(fields: [messageId], references: [id], onDelete: Cascade)
  messageId String
  userId    String
  readAt    DateTime    @default(now())
  @@id([messageId, userId])
}

model Comment {
  id        String   @id @default(uuid())
  author    User     @relation(fields: [authorId], references: [id])
  authorId  String
  body      String
  task      Task?    @relation(fields: [taskId], references: [id], onDelete: Cascade)
  taskId    String?
  file      File?    @relation(fields: [fileId], references: [id], onDelete: Cascade)
  fileId    String?
  parent    Comment? @relation("Thread", fields: [parentId], references: [id])
  parentId  String?                         // one level of threading only
  createdAt DateTime @default(now())
  deletedAt DateTime?
  // CHECK (task_id IS NOT NULL OR file_id IS NOT NULL) via migration SQL
}

model Notification {
  id        String    @id @default(uuid())
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId    String
  kind      NotifKind
  projectId String?
  entityId  String?                         // task/file/message/comment id
  titleKey  String                          // i18n key, params in payload
  payload   Json?
  readAt    DateTime?
  emailedAt DateTime?
  createdAt DateTime  @default(now())
  @@index([userId, readAt])
}

model ActivityLog {
  id        String   @id @default(uuid())
  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  projectId String
  actorId   String
  action    String                          // "file.uploaded", "task.status_changed", …
  entityId  String?
  meta      Json?
  createdAt DateTime @default(now())
  @@index([projectId, createdAt])
}

// ---- Templates (seed data, editable in settings) ----
model ProjectTemplate {
  id     String @id @default(uuid())
  name   String                             // "Rodinný dom SK"
  phases PhaseTemplate[]
}
model PhaseTemplate {
  id          String @id @default(uuid())
  template    ProjectTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
  templateId  String
  key         String                        // "sk_house.surveys" — i18n + folder mapping
  nameSk      String
  nameEn      String
  descriptionSk String?
  descriptionEn String?
  order       Int
  weight      Int
  tasks       TaskTemplate[]
}
model TaskTemplate {
  id         String @id @default(uuid())
  phase      PhaseTemplate @relation(fields: [phaseTemplateId], references: [id], onDelete: Cascade)
  phaseTemplateId String
  titleSk    String
  titleEn    String
  order      Int
  milestone  Boolean @default(false)
  assigneeType AssigneeType @default(ARCHITECT)
  defaultVisibility Visibility @default(INTERNAL)
}
```

## 3. Rules & invariants

1. `Comment` must reference exactly one of `task`/`file` (enforce with a DB CHECK in raw
   migration SQL; Prisma can't express it).
2. Client-visible file = `file.visibility = CLIENT_VISIBLE` **and** its folder chain has no
   `INTERNAL` folder. Same logic for tasks via their phase.
3. Deleting is soft wherever a client may have seen the content (chat, comments);
   hard-delete is allowed for internal-only entities.
4. `FileVersion.version` is assigned server-side in a transaction (`max+1`).
5. Task board ordering: `(status, order)`; reordering rewrites `order` within the column.
6. Seed (`prisma/seed.ts`): one ADMIN user (from env `SEED_ADMIN_EMAIL`), the full
   "Rodinný dom SK" template exactly as specified in `01-domain-analysis.md` §1
   (translations included), and one demo project generated from it.
