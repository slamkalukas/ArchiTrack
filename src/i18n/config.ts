export const locales = ["sk", "en"] as const;
export type AppLocale = (typeof locales)[number];
export const defaultLocale: AppLocale = "sk";

export function isAppLocale(value: string | null | undefined): value is AppLocale {
  return !!value && (locales as readonly string[]).includes(value);
}
