"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import type { AdminProjectDetailDto } from "@/features/projects/types";

interface GeneralSettingsTabProps {
  project: AdminProjectDetailDto;
  onSaved: (updated: Partial<AdminProjectDetailDto>) => void;
}

/** Settings → General: metadata edit + archive toggle (spec/04-features.md §3). */
export function GeneralSettingsTab({ project, onSaved }: GeneralSettingsTabProps) {
  const t = useTranslations("projects.settings.general");
  const tCommon = useTranslations("common");
  const [name, setName] = useState(project.name);
  const [locationText, setLocationText] = useState(project.locationText ?? "");
  const [description, setDescription] = useState(project.description ?? "");
  const [startDate, setStartDate] = useState(project.startDate?.slice(0, 10) ?? "");
  const [targetDate, setTargetDate] = useState(project.targetDate?.slice(0, 10) ?? "");
  const [status, setStatus] = useState(project.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);

  async function save(patch: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setSaving(false);
    if (!res.ok) {
      setError(t("error"));
      return false;
    }
    return true;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const ok = await save({
      name,
      locationText: locationText || null,
      description: description || null,
      startDate: startDate || null,
      targetDate: targetDate || null,
    });
    if (ok) {
      onSaved({ name, locationText: locationText || null, description: description || null });
    }
  }

  async function handleArchiveToggle() {
    const nextStatus = status === "ARCHIVED" ? "ACTIVE" : "ARCHIVED";
    const ok = await save({ status: nextStatus });
    if (ok) {
      setStatus(nextStatus);
      setArchiveDialogOpen(false);
      onSaved({ status: nextStatus });
    }
  }

  return (
    <div className="flex max-w-xl flex-col gap-8">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="settings-name">{t("name")}</Label>
          <Input id="settings-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="settings-status">{t("status")}</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger id="settings-status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="ON_HOLD">On hold</SelectItem>
              <SelectItem value="ARCHIVED">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="settings-location">{t("location")}</Label>
          <Input id="settings-location" value={locationText} onChange={(e) => setLocationText(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="settings-start">{t("startDate")}</Label>
            <Input id="settings-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="settings-target">{t("targetDate")}</Label>
            <Input id="settings-target" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="settings-description">{t("description")}</Label>
          <Textarea id="settings-description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" disabled={saving} className="self-start">
          {t("save")}
        </Button>
      </form>

      <div className="rounded-xl border border-border p-4">
        <h3 className="font-serif text-base text-foreground">{t("archiveTitle")}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t("archiveDescription")}</p>
        <Button
          type="button"
          variant={status === "ARCHIVED" ? "secondary" : "outline"}
          className="mt-3"
          onClick={() => (status === "ARCHIVED" ? handleArchiveToggle() : setArchiveDialogOpen(true))}
        >
          {status === "ARCHIVED" ? t("unarchive") : t("archive")}
        </Button>
      </div>

      <Dialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("archiveConfirmTitle")}</DialogTitle>
            <DialogDescription>{t("archiveConfirmDescription")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setArchiveDialogOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button type="button" variant="destructive" onClick={handleArchiveToggle}>
              {t("archive")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
