import type { Locale } from "@/lib/i18n/types";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";
import en from "@/lib/i18n/dictionaries/en";
import de from "@/lib/i18n/dictionaries/de";
import ru from "@/lib/i18n/dictionaries/ru";

const DICTIONARIES: Record<Locale, Dictionary> = { en, de, ru };

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}

export type { Dictionary };

type Interpolations = Record<string, string | number>;

/**
 * Dot-path lookup with `{placeholder}` interpolation — deliberately not a
 * full ICU/pluralization engine (ru's few plural-dependent strings are
 * phrased as "Count: N" instead, see the ru dictionary) to keep this
 * dependency-free and centralized in one place, per the architecture
 * requirement in the Section P1 spec.
 */
export function translate(dictionary: Dictionary, key: string, values?: Interpolations): string {
  const parts = key.split(".");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current: any = dictionary;
  for (const part of parts) {
    current = current?.[part];
  }
  if (typeof current !== "string") return key;
  if (!values) return current;
  return current.replace(/\{(\w+)\}/g, (_match, token) => (token in values ? String(values[token]) : `{${token}}`));
}
