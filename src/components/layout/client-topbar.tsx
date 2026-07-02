"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { LogOut, Settings } from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { LocaleSwitcher } from "@/components/shared/locale-switcher";
import { NotificationBell, type NotificationItem } from "@/components/shared/notification-bell";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ClientTopbarProps {
  userName: string;
  notifications?: NotificationItem[];
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

/** Client top bar only: logo left, language/bell/avatar right — spec/06-ui-ux.md §2. */
export function ClientTopbar({ userName, notifications = [] }: ClientTopbarProps) {
  const pathname = usePathname();
  const t = useTranslations("nav.client");

  const tabs = [
    { href: "/portal", label: t("overview") },
    { href: "/portal/progress", label: t("progress") },
    { href: "/portal/documents", label: t("documents") },
    { href: "/portal/messages", label: t("messages") },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1100px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/portal" className="font-serif text-lg text-foreground">
          ArchiTrack
        </Link>
        <div className="flex items-center gap-1">
          <LocaleSwitcher />
          <NotificationBell items={notifications} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={userName}
                className="ml-1 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Avatar className="size-8">
                  <AvatarFallback>{initialsOf(userName)}</AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem asChild>
                <Link href="/portal/profile">
                  <Settings className="size-4" />
                  {t("profile")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => signOut({ callbackUrl: "/login" })}
              >
                <LogOut className="size-4" />
                {t("logout")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <nav
        className="mx-auto flex max-w-[1100px] gap-1 overflow-x-auto px-4 sm:px-6"
        aria-label={t("overview")}
      >
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors duration-150",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
