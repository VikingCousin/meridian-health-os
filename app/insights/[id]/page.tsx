import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CheckCircle2, XCircle, Info, MessageCircle, AlertTriangle } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { TechnicalPanel } from "@/components/ui/technical-panel";
import { ConfidenceBadge } from "@/components/health/confidence-badge";
import { DismissInsightButton } from "@/components/health/dismiss-insight-button";
import { NewExperimentDialog } from "@/components/health/new-experiment-dialog";
import { Button } from "@/components/ui/button";
import { getInsightDetail, buildExperimentPrefill } from "@/lib/services/insight.service";
import type { InsightDetail } from "@/types/health";
import { format, parseISO } from "date-fns";

const MATCHING_STRATEGY_LABELS: Record<NonNullable<InsightDetail["localControl"]>["matchingStrategy"], string> = {
  day_context_local: "Nearby weekday/weekend-matched nights",
  local_window: `Nearby nights (±${14} days)`,
  insufficient: "Not enough nearby data — using your full recorded history instead",
};

function formatGroupValue(mean: number | undefined, metricKey?: string): string {
  if (mean === undefined) return "—";
  if (metricKey === "sleep_duration") {
    const h = Math.floor(mean);
    const m = Math.round((mean - h) * 60);
    return `${h}h ${m}m`;
  }
  return mean.toFixed(1);
}

function formatDifference(diff: number | undefined, metricKey?: string): string {
  if (diff === undefined) return "—";
  if (metricKey === "sleep_duration") {
    const totalMinutes = Math.round(diff * 60);
    return `${totalMinutes > 0 ? "+" : ""}${totalMinutes} min`;
  }
  return `${diff > 0 ? "+" : ""}${diff.toFixed(2)}`;
}

