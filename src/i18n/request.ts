import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { defaultLocale, isAppLocale } from "./config";

/**
 * Locale resolution for next-intl (server side).
 * Priority: `NEXT_LOCALE` cookie (set on login / profile change) → default `sk`.
 * The cookie is kept in sync with `User.locale` by the auth/profile routes so that a
 * signed-in user's stored preference always wins after their next request.
 */
export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;
  const locale = isAppLocale(cookieLocale) ? cookieLocale : defaultLocale;

  const messages = (await import(`../../messages/${locale}.json`)).default;

  return {
    locale,
    messages,
    timeZone: "Europe/Bratislava",
  };
});
