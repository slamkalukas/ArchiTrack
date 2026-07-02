"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PhaseWeightDto } from "@/features/projects/types";

interface WeightsSettingsTabProps {
  projectId: string;
  phases: PhaseWeightDto[];
  onSaved: () => void;
}

/** Settings → Phase weights editor (spec/04-features.md §3, spec/02-architecture.md §6). */
export function WeightsSettingsTab({ projectId, phases, onSaved }: WeightsSettingsTabProps) {
  const t = useTranslations("projects.settings.weights");
  const [weights, setWeights] = useState<Record<string, number>>(
    Object.fromEntries(phases.map((p) => [p.id, p.weight])),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = useMemo(() => Object.values(weights).reduce((sum, w) => sum + (Number.isFinite(w) ? w : 0), 0), [weights]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phaseWeights: weights }),
    });
    setSaving(false);
    if (!res.ok) {
      setError(t("save"));
      return;
    }
    onSaved();
  }

  if (phases.length === 0) {
    return <p className="text-sm text-muted-foreground">—</p>;
  }

  return (
    <div className="max-w-md">
      <p className="mb-4 text-sm text-muted-foreground">{t("description")}</p>
      <div className="flex flex-col gap-3">
        {phases
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((phase) => (
            <div key={phase.id} className="flex items-center justify-between gap-4">
              <Label htmlFor={`weight-${phase.id}`} className="min-w-0 flex-1 truncate font-normal">
                {phase.name}
              </Label>
              <Input
                id={`weight-${phase.id}`}
                type="number"
                min={0}
                max={100}
                className="w-20"
                value={weights[phase.id] ?? 0}
                onChange={(e) =>
                  setWeights((w) => ({ ...w, [phase.id]: Number(e.target.value) }))
                }
              />
            </div>
          ))}
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{t("total", { total })}</p>
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="button" onClick={handleSave} disabled={saving} className="mt-4">
        {t("save")}
      </Button>
    </div>
  );
}
