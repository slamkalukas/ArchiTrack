"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { locales, type AppLocale } from "@/i18n/config";

/** Isolated outside the component so the React Compiler doesn't treat the DOM write as a render-path mutation. */
function setLocaleCookie(next: AppLocale) {
  document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

/**
 * Language switcher: sets the `NEXT_LOCALE` cookie (read by src/i18n/request.ts on the
 * next request) and, when signed in, patches the session + persists to the user's
 * profile so the choice survives across devices (spec/06-ui-ux.md §4.8).
 */
export function LocaleSwitcher({ className }: { className?: string }) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("common.localeSwitcher");
  const router = useRouter();
  const { data: session, update } = useSession();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  async function handleSelect(next: AppLocale) {
    setOpen(false);
    if (next === locale) return;

    setLocaleCookie(next);

    if (session?.user) {
      try {
        await fetch("/api/me/locale", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locale: next }),
        });
      } catch {
        // Cookie already switched the UI; profile persistence is best-effort here and
        // owned end-to-end by the settings feature work package.
      }
      await update({ locale: next });
    }

    startTransition(() => router.refresh());
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          aria-label={t("label")}
          className={className}
        >
          <Languages className="size-4" />
          <span className="uppercase">{locale}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {locales.map((l) => (
          <DropdownMenuItem key={l} onSelect={() => handleSelect(l)} data-active={l === locale}>
            <span
              className={l === locale ? "font-medium text-foreground" : "text-muted-foreground"}
            >
              {t(l)}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
