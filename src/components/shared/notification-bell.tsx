"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";

export interface NotificationItem {
  id: string;
  title: string;
  timeLabel: string;
  read: boolean;
  href?: string;
}

interface NotificationBellProps {
  items?: NotificationItem[];
  className?: string;
}

/** Bell with unread badge + dropdown list, per spec/06-ui-ux.md §3.2 (admin) and §2 (client top bar). */
export function NotificationBell({ items = [], className }: NotificationBellProps) {
  const t = useTranslations("ui.notifications");
  const [open, setOpen] = useState(false);
  const unread = items.filter((i) => !i.read).length;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t("label")}
          className={cn("relative", className)}
        >
          <Bell className="size-4" />
          {unread > 0 && (
            <span className="absolute top-1 right-1 flex size-2 rounded-full bg-destructive" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>{t("title")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <div className="p-2">
            <EmptyState title={t("empty")} className="border-none px-2 py-6" />
          </div>
        ) : (
          <div className="flex max-h-80 flex-col overflow-y-auto">
            {items.map((item) => (
              <DropdownMenuItem key={item.id} className="flex flex-col items-start gap-0.5 py-2">
                <span className={cn("text-sm", !item.read && "font-medium text-foreground")}>
                  {item.title}
                </span>
                <span className="text-xs text-muted-foreground">{item.timeLabel}</span>
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
