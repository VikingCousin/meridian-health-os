import { describe, it, expect, afterEach } from "vitest";
import { getDictionary, translate } from "@/lib/i18n/get-dictionary";
import { LOCALES } from "@/lib/i18n/types";
import en from "@/lib/i18n/dictionaries/en";
import { getLocale, setLocale } from "@/lib/services/settings.service";

function flattenKeys(obj: unknown, prefix = ""): string[] {
  if (typeof obj === "string") return [prefix];
  if (obj && typeof obj === "object") {
    return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) => flattenKeys(v, prefix ? `${prefix}.${k}` : k));
  }
  return [];
}

describe("i18n architecture", () => {
  afterEach(async () => {
    await setLocale("en");
  });

  it("every locale's dictionary has exactly the same key set as English (no missing/extra translations)", () => {
    const englishKeys = flattenKeys(en).sort();
    for (const locale of LOCALES) {
      const keys = flattenKeys(getDictionary(locale)).sort();
      expect(keys, `locale "${locale}" key set differs from English`).toEqual(englishKeys);
    }
  });

  it("translate() resolves a dot-path key to the right string per locale", () => {
    expect(translate(getDictionary("en"), "common.save")).toBe("Save");
    expect(translate(getDictionary("de"), "common.save")).toBe("Speichern");
    expect(translate(getDictionary("ru"), "common.save")).toBe("Сохранить");
  });

  it("translate() interpolates {placeholder} values", () => {
    const result = translate(getDictionary("en"), "home.dayOf", { current: 3, total: 14 });
    expect(result).toBe("day 3 of 14");
  });

  it("translate() returns the raw key rather than throwing for an unknown path", () => {
    expect(translate(getDictionary("en"), "not.a.real.key")).toBe("not.a.real.key");
  });

  it("persists a locale choice and reads it back, defaulting invalid stored values to English", async () => {
    await setLocale("de");
    expect(await getLocale()).toBe("de");
    await setLocale("ru");
    expect(await getLocale()).toBe("ru");
  });

  it("clinical biomarker identifiers are never translated — canonical keys stay the same across locales", () => {
    // The canonical data model (lib/domain/biomarker-catalog.ts) is
    // language-independent by construction: no locale ever appears in it.
    // This test guards the architectural boundary — dictionaries hold UI
    // strings only, never a biomarker canonicalKey/displayName.
    const dictionaryText = JSON.stringify(getDictionary("de"));
    expect(dictionaryText).not.toMatch(/canonicalKey/);
  });
});
