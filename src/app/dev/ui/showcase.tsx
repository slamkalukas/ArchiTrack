"use client";

import { useMemo, useState } from "react";
import { NextIntlClientProvider } from "next-intl";
import { toast } from "sonner";
import skMessages from "../../../../messages/sk.json";
import enMessages from "../../../../messages/en.json";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import {
  ProgressRing,
  PhaseAccordion,
  TaskCard,
  KanbanColumn,
  FileTable,
  FolderTree,
  PreviewDrawer,
  ChatThread,
  MessageComposer,
  MilestoneTimeline,
  VisibilityToggle,
  EmptyState,
  NotificationBell,
  ProjectCard,
  CoverImagePicker,
  LocaleSwitcher,
} from "@/components/shared";
import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { ClientTopbar } from "@/components/layout/client-topbar";

import {
  mockChatMessages,
  mockFiles,
  mockFolders,
  mockMilestones,
  mockNotifications,
  mockPhases,
  mockProjects,
  mockTasks,
} from "./mock-data";

const MESSAGES = { sk: skMessages, en: enMessages } as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 border-t border-border pt-8 first:border-none first:pt-0">
      <h2 className="font-serif text-xl text-foreground">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-start gap-4">{children}</div>;
}

/**
 * The actual showcase content — rendered once per locale by `LocalePane` below so every
 * component in spec/06-ui-ux.md §6 is demonstrated in both SK and EN on one page.
 */
