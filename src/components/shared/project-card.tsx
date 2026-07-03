import Link from "next/link";
import { useTranslations } from "next-intl";
import { MessageCircle, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ProjectCardData } from "@/components/shared/types";

interface ProjectCardProps {
  project: ProjectCardData;
  href?: string;
  className?: string;
}

/** Blueprint-style monogram fallback for projects without a cover image. */
function CoverFallback({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  return (
    <div className="flex h-full w-full items-center justify-center bg-[var(--accent-soft)]">
      <span className="font-serif text-3xl text-primary/70">{initials || "AT"}</span>
    </div>
  );
}

/** Admin dashboard project card: cover, serif name, clients, phase chip, progress. */
export function ProjectCard({ project, href, className }: ProjectCardProps) {
  const t = useTranslations("ui.projectCard");
  const tCommon = useTranslations("common");

  const body = (
    <Card
      className={cn(
        "overflow-hidden py-0 transition-shadow duration-150 hover:shadow-sm",
        className,
      )}
    >
      <div className="relative h-36 w-full overflow-hidden">
        {project.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={project.coverImageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <CoverFallback name={project.name} />
        )}
        {(project.unreadCount ?? 0) > 0 && (
          <span className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-card/90 px-2 py-0.5 text-xs font-medium text-foreground shadow-sm">
            <MessageCircle className="size-3" />
            {project.unreadCount}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-3 px-5 pt-4 pb-5">
        <div>
          <h3 className="font-serif text-lg leading-tight text-foreground">{project.name}</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">{project.clientNames.join(", ")}</p>
        </div>
        <div className="flex items-center justify-between gap-2">
          <Badge variant="outline">{project.phaseName}</Badge>
          {(project.overdueCount ?? 0) > 0 && (
            <span className="flex items-center gap-1 text-xs font-medium text-destructive">
              <AlertTriangle className="size-3" />
              {t("overdue", { count: project.overdueCount ?? 0 })}
            </span>
          )}
        </div>
        <div className="space-y-1.5">
          <Progress value={project.progress} aria-label={tCommon("progressLabel", { percent: project.progress })} />
          <p className="text-right text-xs tabular-nums text-muted-foreground">
            {project.progress}%
          </p>
        </div>
      </div>
    </Card>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
      >
        {body}
      </Link>
    );
  }

  return body;
}
