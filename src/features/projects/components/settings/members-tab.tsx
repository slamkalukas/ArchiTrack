"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus, RotateCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared";
import type { ProjectMemberDto } from "@/features/projects/types";

interface MembersSettingsTabProps {
  projectId: string;
  members: ProjectMemberDto[];
  onChanged: () => void;
}

/** Settings → Members: add/remove client users, resend invites (spec/04-features.md §3). */
export function MembersSettingsTab({ projectId, members, onChanged }: MembersSettingsTabProps) {
  const t = useTranslations("projects.settings.members");
  const tCommon = useTranslations("common");
  const locale = useLocale();

  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<ProjectMemberDto | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const clients = members.filter((m) => m.user.role === "CLIENT");

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setAddError(null);
    const res = await fetch(`/api/projects/${projectId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, locale }),
    });
    setAdding(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: { code?: string } } | null;
      setAddError(body?.error?.code === "email_conflict" ? t("emailConflict") : t("error"));
      return;
    }
    setName("");
    setEmail("");
    setAddOpen(false);
    toast.success(t("added"));
    onChanged();
  }

  async function handleRemove() {
    if (!removeTarget) return;
    const res = await fetch(`/api/projects/${projectId}/members/${removeTarget.userId}`, { method: "DELETE" });
    setRemoveTarget(null);
    if (res.ok) onChanged();
  }

  async function handleResend(userId: string) {
    setResendingId(userId);
    const res = await fetch(`/api/projects/${projectId}/invites/${userId}/resend`, { method: "POST" });
    setResendingId(null);
    if (res.ok) {
      toast.success(t("resendSent"));
      onChanged();
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-serif text-base text-foreground">{t("title")}</h3>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button type="button" size="sm">
              <Plus className="size-4" />
              {t("addMember")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("addTitle")}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAdd} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="member-name">{t("name")}</Label>
                <Input id="member-name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="member-email">{t("email")}</Label>
                <Input
                  id="member-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              {addError && (
                <p role="alert" className="text-sm text-destructive">
                  {addError}
                </p>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
                  {tCommon("cancel")}
                </Button>
                <Button type="submit" disabled={adding}>
                  {adding ? t("adding") : t("add")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {clients.length === 0 ? (
        <EmptyState title={t("noClients")} />
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
          {clients.map((member) => (
            <li key={member.userId} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{member.user.name}</p>
                <p className="truncate text-xs text-muted-foreground">{member.user.email}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant={member.invite ? "outline" : "secondary"}>
                  {member.invite ? t("statusPending") : t("statusActive")}
                </Badge>
                {member.invite && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t("resendInvite")}
                    disabled={resendingId === member.userId}
                    onClick={() => handleResend(member.userId)}
                  >
                    <RotateCw className="size-4" />
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("remove")}
                  onClick={() => setRemoveTarget(member)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!removeTarget} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("removeConfirmTitle")}</DialogTitle>
            <DialogDescription>
              {removeTarget && t("removeConfirmDescription", { name: removeTarget.user.name })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRemoveTarget(null)}>
              {tCommon("cancel")}
            </Button>
            <Button type="button" variant="destructive" onClick={handleRemove}>
              {t("remove")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
