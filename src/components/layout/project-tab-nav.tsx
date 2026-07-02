"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface ProjectTabNavProps {
  projectId: string;
  className?: string;
}

/** Horizontal tab nav for a project's admin pages: Overview · Phases & Tasks · Files · Chat · Activity · Settings. */
export function ProjectTabNav({ projectId, className }: ProjectTabNavProps) {
  const pathname = usePathname();
  const t = useTranslations("nav.project");
  const base = `/projects/${projectId}`;

  const tabs = [
    { href: base, label: t("overview") },
    { href: `${base}/tasks`, label: t("tasks") },
    { href: `${base}/files`, label: t("files") },
    { href: `${base}/chat`, label: t("chat") },
    { href: `${base}/activity`, label: t("activity") },
    { href: `${base}/settings`, label: t("settings") },
  ];

  return (
    <nav
      className={cn("flex gap-1 overflow-x-auto border-b border-border", className)}
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
  );
}