function ShowcaseContent() {
  const [selectedFolder, setSelectedFolder] = useState("study-drawings");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [visibility, setVisibility] = useState<"INTERNAL" | "CLIENT_VISIBLE">("INTERNAL");

  return (
    <div className="space-y-12">
      <Section title="Buttons">
        <Row>
          <Button>Default</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="link">Link</Button>
          <Button disabled>Disabled</Button>
        </Row>
      </Section>

      <Section title="Form controls">
        <Row>
          <div className="flex w-64 flex-col gap-1.5">
            <Label htmlFor="showcase-input">Email</Label>
            <Input id="showcase-input" placeholder="architekt@architrack.sk" />
          </div>
          <div className="flex w-48 flex-col gap-1.5">
            <Label>Fáza</Label>
            <Select defaultValue="permit">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="study">Štúdia</SelectItem>
                <SelectItem value="permit">Povoľovací proces</SelectItem>
                <SelectItem value="construction">Realizácia</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 pt-6">
            <Checkbox id="showcase-checkbox" defaultChecked />
            <Label htmlFor="showcase-checkbox">Zverejniť pre klienta</Label>
          </div>
        </Row>
      </Section>

      <Section title="Badges & Progress">
        <Row>
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="todo">To-do</Badge>
          <Badge variant="in-progress">In progress</Badge>
          <Badge variant="done">Done</Badge>
          <Badge variant="destructive">Overdue</Badge>
        </Row>
        <div className="max-w-sm space-y-2">
          <Progress value={42} />
        </div>
      </Section>

      <Section title="Skeletons & Tooltip">
        <Row>
          <div className="w-64 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-24 w-full" />
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline">Hover me</Button>
            </TooltipTrigger>
            <TooltipContent>A helpful tooltip</TooltipContent>
          </Tooltip>
        </Row>
      </Section>

      <Section title="Dialog">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">Open dialog</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Zverejniť priečinok</DialogTitle>
              <DialogDescription>
                Klient uvidí 4 nové súbory. Túto akciu je možné kedykoľvek vrátiť späť.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline">Zrušiť</Button>
              <Button>Zverejniť</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Section>

      <Section title="Toast">
        <Button
          variant="outline"
          onClick={() =>
            toast("Nepodarilo sa uložiť — skúste znova.", {
              action: { label: "Späť", onClick: () => {} },
            })
          }
        >
          Trigger rollback toast
        </Button>
      </Section>

      <Section title="ProgressRing">
        <Row>
          <ProgressRing value={42} sublabel="Povoľovací proces" />
          <ProgressRing value={100} size={96} strokeWidth={6} />
        </Row>
      </Section>

      <Section title="LocaleSwitcher / NotificationBell">
        <Row>
          <LocaleSwitcher />
          <NotificationBell items={mockNotifications} />
          <NotificationBell items={[]} />
        </Row>
      </Section>

      <Section title="VisibilityToggle">
        <Row>
          <VisibilityToggle visibility={visibility} onToggle={setVisibility} showLabel />
          <VisibilityToggle visibility="CLIENT_VISIBLE" showLabel />
          <VisibilityToggle visibility="INTERNAL" showLabel />
        </Row>
      </Section>

      <Section title="ProjectCard">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {mockProjects.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      </Section>

      <Section title="CoverImagePicker">
        <div className="max-w-sm">
          <CoverImagePicker />
        </div>
      </Section>

      <Section title="MilestoneTimeline">
        <MilestoneTimeline milestones={mockMilestones} />
      </Section>

      <Section title="PhaseAccordion">
        <div className="space-y-3">
          {mockPhases.map((phase) => (
            <PhaseAccordion key={phase.id} phase={phase} defaultOpen={phase.status === "ACTIVE"}>
              <div className="flex flex-col gap-2">
                {(phase.tasks ?? []).length === 0 ? (
                  <EmptyState title="Žiadne úlohy v tejto fáze" className="border-none py-6" />
                ) : (
                  phase.tasks!.map((task) => <TaskCard key={task.id} task={task} />)
                )}
              </div>
            </PhaseAccordion>
          ))}
        </div>
      </Section>

      <Section title="TaskCard">
        <Row>
          {mockTasks.slice(0, 3).map((task) => (
            <div key={task.id} className="w-64">
              <TaskCard task={task} />
            </div>
          ))}
        </Row>
      </Section>

      <Section title="KanbanColumn">
        <div className="flex gap-4 overflow-x-auto">
          <KanbanColumn status="TODO" tasks={mockTasks.filter((t) => t.status === "TODO")} />
          <KanbanColumn
            status="IN_PROGRESS"
            tasks={mockTasks.filter((t) => t.status === "IN_PROGRESS")}
          />
          <KanbanColumn status="DONE" tasks={mockTasks.filter((t) => t.status === "DONE")} />
        </div>
      </Section>

      <Section title="FolderTree + FileTable">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[220px_1fr]">
          <FolderTree
            nodes={mockFolders}
            selectedId={selectedFolder}
            onSelect={setSelectedFolder}
          />
          <FileTable files={mockFiles} onSelect={() => setDrawerOpen(true)} />
        </div>
      </Section>

      <Section title="PreviewDrawer">
        <Button variant="outline" onClick={() => setDrawerOpen(true)}>
          Open preview drawer
        </Button>
        <PreviewDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title="Situácia_1-500.pdf"
        >
          <div className="flex h-64 items-center justify-center rounded-lg bg-secondary text-sm text-muted-foreground">
            PDF preview placeholder
          </div>
        </PreviewDrawer>
      </Section>

      <Section title="ChatThread + MessageComposer">
        <Card className="max-w-lg overflow-hidden py-0">
          <div className="max-h-72 overflow-y-auto p-4">
            <ChatThread messages={mockChatMessages} seenLabel="Videné 18:52" />
          </div>
          <MessageComposer onSend={() => {}} />
        </Card>
      </Section>

      <Section title="EmptyState">
        <EmptyState
          title="Zatiaľ žiadne súbory"
          description="Nahrajte prvý súbor presunutím sem alebo pomocou tlačidla nahrať."
        />
      </Section>

      <Section title="App shells (scaled preview)">
        <div className="space-y-6">
          <div>
            <p className="mb-2 text-sm text-muted-foreground">Admin sidebar</p>
            <div className="h-[420px] w-64 overflow-hidden rounded-xl border border-border">
              <AdminSidebar userName="Ing. arch. Nováková" userEmail="admin@architrack.local" />
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm text-muted-foreground">Client top bar</p>
            <div className="overflow-hidden rounded-xl border border-border">
              <ClientTopbar userName="Peter Novák" />
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}

function LocalePane({ locale }: { locale: "sk" | "en" }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="uppercase">
          {locale}
        </Badge>
        <p className="text-sm text-muted-foreground">
          {locale === "sk" ? "Slovenská lokalizácia" : "English localization"}
        </p>
      </div>
      <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]}>
        <ShowcaseContent />
      </NextIntlClientProvider>
    </div>
  );
}

/** /dev/ui — component showcase, wave-2 acceptance milestone (spec/07-agent-workplan.md §4.2). */
export function DevUiShowcase() {
  const [tab, setTab] = useState<"sk" | "en" | "split">("split");

  const tabs = useMemo(
    () => [
      { id: "split" as const, label: "SK + EN" },
      { id: "sk" as const, label: "SK only" },
      { id: "en" as const, label: "EN only" },
    ],
    [],
  );

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8 space-y-2">
        <h1 className="font-serif text-3xl text-foreground">ArchiTrack — /dev/ui</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Component showcase for the design system built in WP-2 (spec/06-ui-ux.md §6). Dev-only
          route — not shipped in production builds.
        </p>
        <div className="flex gap-1 pt-2">
          {tabs.map((t) => (
            <Button
              key={t.id}
              size="sm"
              variant={tab === t.id ? "default" : "outline"}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </Button>
          ))}
        </div>
      </header>

      {tab === "split" ? (
        <div className="grid grid-cols-1 gap-10 xl:grid-cols-2">
          <LocalePane locale="sk" />
          <LocalePane locale="en" />
        </div>
      ) : (
        <LocalePane locale={tab} />
      )}
    </div>
  );
}
