"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { setLocaleAction } from "@/lib/actions/locale";
import { LOCALES, LOCALE_NAMES, type Locale } from "@/lib/i18n/types";
import { useTranslations } from "@/lib/i18n/locale-provider";

export function LanguageSelector({ initialLocale }: { initialLocale: Locale }) {
  const { t } = useTranslations();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="rounded-2xl border border-border-soft bg-surface p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-muted text-muted-foreground">
          <Languages className="h-4 w-4" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{t("profile.language")}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("profile.languageDescription")}</p>
        </div>
        <select
          defaultValue={initialLocale}
          disabled={isPending}
          onChange={(e) => {
            const next = e.target.value;
            startTransition(async () => {
              await setLocaleAction(next);
              router.refresh();
            });
          }}
          className="shrink-0 rounded-lg border border-border-soft bg-surface-muted/40 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
        >
          {LOCALES.map((code) => (
            <option key={code} value={code}>
              {LOCALE_NAMES[code]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
