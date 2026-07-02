"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { MessageCircle } from "lucide-react";

interface FloatingChatButtonProps {
  unreadCount: number;
}

/**
 * Persistent chat entry point, floating on mobile (spec/06-ui-ux.md §3.6 step 5). On
 * larger screens it still renders but as a normal inline button lower in the layout so
 * it doesn't obscure content — the floating treatment is the point on phones, where the
 * portal is actually used per spec/07-agent-workplan.md WP-7 note.
 */
export function FloatingChatButton({ unreadCount }: FloatingChatButtonProps) {
  const t = useTranslations("portal.home");

  return (
    <Link
      href="/portal/messages"
      className="fixed right-4 bottom-4 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-md transition-transform duration-150 hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:right-6 sm:bottom-6"
      aria-label={t("openChat")}
    >
      <MessageCircle className="size-4" />
      {t("openChat")}
      {unreadCount > 0 && (
        <span className="flex min-w-5 items-center justify-center rounded-full bg-white/90 px-1.5 py-0.5 text-xs font-semibold text-primary">
          {unreadCount}
        </span>
      )}
    </Link>
  );
}
