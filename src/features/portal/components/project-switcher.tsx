"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PortalProjectSummary } from "@/features/portal/types";

interface ProjectSwitcherProps {
  projects: PortalProjectSummary[];
  activeProjectId: string;
  /** Base path the user should land on after switching, e.g. "/portal" or "/portal/documents". */
  basePath: string;
}

/**
 * Project switcher shown when a CLIENT belongs to more than one project (spec/04-features.md
 * §8: "Client home = their project (or project switcher if multiple)"). Hidden entirely
 * when there is only one project — the common case — to keep the hero uncluttered.
 */
export function ProjectSwitcher({ projects, activeProjectId, basePath }: ProjectSwitcherProps) {
  const t = useTranslations("portal.switcher");
  const router = useRouter();

  if (projects.length <= 1) return null;

  return (
    <Select
      value={activeProjectId}
      onValueChange={(projectId) => router.push(`${basePath}?project=${projectId}`)}
    >
      <SelectTrigger size="sm" aria-label={t("label")} className="bg-card">
        <SelectValue placeholder={t("label")} />
      </SelectTrigger>
      <SelectContent>
        {projects.map((project) => (
          <SelectItem key={project.id} value={project.id}>
            {project.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
