"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Plus, Search, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProjectCard, EmptyState, type NotificationItem } from "@/components/shared";
import { NotificationBellContainer } from "@/features/notifications/components/notification-bell-container";
import type { DashboardProjectCardDto } from "@/features/projects/types";

interface DashboardViewProps {
  initialProjects: DashboardProjectCardDto[];
  notifications: NotificationItem[];
}

type StatusFilter = "ACTIVE" | "ON_HOLD" | "ARCHIVED";

/** Admin dashboard: project cards grid + filters + right rail (spec/06-ui-ux.md §3.2, spec/04-features.md §2). */
export function DashboardView({ initialProjects, notifications }: DashboardViewProps) {
  const t = useTranslations("dashboard");
  const [status, setStatus] = useState<StatusFilter>("ACTIVE");
  const [search, setSearch] = useState("");
  const [projects, setProjects] = useState(initialProjects);
  const [loading, setLoading] = useState(false);

  const filtered = useMemo(() => {
    if (!search.trim()) return projects;
    const needle = search.trim().toLowerCase();
    return projects.filter((p) => p.name.toLowerCase().includes(needle));
  }, [projects, search]);

  async function handleStatusChange(next: StatusFilter) {
    setStatus(next);
    setLoading(true);
    try {
      const res = await fetch(`/api/projects?status=${next}`);
      if (res.ok) {
        const data = (await res.json()) as { items: DashboardProjectCardDto[] };
        setProjects(data.items);
      }
    } finally {
      setLoading(false);
    }
  }

  const expiringProjects = projects.filter((p) => p.expiringFileCount > 0);

  return (
    <div className="mx-auto flex max-w-7xl gap-8 px-6 py-10">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl text-foreground">{t("title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
          </div>
          <Button asChild>
            <Link href="/projects/new">
              <Plus className="size-4" />
              {t("newProject")}
            </Link>
          </Button>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="pl-9"
              aria-label={t("searchPlaceholder")}
            />
          </div>
          <Select value={status} onValueChange={(v) => handleStatusChange(v as StatusFilter)}>
            <SelectTrigger className="w-44" aria-label={t("filters.all")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ACTIVE">{t("filters.active")}</SelectItem>
              <SelectItem value="ON_HOLD">{t("filters.onHold")}</SelectItem>
              <SelectItem value="ARCHIVED">{t("filters.archived")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="mt-8" aria-busy={loading}>
          {filtered.length === 0 ? (
            search ? (
              <EmptyState title={t("emptyFiltered.title")} description={t("emptyFiltered.description")} />
            ) : (
              <EmptyState
                title={t("empty.title")}
                description={t("empty.description")}
                action={
                  <Button asChild size="sm">
                    <Link href="/projects/new">{t("empty.action")}</Link>
                  </Button>
                }
              />
            )
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((project) => (
                <ProjectCard
                  key={project.id}
                  href={`/projects/${project.id}`}
                  project={{
                    id: project.id,
                    name: project.name,
                    clientNames: project.clientNames,
                    phaseName: project.phaseName ?? "—",
                    progress: project.progress,
                    coverImageUrl: project.coverImageUrl,
                    unreadCount: project.unreadCount,
                    overdueCount: project.overdueTaskCount,
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <aside className="hidden w-80 shrink-0 flex-col gap-6 lg:flex">
        <section className="rounded-xl border border-border bg-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-serif text-base text-foreground">{t("inbox.title")}</h2>
            <NotificationBellContainer />
          </div>
          {notifications.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("inbox.empty")}</p>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-2 font-serif text-base text-foreground">{t("expiring.title")}</h2>
          {expiringProjects.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("expiring.empty")}</p>
          ) : (
            <ul className="space-y-2">
              {expiringProjects.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/projects/${p.id}/files`}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground transition-colors duration-150 hover:bg-secondary/60"
                  >
                    <AlertTriangle className="size-3.5 shrink-0 text-destructive" />
                    <span className="truncate">{p.name}</span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                      {p.expiringFileCount}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>
    </div>
  );
}
