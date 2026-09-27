import { getLocale } from "@/lib/services/settings.service";
import { getDictionary, translate } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/types";

/** For async Server Components — `const {t, locale} = await getTranslations();`. */
export async function getTranslations() {
  const locale = await getLocale();
  const dictionary = getDictionary(locale);
  return {
    locale,
    t: (key: string, values?: Record<string, string | number>) => translate(dictionary, key, values),
  };
}

export async function getServerLocale(): Promise<Locale> {
  return getLocale();
}
