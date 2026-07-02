"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CoverImagePicker } from "@/components/shared";
import { cn } from "@/lib/utils";
import type { TemplateDetailDto, TemplateListItemDto } from "@/features/projects/types";

interface ClientDraft {
  name: string;
  email: string;
}

const STEPS = [1, 2, 3] as const;

/**
 * Project creation wizard (spec/04-features.md §3): name, client contact(s), location,
 * cover image, template selection, prune step, confirm. Applies the template
 * server-side via `POST /api/projects` with `templateId` + `prunedTaskTemplateIds`.
 */
export function ProjectWizard({ templates }: { templates: TemplateListItemDto[] }) {
  const t = useTranslations("projects.wizard");
  const locale = useLocale();
  const router = useRouter();

  const [step, setStep] = useState<(typeof STEPS)[number]>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 fields
  const [name, setName] = useState("");
  const [locationText, setLocationText] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [clients, setClients] = useState<ClientDraft[]>([]);
  const [templateId, setTemplateId] = useState<string>("__blank__");

  // Step 2: pruning
  const [templateDetail, setTemplateDetail] = useState<TemplateDetailDto | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [prunedTaskIds, setPrunedTaskIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (templateId === "__blank__") {
      return;
    }
    let cancelled = false;
    // `setLoadingTemplate(true)` is deferred behind a microtask (rather than called
    // synchronously in the effect body) to satisfy react-hooks/set-state-in-effect —
    // mirrors the deferred-setState pattern already used by ProgressRing's mount effect.
    void Promise.resolve()
      .then(() => {
        if (cancelled) return;
        setLoadingTemplate(true);
        return fetch(`/api/projects/templates?id=${templateId}`).then((res) => res.json());
      })
      .then((data: { template: TemplateDetailDto } | undefined) => {
        if (cancelled || !data) return;
        setTemplateDetail(data.template);
        setPrunedTaskIds(new Set());
      })
      .finally(() => {
        if (!cancelled) setLoadingTemplate(false);
      });
    return () => {
      cancelled = true;
    };
  }, [templateId]);

  /** Event handler (not an effect) — clears template state immediately on user selection. */
  function handleTemplateChange(nextId: string) {
    setTemplateId(nextId);
    if (nextId === "__blank__") {
      setTemplateDetail(null);
      setPrunedTaskIds(new Set());
    }
  }

  const totalTaskCount = useMemo(
    () => templateDetail?.phases.reduce((sum, p) => sum + p.tasks.length, 0) ?? 0,
    [templateDetail],
  );
  const keptTaskCount = totalTaskCount - prunedTaskIds.size;

  function addClient() {
    setClients((prev) => [...prev, { name: "", email: "" }]);
  }
  function updateClient(index: number, field: keyof ClientDraft, value: string) {
    setClients((prev) => prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
  }
  function removeClient(index: number) {
    setClients((prev) => prev.filter((_, i) => i !== index));
  }

  function toggleTask(taskId: string) {
    setPrunedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }
  function selectAll() {
    setPrunedTaskIds(new Set());
  }
  function deselectAll() {
    if (!templateDetail) return;
    setPrunedTaskIds(new Set(templateDetail.phases.flatMap((p) => p.tasks.map((t) => t.id))));
  }

  const canProceedStep1 = name.trim().length > 0;
  const hasTemplate = templateId !== "__blank__";

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          locationText: locationText || undefined,
          description: description || undefined,
          startDate: startDate || undefined,
          targetDate: targetDate || undefined,
          clients: clients
            .filter((c) => c.name.trim() && c.email.trim())
            .map((c) => ({ name: c.name.trim(), email: c.email.trim(), locale })),
          templateId: hasTemplate ? templateId : undefined,
          prunedTaskTemplateIds: Array.from(prunedTaskIds),
        }),
      });

      if (!res.ok) {
        setError(t("error"));
        setSubmitting(false);
        return;
      }

      const data = (await res.json()) as { project: { id: string } };
      router.push(`/projects/${data.project.id}`);
    } catch {
      setError(t("error"));
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="font-serif text-3xl text-foreground">{t("title")}</h1>

      <ol className="mt-6 flex items-center gap-2" aria-label={t("title")}>
        {STEPS.map((s) => (
          <li key={s} className="flex items-center gap-2">
            <span
              className={cn(
                "flex size-7 items-center justify-center rounded-full border text-xs font-medium",
                step === s
                  ? "border-primary bg-primary text-primary-foreground"
                  : step > s
                    ? "border-primary/40 bg-[var(--accent-soft)] text-primary"
                    : "border-border text-muted-foreground",
              )}
            >
              {s}
            </span>
            {s !== 3 && <span className="h-px w-8 bg-border" />}
          </li>
        ))}
      </ol>

      {step === 1 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>{t("step1.title")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5 pb-6">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="wizard-name">{t("step1.name")}</Label>
              <Input
                id="wizard-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("step1.namePlaceholder")}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="wizard-location">{t("step1.location")}</Label>
              <Input
                id="wizard-location"
                value={locationText}
                onChange={(e) => setLocationText(e.target.value)}
                placeholder={t("step1.locationPlaceholder")}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="wizard-start">{t("step1.startDate")}</Label>
                <Input
                  id="wizard-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="wizard-target">{t("step1.targetDate")}</Label>
                <Input
                  id="wizard-target"
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="wizard-description">{t("step1.description")}</Label>
              <Textarea
                id="wizard-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t("step1.cover")}</Label>
              {/* Cover upload wiring (File/FileVersion creation) is WP-5's upload
                  pipeline; this picker previews locally and can be wired to
                  `coverImageId` once that endpoint exists — not blocking wizard AC. */}
              <CoverImagePicker />
            </div>

            <div className="flex flex-col gap-2">
              <Label>{t("step1.template")}</Label>
              <Select value={templateId} onValueChange={handleTemplateChange}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__blank__">{t("step1.templateBlank")}</SelectItem>
                  {templates.map((tpl) => (
                    <SelectItem key={tpl.id} value={tpl.id}>
                      {tpl.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2 border-t border-border pt-4">
              <div>
                <Label>{t("step1.clientsTitle")}</Label>
                <p className="text-sm text-muted-foreground">{t("step1.clientsHint")}</p>
              </div>
              {clients.map((client, index) => (
                <div key={index} className="flex items-end gap-2">
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Label htmlFor={`client-name-${index}`}>{t("step1.clientName")}</Label>
                    <Input
                      id={`client-name-${index}`}
                      value={client.name}
                      onChange={(e) => updateClient(index, "name", e.target.value)}
                    />
                  </div>
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Label htmlFor={`client-email-${index}`}>{t("step1.clientEmail")}</Label>
                    <Input
                      id={`client-email-${index}`}
                      type="email"
                      value={client.email}
                      onChange={(e) => updateClient(index, "email", e.target.value)}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeClient(index)}
                    aria-label={t("step1.removeClient")}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addClient} className="self-start">
                <Plus className="size-4" />
                {t("step1.addClient")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>{t("step2.title")}</CardTitle>
            <CardDescription>{t("step2.description")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 pb-6">
            {!hasTemplate || !templateDetail ? (
              <p className="text-sm text-muted-foreground">
                {loadingTemplate ? "…" : t("step1.templateBlank")}
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {t("step2.taskCount", { count: keptTaskCount })}
                  </span>
                  <div className="flex gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={selectAll}>
                      {t("step2.selectAll")}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={deselectAll}>
                      {t("step2.deselectAll")}
                    </Button>
                  </div>
                </div>
                <div className="flex flex-col gap-4">
                  {templateDetail.phases.map((phase) => (
                    <div key={phase.id} className="rounded-lg border border-border p-3">
                      <p className="mb-2 font-serif text-sm text-foreground">
                        {locale === "sk" ? phase.nameSk : phase.nameEn}
                      </p>
                      <ul className="flex flex-col gap-1.5">
                        {phase.tasks.map((task) => (
                          <li key={task.id} className="flex items-center gap-2">
                            <Checkbox
                              id={`task-${task.id}`}
                              checked={!prunedTaskIds.has(task.id)}
                              onCheckedChange={() => toggleTask(task.id)}
                            />
                            <Label htmlFor={`task-${task.id}`} className="font-normal">
                              {locale === "sk" ? task.titleSk : task.titleEn}
                            </Label>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>{t("step3.title")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 pb-6 text-sm">
            <SummaryRow label={t("step3.name")} value={name} />
            <SummaryRow label={t("step3.location")} value={locationText || "—"} />
            <SummaryRow
              label={t("step3.template")}
              value={hasTemplate ? (templates.find((tpl) => tpl.id === templateId)?.name ?? "—") : t("step3.noTemplate")}
            />
            {hasTemplate && templateDetail && (
              <>
                <SummaryRow label={t("step3.phases")} value={String(templateDetail.phases.length)} />
                <SummaryRow label={t("step3.tasks")} value={String(keptTaskCount)} />
              </>
            )}
            <SummaryRow
              label={t("step3.clients")}
              value={
                clients.filter((c) => c.name.trim() && c.email.trim()).length > 0
                  ? clients
                      .filter((c) => c.name.trim() && c.email.trim())
                      .map((c) => c.name)
                      .join(", ")
                  : t("step3.noClients")
              }
            />
          </CardContent>
        </Card>
      )}

      {error && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="mt-6 flex justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={() => setStep((s) => (s > 1 ? ((s - 1) as typeof step) : s))}
          disabled={step === 1}
        >
          {t("back")}
        </Button>
        {step < 3 ? (
          <Button
            type="button"
            onClick={() => setStep((s) => (s < 3 ? ((s + 1) as typeof step) : s))}
            disabled={step === 1 && !canProceedStep1}
          >
            {t("next")}
          </Button>
        ) : (
          <Button type="button" onClick={handleSubmit} disabled={submitting}>
            {submitting ? t("creating") : t("create")}
          </Button>
        )}
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-border py-1.5 last:border-none">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
