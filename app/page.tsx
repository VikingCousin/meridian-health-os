import Link from "next/link";
import { PageContainer } from "@/components/layout/page-container";
import { BodySystemCard } from "@/components/body/body-system-card";
import { InsightCard } from "@/components/health/insight-card";
import { CurrentFocusPanel } from "@/components/coach/current-focus-panel";
import { FirstDataChecklist } from "@/components/health/first-data-checklist";
import { Button } from "@/components/ui/button";
import { bodySystems } from "@/lib/mock-data/body-systems";
import { getOrCreateProfile } from "@/lib/services/profile.service";
import { listExperiments } from "@/lib/services/experiment.service";
import { getBiomarkerDetail } from "@/lib/services/biomarker.service";
import { listHomeInsights } from "@/lib/services/insight.service";
import { getCurrentFocus } from "@/lib/services/coach-priority.service";
import { getRealUserDataStatus } from "@/lib/services/real-user-status.service";
import { getTranslations } from "@/lib/i18n/server";
import { ArrowRight, ChevronRight } from "lucide-react";

function formatHoursMinutes(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${m}m`;
}

function getGreetingKey() {
  const hour = new Date().getHours();
  if (hour < 12) return "home.greetingMorning";
  if (hour < 18) return "home.greetingAfternoon";
  return "home.greetingEvening";
}

// TODAY panel — Section 2 of the V1 hardening spec: real tracked values with
// a baseline delta, never an invented composite "readiness" score.
const TODAY_METRICS = [
  { key: "sleep_duration", labelKey: "home.sleep" },
  { key: "hrv", labelKey: "home.hrv" },
  { key: "resting_hr", labelKey: "home.restingHr" },
  { key: "stress_level", labelKey: "home.stress" },
] as const;

export default async function HomePage() {
  const [profile, experiments, todayMetrics, homeInsights, currentFocus, dataStatus, { t }] = await Promise.all([
    getOrCreateProfile(),
    listExperiments(),
    Promise.all(TODAY_METRICS.map((m) => getBiomarkerDetail(m.key))),
    listHomeInsights(),
    getCurrentFocus(),
    getRealUserDataStatus(),
    getTranslations(),
  ]);
  const activeExperiment = experiments.find((e) => e.status === "active");
  const primaryFocus = currentFocus[0];

  return (
    <PageContainer className="animate-fade-in-up">
      <div>
        <p className="text-sm text-muted-foreground">{t(getGreetingKey())}, {profile.firstName}</p>
        <h1 className="mt-1 text-[28px] font-bold tracking-tight sm:text-[32px]">{t("home.tagline")}</h1>
      </div>

      {dataStatus.isEmpty && <FirstDataChecklist status={dataStatus} />}

      {/* Today's state — real tracked values with a baseline delta, never a composite score */}
      <section className="rounded-2xl border border-border-soft bg-surface p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{t("home.today")}</h2>
          <span className="hidden items-center gap-1 text-[11px] text-muted-foreground sm:inline-flex">{t("home.todayDisclaimer")}</span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {TODAY_METRICS.map((m, i) => {
            const metric = todayMetrics[i];
            return (
              <div key={m.key}>
                <p className="text-[11px] text-muted-foreground">{t(m.labelKey)}</p>
                <p className="mt-0.5 font-mono text-2xl font-semibold tabular-nums text-foreground">
                  {metric ? (m.key === "sleep_duration" ? formatHoursMinutes(metric.currentValue) : metric.currentValue) : "—"}
                  {metric && m.key !== "sleep_duration" && <span className="text-xs text-muted-foreground"> {metric.unit}</span>}
                </p>
                {metric?.changePct !== undefined ? (
                  <p className={metric.trendDirection === "down" ? "text-[11px] text-state-elevated" : "text-[11px] text-state-good"}>
                    {metric.trendDirection === "down" ? "↓" : "↑"} {Math.abs(metric.changePct).toFixed(0)}% {t("home.vsBaseline")}
                  </p>
                ) : (
                  <p className="text-[11px] text-muted-foreground/60">{metric ? t("home.noBaselineYet") : t("common.noDataYet")}</p>
                )}
              </div>
            );
          })}
        </div>

        {primaryFocus && (
          <Link
            href="#current-focus"
            className="mt-4 flex items-center justify-between rounded-xl bg-surface-elevated px-3.5 py-2.5 sm:hidden"
          >
            <span className="text-sm text-muted-foreground">
              {t("home.primaryFocus")}: <span className="font-medium text-foreground">{primaryFocus.title}</span>
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        )}
      </section>

      {/* Body preview */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">{t("home.yourBody")}</h2>
          <Link href="/body" className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
            {t("home.explore")} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {bodySystems.slice(0, 6).map((s) => (
            <BodySystemCard key={s.id} system={s} compact />
          ))}
        </div>
      </section>

      {/* Latest insight — only meaningful, non-early patterns show here by design */}
      {homeInsights.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">{t("home.latestInsight")}</h2>
            <Link href="/insights" className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
              {t("home.allInsights")} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 no-scrollbar sm:mx-0 sm:px-0">
            {homeInsights.map((i) => (
              <InsightCard key={i.id} insight={i} className="w-[280px] shrink-0 sm:w-auto" />
            ))}
          </div>
        </section>
      )}

      {/* Current focus — max 3, prefers accepted Coach priorities over a freshly-computed suggestion */}
      {currentFocus.length > 0 && (
        <section id="current-focus" className="scroll-mt-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">{t("home.currentFocus")}</h2>
            <Link href="/coach" className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
              {t("home.openCoach")} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <CurrentFocusPanel items={currentFocus} />
        </section>
      )}

      {activeExperiment && (
        <section className="flex flex-col gap-3 rounded-2xl border border-dashed border-border p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-medium">{t("home.currentExperiment")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {activeExperiment.title} — {t("home.dayOf", { current: activeExperiment.currentDay, total: activeExperiment.durationDays })}.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/experiments">{t("home.viewExperiment")}</Link>
          </Button>
        </section>
      )}
    </PageContainer>
  );
}
