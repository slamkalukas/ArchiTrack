import { getTranslations } from "next-intl/server";
import { ProgressRing } from "@/components/shared/progress-ring";
import type { PortalProjectSummary } from "@/features/portal/types";

interface PortalHeroProps {
  project: PortalProjectSummary;
}

/** Blueprint-style monogram fallback for projects without a cover image (spec/06-ui-ux.md §1). */
function CoverFallback({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  return (
    <div className="flex h-full w-full items-center justify-center bg-[var(--accent-soft)]">
      <span className="font-serif text-5xl text-primary/70">{initials || "AT"}</span>
    </div>
  );
}

/**
 * Prehľad hero (spec/06-ui-ux.md §3.6 step 1-2, the showpiece): cover image with soft
 * gradient, project name in large serif, location line, and the big animated progress
 * ring with the current phase's plain-language description.
 */
export async function PortalHero({ project }: PortalHeroProps) {
  const t = await getTranslations("portal.home");
  const tCommon = await getTranslations("common");

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="relative h-48 w-full sm:h-64">
        {project.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={project.coverImageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <CoverFallback name={project.name} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8">
          <h1 className="font-serif text-3xl text-white sm:text-4xl">{project.name}</h1>
          {project.locationText && (
            <p className="mt-1 text-sm text-white/85">{project.locationText}</p>
          )}
        </div>
      </div>

      <div className="flex flex-col items-center gap-4 px-5 py-8 text-center sm:px-8">
        <ProgressRing
          value={project.progress}
          size={180}
          sublabel={t("progress")}
          aria-label={tCommon("progressLabel", { percent: project.progress })}
        />
        {project.currentPhase && (
          <div className="max-w-xl space-y-1">
            <p className="text-sm text-muted-foreground">
              {t("currentlyRunning")}: <span className="font-medium text-foreground">{project.currentPhase.name}</span>
            </p>
            {project.currentPhase.description && (
              <p className="text-sm text-muted-foreground">{project.currentPhase.description}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

