import { cache } from "react";
import { getSettings, upsertSettings } from "@/lib/db/repositories/settings.repository";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n/types";

export interface AppSettingsView {
  demoMode: boolean;
  externalAiEnabled: boolean;
  locale: string;
  updatedAt: Date;
}

// A never-before-accessed database has no demo data in it — defaulting to
// demoMode:false here means a fresh, migrate-only real-user database (no
// `db:seed` ever run) reads as real mode from the very first page load,
// with no manual toggle required. `prisma/seed.ts` explicitly sets this to
// `true` after it seeds the "Alex" persona — see "Real-user mode" in
// docs/DATA_MODEL.md. Demo mode and real mode are separate data states, not
// a UI filter: this flag reflects which one actually happened, it doesn't
// decide it.
const DEFAULTS = { demoMode: false, externalAiEnabled: true, locale: DEFAULT_LOCALE as string };

/**
 * Always returns a row — creates the singleton with defaults on first read.
 * Wrapped in React's per-request `cache()`: this same settings row was
 * independently re-fetched up to ~8 times on a single Home page render
 * (once per BodySystemCard, plus the root layout, plus the demo banner) —
 * see docs/DATA_MODEL.md, "Performance." `cache()` de-dupes identical calls
 * within one render pass only; it never spans requests, so a setting change
 * (via a Server Action, always a separate request) is never served stale.
 */
export const getAppSettings = cache(async (): Promise<AppSettingsView> => {
  const existing = await getSettings();
  if (existing) return existing;
  return upsertSettings(DEFAULTS);
});

export async function setDemoMode(demoMode: boolean): Promise<AppSettingsView> {
  return upsertSettings({ demoMode });
}

export async function setExternalAiEnabled(externalAiEnabled: boolean): Promise<AppSettingsView> {
  return upsertSettings({ externalAiEnabled });
}

/** The user's explicit choice always wins — see lib/i18n/server.ts for the fallback-to-DEFAULT_LOCALE behavior. */
export async function setLocale(locale: Locale): Promise<AppSettingsView> {
  return upsertSettings({ locale });
}

/** Validated, defaulting read — never returns a string outside lib/i18n/types.ts's LOCALES. */
export async function getLocale(): Promise<Locale> {
  const settings = await getAppSettings();
  return isLocale(settings.locale) ? settings.locale : DEFAULT_LOCALE;
}
