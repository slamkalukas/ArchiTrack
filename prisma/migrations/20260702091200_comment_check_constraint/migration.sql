-- Enforce spec/03-data-model.md §3.1: a Comment must reference exactly one of task/file.
-- Prisma cannot express this constraint declaratively, hence a raw-SQL migration.
ALTER TABLE "Comment"
  ADD CONSTRAINT "Comment_task_or_file_check"
  CHECK (
    ("taskId" IS NOT NULL AND "fileId" IS NULL)
    OR ("taskId" IS NULL AND "fileId" IS NOT NULL)
  );
