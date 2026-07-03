"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";
import { useCommentThread, type CommentApiItem } from "@/features/comments/hooks/use-comment-thread";

interface CommentThreadProps {
  subjectKind: "task" | "file";
  subjectId: string;
  className?: string;
  /** Reports the live total (incl. replies) so embedders can keep count badges in sync. */
  onCountChange?: (count: number) => void;
}

function initialsOf(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?"
  );
}

/**
 * One-level threaded comments on a task or file (spec/04-features.md §7, spec/06-ui-ux.md §6
 * component inventory). Embedded by WP-4's task modal and WP-5's file preview drawer.
 * Server enforces visibility (client can only reach client-visible subjects) — this
 * component just renders whatever the API returns.
 */
export function CommentThread({ subjectKind, subjectId, className, onCountChange }: CommentThreadProps) {
  const t = useTranslations("comments.thread");
  const { comments, loading, error, post, posting } = useCommentThread(subjectKind, subjectId);
  const [value, setValue] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyValue, setReplyValue] = useState("");

  const total = comments.reduce((sum, c) => sum + 1 + c.replies.length, 0);
  useEffect(() => {
    if (!loading) onCountChange?.(total);
  }, [loading, total, onCountChange]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    await post(trimmed);
    setValue("");
  }

  async function handleReplySubmit(e: FormEvent, parentId: string) {
    e.preventDefault();
    const trimmed = replyValue.trim();
    if (!trimmed) return;
    await post(trimmed, parentId);
    setReplyValue("");
    setReplyTo(null);
  }

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {loading ? (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      ) : comments.length === 0 ? (
        <EmptyState title={t("emptyTitle")} description={t("emptyDescription")} className="py-8" />
      ) : (
        <ul className="flex flex-col gap-4">
          {comments.map((comment) => (
            <li key={comment.id} className="flex flex-col gap-2">
              <CommentRow comment={comment} />
              {comment.replies.length > 0 && (
                <ul className="ml-9 flex flex-col gap-2 border-l border-border pl-3">
                  {comment.replies.map((reply) => (
                    <li key={reply.id}>
                      <CommentRow comment={reply} />
                    </li>
                  ))}
                </ul>
              )}
              <div className="ml-9">
                {replyTo === comment.id ? (
                  <form onSubmit={(e) => handleReplySubmit(e, comment.id)} className="flex gap-2">
                    <input
                      autoFocus
                      value={replyValue}
                      onChange={(e) => setReplyValue(e.target.value)}
                      placeholder={t("replyPlaceholder")}
                      className="flex-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    <Button type="submit" size="sm" disabled={posting}>
                      {t("send")}
                    </Button>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setReplyTo(comment.id)}
                    className="text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    {t("reply")}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      <form onSubmit={handleSubmit} className="flex flex-col gap-2 border-t border-border pt-3">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t("placeholder")}
          rows={2}
          disabled={posting}
          className="resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={posting || !value.trim()}>
            {t("send")}
          </Button>
        </div>
      </form>
    </div>
  );
}

function CommentRow({ comment }: { comment: CommentApiItem | CommentApiItem["replies"][number] }) {
  const t = useTranslations("comments.thread");
  return (
    <div className="flex items-start gap-2.5">
      <Avatar className="size-7">
        <AvatarFallback className="text-xs">{initialsOf(comment.author.name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-foreground">{comment.author.name}</span>
          <span className="text-xs text-muted-foreground">
            {new Date(comment.createdAt).toLocaleString()}
          </span>
        </div>
        <p className={cn("text-sm", comment.deleted ? "text-muted-foreground italic" : "text-foreground")}>
          {comment.deleted ? t("deletedPlaceholder") : comment.body}
        </p>
      </div>
    </div>
  );
}
