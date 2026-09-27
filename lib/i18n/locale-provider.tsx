"use client";

import { createContext, useContext, useMemo } from "react";
import { getDictionary, translate } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/types";

interface LocaleContextValue {
  locale: Locale;
  t: (key: string, values?: Record<string, string | number>) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

/**
 * Wraps the app once, near the root layout, with the locale already
 * resolved server-side (see lib/i18n/server.ts) — no flash of the wrong
 * language, no client-side fetch just to find out what language to render.
 */
export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const value = useMemo<LocaleContextValue>(() => {
    const dictionary = getDictionary(locale);
    return { locale, t: (key, values) => translate(dictionary, key, values) };
  }, [locale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

/** For Client Components — `const {t, locale} = useTranslations();`. */
export function useTranslations() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useTranslations() must be used within a LocaleProvider");
  return ctx;
}
