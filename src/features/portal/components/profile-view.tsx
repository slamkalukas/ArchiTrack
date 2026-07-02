"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { toast } from "sonner";
import { Download, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { AppLocale } from "@/i18n/config";

interface ProfileViewProps {
  user: {
    name: string;
    email: string;
    locale: AppLocale;
    phone: string | null;
    emailDigest: boolean;
  };
}

function setLocaleCookie(next: AppLocale) {
  document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

/**
 * Client "Profil" tab (spec/04-features.md §8 profile page + §12 GDPR): name, password
 * change, language, e-mail digest preference, data export, account deletion request.
 */
export function ProfileView({ user }: ProfileViewProps) {
  const t = useTranslations("portal.profile");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { update: updateSession } = useSession();

  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [locale, setLocale] = useState<AppLocale>(user.locale);
  const [emailDigest, setEmailDigest] = useState(user.emailDigest);
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const [exporting, setExporting] = useState(false);
  const [requestingDeletion, setRequestingDeletion] = useState(false);
  const [deletionSent, setDeletionSent] = useState(false);

  async function handleProfileSubmit(e: FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone: phone || null, locale, emailDigest }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? tCommon("error.generic"));
        return;
      }
      setLocaleCookie(locale);
      await updateSession({ locale });
      toast.success(t("saved"));
      router.refresh();
    } catch {
      toast.error(tCommon("error.generic"));
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setSavingPassword(true);
    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? t("passwordError"));
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      toast.success(t("passwordSaved"));
    } catch {
      toast.error(tCommon("error.generic"));
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch("/api/me/export");
      if (!res.ok) {
        toast.error(tCommon("error.generic"));
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "architrack-data.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(tCommon("error.generic"));
    } finally {
      setExporting(false);
    }
  }

  async function handleDeletionRequest() {
    setRequestingDeletion(true);
    try {
      const res = await fetch("/api/me/deletion-request", { method: "POST" });
      if (!res.ok) {
        toast.error(tCommon("error.generic"));
        return;
      }
      setDeletionSent(true);
      toast.success(t("gdpr.deletionSent"));
    } catch {
      toast.error(tCommon("error.generic"));
    } finally {
      setRequestingDeletion(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-serif text-2xl text-foreground">{t("title")}</h1>

      <Card>
        <CardHeader>
          <CardTitle>{t("sections.profile")}</CardTitle>
          <CardDescription>{user.email}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleProfileSubmit} className="flex flex-col gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="profile-name">{t("fields.name")}</Label>
              <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="profile-phone">{t("fields.phone")}</Label>
              <Input id="profile-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="profile-locale">{t("fields.language")}</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={locale === "sk" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setLocale("sk")}
                >
                  {tCommon("localeSwitcher.sk")}
                </Button>
                <Button
                  type="button"
                  variant={locale === "en" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setLocale("en")}
                >
                  {tCommon("localeSwitcher.en")}
                </Button>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <Checkbox
                id="profile-digest"
                checked={emailDigest}
                onCheckedChange={(checked) => setEmailDigest(checked === true)}
              />
              <Label htmlFor="profile-digest" className="flex-col items-start gap-0.5 font-normal">
                <span className="font-medium">{t("fields.emailDigest")}</span>
                <span className="text-xs font-normal text-muted-foreground">{t("fields.emailDigestHint")}</span>
              </Label>
            </div>
            <div>
              <Button type="submit" disabled={savingProfile}>
                {savingProfile && <Loader2 className="size-4 animate-spin" />}
                {tCommon("save")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("sections.password")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="current-password">{t("fields.currentPassword")}</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="new-password">{t("fields.newPassword")}</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
              />
            </div>
            <div>
              <Button type="submit" disabled={savingPassword || !currentPassword || !newPassword}>
                {savingPassword && <Loader2 className="size-4 animate-spin" />}
                {t("fields.changePassword")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("sections.gdpr")}</CardTitle>
          <CardDescription>{t("gdpr.description")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4">
            <div>
              <p className="text-sm font-medium text-foreground">{t("gdpr.exportTitle")}</p>
              <p className="text-xs text-muted-foreground">{t("gdpr.exportDescription")}</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
              {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              {t("gdpr.exportAction")}
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 p-4">
            <div>
              <p className="text-sm font-medium text-foreground">{t("gdpr.deletionTitle")}</p>
              <p className="text-xs text-muted-foreground">{t("gdpr.deletionDescription")}</p>
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button type="button" variant="destructive" size="sm" disabled={deletionSent}>
                  <ShieldAlert className="size-4" />
                  {deletionSent ? t("gdpr.deletionSentAction") : t("gdpr.deletionAction")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("gdpr.confirmTitle")}</DialogTitle>
                  <DialogDescription>{t("gdpr.confirmDescription")}</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button type="button" variant="destructive" onClick={handleDeletionRequest} disabled={requestingDeletion}>
                    {requestingDeletion && <Loader2 className="size-4 animate-spin" />}
                    {t("gdpr.confirmAction")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      <div>
        <Button type="button" variant="ghost" onClick={() => signOut({ callbackUrl: "/login" })}>
          {t("logout")}
        </Button>
      </div>
    </div>
  );
}
