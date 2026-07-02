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
  const [current, setCurrent] = useState(project);

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
