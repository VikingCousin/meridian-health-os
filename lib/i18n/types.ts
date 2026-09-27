export const LOCALES = ["en", "de", "ru"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  de: "Deutsch",
  ru: "Русский",
};

/** Full language name in English — used only inside the Coach's system prompt, never shown in the UI. */
export const LOCALE_ENGLISH_NAME: Record<Locale, string> = {
  en: "English",
  de: "German",
  ru: "Russian",
};

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}