export default async function InsightDetailPage(props: PageProps<"/insights/[id]">) {
  const { id } = await props.params;
  const insight = await getInsightDetail(id);
  if (!insight) notFound();

  const prefill = buildExperimentPrefill(insight);
  const primaryGroup = insight.primaryControlSource === "local" ? insight.localControl : insight.globalControl;
  const primaryGroupLabel = insight.primaryControlSource === "local" ? "Comparable nearby nights" : "Your full recorded history";

  return (
    <PageContainer className="animate-fade-in-up">
      <PageHeader
        eyebrow={insight.type.replace("_", " ")}
        title={insight.title}
        description={insight.summary}
        action={<ConfidenceBadge level={insight.confidence} />}
      />

      {insight.caveat && (
        <div className="flex items-start gap-2 rounded-xl border border-state-watch-soft bg-state-watch-soft/40 px-4 py-3 text-[13px] text-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-state-watch" />
          <p>{insight.caveat}</p>
        </div>
      )}

      {/* Node / connector diagram */}
      {insight.exposureLabel && insight.outcomeLabel && (
        <TechnicalPanel className="flex items-center justify-center gap-4 p-8" grid>
          <div className="rounded-xl border border-border bg-surface-elevated px-5 py-4 text-center">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Exposure</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{insight.exposureLabel}</p>
          </div>
          <div className="flex flex-col items-center gap-1 text-muted-foreground">
            <span className="text-[11px]">{insight.lag}</span>
            <ArrowRight className="h-5 w-5" />
          </div>
          <div className="rounded-xl border border-border bg-surface-elevated px-5 py-4 text-center">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Outcome</p>
            <p className="mt-1 text-sm font-semibold capitalize text-foreground">{insight.outcomeLabel}</p>
          </div>
        </TechnicalPanel>
      )}

      {/* Comparison — the primary, easy-to-read result */}
      {insight.exposureGroup && primaryGroup && (
        <section>
          <h2 className="mb-3 text-lg font-semibold tracking-tight text-foreground">Comparison</h2>
          <TechnicalPanel className="grid grid-cols-1 divide-y divide-border-soft sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <div className="p-4">
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">After {insight.exposureLabel?.toLowerCase()}</p>
              <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-foreground">{formatGroupValue(insight.exposureGroup.mean, insight.outcomeLabel)}</p>
              <p className="mt-0.5 text-[12px] text-muted-foreground">{insight.exposureGroup.n} occasions</p>
            </div>
            <div className="p-4">
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{primaryGroupLabel}</p>
              <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-foreground">{formatGroupValue(primaryGroup.mean, insight.outcomeLabel)}</p>
              <p className="mt-0.5 text-[12px] text-muted-foreground">{primaryGroup.n} nights</p>
            </div>
            <div className="p-4">
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Difference</p>
              <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-foreground">{formatDifference(insight.effect?.meanDifference, insight.outcomeLabel)}</p>
              {insight.effect?.relativeDifferencePct !== undefined && (
                <p className="mt-0.5 text-[12px] text-muted-foreground">{insight.effect.relativeDifferencePct > 0 ? "+" : ""}{insight.effect.relativeDifferencePct.toFixed(1)}%</p>
              )}
            </div>
          </TechnicalPanel>
          {insight.localControl && (
            <p className="mt-2 text-[12px] text-muted-foreground">
              Matched using: <span className="text-foreground">{MATCHING_STRATEGY_LABELS[insight.localControl.matchingStrategy]}</span>
              {insight.primaryControlSource === "global" && " (local comparison data was insufficient)"}
            </p>
          )}
          {insight.personalBaseline && (
            <p className="mt-1 text-[13px] text-muted-foreground">
              30-day personal baseline: <span className="font-medium text-foreground">{formatGroupValue(insight.personalBaseline.mean, insight.outcomeLabel)}</span>{" "}
              ({insight.personalBaseline.n} measurements)
            </p>
          )}

          {/* Method details — full transparency without cluttering the primary comparison above */}
          <details className="group mt-3 rounded-xl border border-border-soft bg-surface p-4">
            <summary className="cursor-pointer text-[13px] font-medium text-accent [&::-webkit-details-marker]:hidden">Method details</summary>
            <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-[13px] sm:grid-cols-3">
              <MethodRow label="Exposure n" value={insight.exposureGroup.n} />
              <MethodRow label="Local control n" value={insight.localControl?.n} />
              <MethodRow label="Global control n" value={insight.globalControl?.n} />
              <MethodRow label="Exposure median" value={insight.exposureGroup.median?.toFixed(2)} />
              <MethodRow label="Exposure mean" value={insight.exposureGroup.mean?.toFixed(2)} />
              <MethodRow label="Exposure std. dev." value={insight.exposureGroup.stdDev?.toFixed(2)} />
              <MethodRow label="Median difference" value={formatDifference(insight.effect?.medianDifference, insight.outcomeLabel)} />
              <MethodRow
                label="Effect size (Cohen's d)"
                value={insight.effect?.standardizedDifference !== null && insight.effect?.standardizedDifference !== undefined ? insight.effect.standardizedDifference.toFixed(2) : "n/a"}
              />
              <MethodRow label="Missing outcomes" value={insight.quality?.missingOutcomeCount} />
              <MethodRow label="Outliers (exposure)" value={insight.quality?.outlierCountExposure} />
              <MethodRow label="Outliers (control)" value={insight.quality?.outlierCountControl} />
              <MethodRow label="Temporal drift" value={insight.quality?.temporalDriftDetected ? "Detected" : "Not detected"} />
              <MethodRow label="Confounding overlap" value={insight.coOccurringFactors?.reduce((sum, f) => sum + f.count, 0) ?? 0} />
            </div>
          </details>
        </section>
      )}

      {/* Timeline of occasions */}
      {insight.occasions.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold tracking-tight text-foreground">Timeline</h2>
          <TechnicalPanel className="flex flex-col divide-y divide-border-soft">
            {insight.occasions.map((o, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="text-foreground">{format(parseISO(o.exposureDate), "d MMM yyyy")}</span>
                <span
                  className={
                    o.role === "supporting"
                      ? "inline-flex items-center gap-1 text-[12px] text-state-good"
                      : "inline-flex items-center gap-1 text-[12px] text-muted-foreground"
                  }
                >
                  {o.role === "supporting" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                  {o.value.toFixed(1)} · {o.role}
                </span>
              </div>
            ))}
          </TechnicalPanel>
        </section>
      )}

      {/* Evidence: supporting / contradicting */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TechnicalPanel eyebrow="Supporting evidence" className="p-4">
          <p className="font-mono text-2xl font-semibold text-state-good">{insight.supportingCount ?? 0}</p>
          <p className="mt-1 text-[13px] text-muted-foreground">occasions consistent with this pattern</p>
        </TechnicalPanel>
        <TechnicalPanel eyebrow="Contradicting evidence" className="p-4">
          <p className="font-mono text-2xl font-semibold text-foreground">{insight.contradictingCount ?? 0}</p>
          <p className="mt-1 text-[13px] text-muted-foreground">occasions where this did not hold — shown deliberately, not hidden</p>
        </TechnicalPanel>
      </section>

      {/* Confounding */}
      {insight.confoundingNote && (
        <TechnicalPanel eyebrow="Co-occurring recorded factors" className="p-4">
          <p className="text-[13px] text-muted-foreground">{insight.confoundingNote}</p>
          {insight.coOccurringFactors && insight.coOccurringFactors.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1">
              {insight.coOccurringFactors.map((f) => (
                <li key={f.eventType} className="flex items-center justify-between text-[13px]">
                  <span className="text-foreground">{f.eventType.toLowerCase().replace(/_/g, " ")}</span>
                  <span className="font-mono text-muted-foreground">{f.count}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[12px] text-muted-foreground">Not mathematically adjusted for — shown for awareness only.</p>
        </TechnicalPanel>
      )}

      {/* Data quality */}
      {insight.dataQualityStatus && (
        <TechnicalPanel eyebrow="Data quality" className="p-4">
          <p className="text-sm font-medium capitalize text-foreground">{insight.dataQualityStatus}</p>
          {insight.dataQualityReasons && insight.dataQualityReasons.length > 0 && (
            <ul className="mt-2 list-inside list-disc text-[13px] text-muted-foreground">
              {insight.dataQualityReasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
        </TechnicalPanel>
      )}

      {/* Confidence breakdown */}
      {insight.confidenceComponents && (
        <TechnicalPanel eyebrow="Personal confidence breakdown" className="p-4">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[13px] sm:grid-cols-4">
            {Object.entries(insight.confidenceComponents).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between gap-2">
                <span className="capitalize text-muted-foreground">{key.replace(/([A-Z])/g, " $1").trim()}</span>
                <span className="font-mono font-medium text-foreground">{value}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 flex items-start gap-1.5 text-[12px] text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {insight.confidenceDisclaimer}
          </p>
        </TechnicalPanel>
      )}

      {/* Sources */}
      <TechnicalPanel eyebrow="Sources" className="p-4">
        <p className="text-[13px] text-muted-foreground">
          This pattern draws on {insight.evidence.length} traceable record(s) — journal entries and wearable measurements. Every value shown above can be traced back to its original entry.
        </p>
      </TechnicalPanel>

      {/* Footer disclaimer + actions */}
      <div className="flex flex-col gap-4 border-t border-border-soft pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] font-medium text-muted-foreground">{insight.causalityDisclaimer}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/coach">
              <MessageCircle className="h-4 w-4" /> Discuss with Coach
            </Link>
          </Button>
          <DismissInsightButton id={insight.id} />
          <NewExperimentDialog
            defaultValues={prefill}
            trigger={
              <Button size="sm">
                Test this
              </Button>
            }
          />
        </div>
      </div>
    </PageContainer>
  );
}

function MethodRow({ label, value }: { label: string; value: string | number | undefined }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-medium text-foreground">{value ?? "—"}</span>
    </div>
  );
}
