"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ShieldCheck, Sparkles } from "lucide-react";
import { setDemoModeAction, setExternalAiEnabledAction } from "@/lib/actions/data-management";
import { useTranslations } from "@/lib/i18n/locale-provider";

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${checked ? "bg-accent" : "bg-surface-muted"}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`}
      />
    </button>
  );
}

export function PrivacyAiPanel({ initialExternalAiEnabled, initialDemoMode }: { initialExternalAiEnabled: boolean; initialDemoMode: boolean }) {
  const [externalAiEnabled, setExternalAiEnabledState] = useState(initialExternalAiEnabled);
  const [demoMode, setDemoModeState] = useState(initialDemoMode);
  const [isPending, startTransition] = useTransition();
  const { t } = useTranslations();

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold tracking-tight text-foreground">{t("profile.privacyAndAi")}</h2>

      <div className="rounded-2xl border border-border-soft bg-surface p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-muted text-muted-foreground">
            <Sparkles className="h-4 w-4" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{t("profile.externalAi")}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              When off, lab extraction, journal structuring, and Coach phrasing all use their deterministic local fallback instead —
              nothing about your health leaves this machine. Analytics, insights, priority scoring, and knowledge search are always
              local, regardless of this setting.
            </p>
          </div>
          <Toggle
            checked={externalAiEnabled}
            disabled={isPending}
            onChange={(next) => {
              setExternalAiEnabledState(next);
              startTransition(async () => {
                await setExternalAiEnabledAction(next);
              });
            }}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-border-soft bg-surface p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-muted text-muted-foreground">
            <ShieldCheck className="h-4 w-4" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{t("profile.demoModeIndicator")}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Shows a banner across the app while this profile is running on synthetic demo data. Turn off once you&apos;ve replaced it
              with your own real data — this only changes the indicator, it never deletes anything.
            </p>
          </div>
          <Toggle
            checked={demoMode}
            disabled={isPending}
            onChange={(next) => {
              setDemoModeState(next);
              startTransition(async () => {
                await setDemoModeAction(next);
              });
            }}
          />
        </div>
      </div>

      <Link href="/privacy" className="text-xs font-medium text-accent hover:underline">
        {t("profile.viewPrivacyDashboard")}
      </Link>
    </section>
  );
}
