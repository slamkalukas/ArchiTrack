"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GeneralSettingsTab } from "./settings/general-tab";
import { MembersSettingsTab } from "./settings/members-tab";
import { ContactsSettingsTab } from "./settings/contacts-tab";
import { WeightsSettingsTab } from "./settings/weights-tab";
import type { AdminProjectDetailDto } from "@/features/projects/types";

interface SettingsViewProps {
  project: AdminProjectDetailDto;
}

/** Project settings tab: general / members / contacts / phase weights (spec/04-features.md §3). */
export function SettingsView({ project }: SettingsViewProps) {
  const t = useTranslations("projects.settings");
  const router = useRouter();
  // `router.refresh()` re-renders this page's server component and hands this client
  // component a fresh `project` prop, but a plain `useState(project)` initializer only
  // runs once, on mount — it does not resync when the prop changes on a later render of
  // the *same* component instance. Without the "adjust state during render" pattern
  // below (react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes),
  // the Members/Contacts/Weights tabs (which rely solely on `refresh()`, unlike
  // General's own `setCurrent` merge on save) would silently keep showing stale data
  // after every mutation — verified live via tests/e2e/wp8-invite-flow.spec.ts.
  const [prevProject, setPrevProject] = useState(project);
  const [current, setCurrent] = useState(project);
  if (project !== prevProject) {
    setPrevProject(project);
    setCurrent(project);
  }

  function refresh() {
    router.refresh();
  }

  return (
    <div>
      <h2 className="mb-4 font-serif text-xl text-foreground">{t("title")}</h2>
      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">{t("tabs.general")}</TabsTrigger>
          <TabsTrigger value="members">{t("tabs.members")}</TabsTrigger>
          <TabsTrigger value="contacts">{t("tabs.contacts")}</TabsTrigger>
          <TabsTrigger value="weights">{t("tabs.weights")}</TabsTrigger>
        </TabsList>
        <TabsContent value="general">
          <GeneralSettingsTab
            project={current}
            onSaved={(updated) => {
              setCurrent((prev) => ({ ...prev, ...updated }));
              toast.success(t("general.saved"));
              refresh();
            }}
          />
        </TabsContent>
        <TabsContent value="members">
          <MembersSettingsTab
            projectId={current.id}
            members={current.members}
            onChanged={() => {
              refresh();
            }}
          />
        </TabsContent>
        <TabsContent value="contacts">
          <ContactsSettingsTab projectId={current.id} contacts={current.contacts} onChanged={refresh} />
        </TabsContent>
        <TabsContent value="weights">
          <WeightsSettingsTab
            projectId={current.id}
            phases={current.phases}
            onSaved={() => {
              toast.success(t("weights.saved"));
              refresh();
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
