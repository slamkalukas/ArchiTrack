"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import type { PhaseDTO } from "@/features/tasks/schemas";
import type { Visibility } from "@/components/shared/types";

export interface PhaseFormValues {
  name: string;
  description: string;
  weight: number;
  visibility: Visibility;
}

interface PhaseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phase?: PhaseDTO | null;
  onSubmit: (values: PhaseFormValues) => Promise<void>;
}

/** Create/edit phase modal (spec/05-api.md §3: name, description, weight, visibility).
 * Mounts `PhaseModalForm` fresh (keyed by phase id) on open so initial state comes
 * straight from props with no reset-effect needed. */
export function PhaseModal({ open, onOpenChange, phase, onSubmit }: PhaseModalProps) {
  if (!open) {
    return <Dialog open={false} onOpenChange={onOpenChange} />;
  }
  return <PhaseModalForm key={phase?.id ?? "new"} open={open} onOpenChange={onOpenChange} phase={phase} onSubmit={onSubmit} />;
}

function PhaseModalForm({ open, onOpenChange, phase, onSubmit }: PhaseModalProps) {
  const t = useTranslations("phases");
  const tc = useTranslations("common");
  const isEdit = !!phase;

  const [values, setValues] = useState<PhaseFormValues>(() =>
    phase
      ? { name: phase.name, description: phase.description ?? "", weight: phase.weight, visibility: phase.visibility }
      : emptyValues(),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!values.name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await onSubmit(values);
      onOpenChange(false);
    } catch {
      setError(tc("error.generic"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? t("editPhaseTitle") : t("newPhaseTitle")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="phase-name">{t("name")}</Label>
            <Input
              id="phase-name"
              value={values.name}
              onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
              required
              maxLength={200}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phase-description">{t("description")}</Label>
            <Textarea
              id="phase-description"
              value={values.description}
              onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="phase-weight">{t("weight")}</Label>
              <Input
                id="phase-weight"
                type="number"
                min={0}
                max={1000}
                value={values.weight}
                onChange={(e) => setValues((v) => ({ ...v, weight: Number(e.target.value) || 0 }))}
              />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm text-foreground">
                <Checkbox
                  checked={values.visibility === "CLIENT_VISIBLE"}
                  onCheckedChange={(checked) =>
                    setValues((v) => ({ ...v, visibility: checked === true ? "CLIENT_VISIBLE" : "INTERNAL" }))
                  }
                />
                {t("visibility")}
              </label>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              {tc("cancel")}
            </Button>
            <Button type="submit" disabled={saving}>
              {tc("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function emptyValues(): PhaseFormValues {
  return { name: "", description: "", weight: 10, visibility: "CLIENT_VISIBLE" };
}
