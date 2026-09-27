import Link from "next/link";
import { ArrowRight, ArrowDownRight, ArrowUpRight, Minus, TrendingUp } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { TechnicalPanel } from "@/components/ui/technical-panel";
import { InsightSummaryCard } from "@/components/health/insight-summary-card";
import { RunAnalysisButton } from "@/components/health/run-analysis-button";
import { listInsightSummaries, listDataQualityFlags } from "@/lib/services/insight.service";
import { listExperiments } from "@/lib/services/experiment.service";
import { getTrendForMetric } from "@/lib/analytics/trend.service";
import { METRIC_LABELS } from "@/lib/analytics/language";

const TREND_METRICS = ["hrv", "sleep_score", "resting_hr", "training_load"];

function TrendRow({ metricKey, trend }: { metricKey: string; trend: Awaited<ReturnType<typeof getTrendForMetric>> }) {
  const label = METRIC_LABELS[metricKey] ?? metricKey;
  if (trend.status === "INSUFFICIENT_DATA") {
    return (
      <div className="flex items-center justify-between px-4 py-3 text-sm">
        <span className="capitalize text-foreground">{label}</span>
        <span className="text-[12px] text-muted-foreground">Not enough data yet</span>
      </div>
    );
  }
  const Icon = trend.direction === "INCREASING" ? ArrowUpRight : trend.direction === "DECREASING" ? ArrowDownRight : Minus;
  return (
    <div className="flex items-center justify-between px-4 py-3 text-sm">
      <span className="capitalize text-foreground">{label}</span>
      <span className="inline-flex items-center gap-3">
        <span className="text-[12px] text-muted-foreground">{trend.observationDays}d, {trend.samples} samples</span>
        {/* Direction is reported neutrally — this function makes no claim about whether "up" or "down" is good, see docs/ANALYTICS_ARCHITECTURE.md */}
        <span className="inline-flex items-center gap-1 font-mono text-[12px] font-medium text-foreground">
          <Icon className="h-3.5 w-3.5" />
          {trend.direction === "STABLE" ? "Stable" : `${trend.relativeChangePct?.toFixed(1)}%`}
        </span>
      </span>
    </div>
  );
}

export default async function InsightsPage() {
  const [insights, experiments, trends, dataQualityFlags] = await Promise.all([
    listInsightSummaries(),
    listExperiments(),
    Promise.all(TREND_METRICS.map(async (key) => ({ key, trend: await getTrendForMetric(key) }))),
    listDataQualityFlags(),
  ]);

  const active = insights.filter((i) => i.status === "active" || i.status === "watching" || i.status === "confirmed");
  const recent = [...active].sort((a, b) => (a.lastObservedAt < b.lastObservedAt ? 1 : -1)).slice(0, 3);
  // Data-quality reasons are read from already-persisted insight metadata —
  // this page never re-runs the full analysis on load, only "Analyze my
  // health data" does (see docs/ANALYTICS_ARCHITECTURE.md).

  return (
    <PageContainer className="animate-fade-in-up">
      <PageHeader
        eyebrow="Personal Intelligence"
        title="Insights"
        description="Patterns emerging from your longitudinal data — every result stays traceable back to the records behind it."
        action={<RunAnalysisButton />}
      />

      <section>
        <h2 className="mb-3 text-lg font-semibold tracking-tight text-foreground">Recent</h2>
        {recent.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No insights yet — run &ldquo;Analyze my health data&rdquo; to look for patterns in what you&apos;ve logged so far.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {recent.map((i) => (
              <InsightSummaryCard key={i.id} insight={i} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold tracking-tight text-foreground">Patterns</h2>
        {active.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No active patterns yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {active.map((i) => (
              <InsightSummaryCard key={i.id} insight={i} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold tracking-tight text-foreground">Trends</h2>
        <TechnicalPanel eyebrow={<span className="flex items-center gap-1.5"><TrendingUp className="h-3 w-3" /> Direction, not judgment</span>}>
          <div className="flex flex-col divide-y divide-border-soft">
            {trends.map(({ key, trend }) => (
              <TrendRow key={key} metricKey={key} trend={trend} />
            ))}
          </div>
        </TechnicalPanel>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Experiments</h2>
          <Link href="/experiments" className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
            All experiments <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {experiments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No experiments running — a pattern&apos;s detail page can prefill one for you.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {experiments.slice(0, 3).map((e) => (
              <div key={e.id} className="flex items-center justify-between rounded-xl border border-border-soft bg-surface px-4 py-3 text-sm">
                <span className="font-medium text-foreground">{e.title}</span>
                <span className="text-[12px] capitalize text-muted-foreground">{e.status}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold tracking-tight text-foreground">Data quality</h2>
        <TechnicalPanel className="p-4">
          {dataQualityFlags.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">
              No data-quality issues flagged on your current active patterns. Data quality is re-evaluated every time you run analysis.
            </p>
          ) : (
            <ul className="list-inside list-disc text-[13px] text-muted-foreground">
              {dataQualityFlags.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          )}
        </TechnicalPanel>
      </section>
    </PageContainer>
  );
}
