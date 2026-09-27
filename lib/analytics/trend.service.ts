import { linearRegression, mean } from "@/lib/analytics/stats";
import type { TrendResult } from "@/lib/analytics/types";
import type { SeriesPoint } from "@/lib/analytics/baseline.service";
import { loadMetricSeries } from "@/lib/analytics/baseline.service";

// Deliberately conservative, documented thresholds (docs/ANALYTICS_ARCHITECTURE.md)
// rather than a "smart" adaptive method — the point is that classification is
// reproducible and auditable, not maximally sensitive.
export const MIN_TREND_SAMPLES = 5;
export const MIN_TREND_SPAN_DAYS = 6;
/** Below this, the change is treated as noise rather than a directional trend. */
export const TREND_NOISE_THRESHOLD_PCT = 3;

/**
 * Classifies the direction of a metric over its full provided series using
 * ordinary least-squares regression against elapsed days. This function does
 * NOT decide whether "increasing" is good or bad — see language-safety notes
 * in docs/ANALYTICS_ARCHITECTURE.md; that judgment is metric-specific and
 * belongs to the caller/UI, never to this function.
 */
export function computeTrend(series: SeriesPoint[]): TrendResult {
  const sorted = [...series].sort((a, b) => a.date.getTime() - b.date.getTime());
  const observationDays = sorted.length > 1 ? (sorted[sorted.length - 1].date.getTime() - sorted[0].date.getTime()) / 86_400_000 : 0;

  if (sorted.length < MIN_TREND_SAMPLES || observationDays < MIN_TREND_SPAN_DAYS) {
    return { direction: "INSUFFICIENT_DATA", status: "INSUFFICIENT_DATA", samples: sorted.length, observationDays };
  }

  const firstDate = sorted[0].date.getTime();
  const points = sorted.map((p) => ({ day: (p.date.getTime() - firstDate) / 86_400_000, value: p.value }));
  const { slope, rSquared } = linearRegression(points);

  const firstValue = sorted[0].value;
  const lastValue = sorted[sorted.length - 1].value;
  const meanValue = mean(points.map((p) => p.value));
  // Relative change implied by the fitted trend line over the observed span,
  // expressed against the series' own mean — more robust to a single noisy
  // endpoint than comparing firstValue/lastValue directly.
  const relativeChangePct = meanValue !== 0 ? (slope * observationDays) / Math.abs(meanValue) * 100 : 0;

  const direction: TrendResult["direction"] =
    Math.abs(relativeChangePct) < TREND_NOISE_THRESHOLD_PCT ? "STABLE" : slope > 0 ? "INCREASING" : "DECREASING";

  return {
    direction,
    status: "VALID",
    samples: sorted.length,
    observationDays: Math.round(observationDays),
    firstValue,
    lastValue,
    relativeChangePct,
    slopePerDay: slope,
    rSquared,
  };
}

export async function getTrendForMetric(canonicalKey: string, windowDays?: number): Promise<TrendResult> {
  let series = await loadMetricSeries(canonicalKey);
  if (windowDays !== undefined) {
    const cutoff = new Date(Date.now() - windowDays * 86_400_000);
    series = series.filter((p) => p.date >= cutoff);
  }
  return computeTrend(series);
}
