"use client";

import { SessionProvider } from "next-auth/react";
import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages } from "next-intl";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

/**
 * Root client providers: Auth.js session context + next-intl client messages +
 * shared UI providers (tooltip, toast host) added by WP-2.
 */
export function Providers({
  children,
  locale,
  messages,
}: {
  children: React.ReactNode;
  locale: string;
  messages: AbstractIntlMessages;
}) {
  return (
    <SessionProvider>
      <NextIntlClientProvider locale={locale} messages={messages} timeZone="Europe/Bratislava">
        <TooltipProvider>
          {children}
          <Toaster />
        </TooltipProvider>
      </NextIntlClientProvider>
    </SessionProvider>
  );
}
