import { mean, median, percentile, stdDev, relativeChangePct } from "@/lib/analytics/stats";
import type { BaselineResult, BaselineWindowDays } from "@/lib/analytics/types";
import * as biomarkerRepo from "@/lib/db/repositories/biomarker.repository";

/** Below this many points in a window, a baseline would be a guess, not a measurement. */
export const MIN_BASELINE_COUNT = 3;

export interface SeriesPoint {
  date: Date;
  value: number;
}

/**
 * Computes robust descriptive stats for a rolling window ending at `asOf`
 * (inclusive), plus the percent change against the immediately preceding
 * window of the same length. Never fabricates a result: too few points in
 * the window returns INSUFFICIENT_DATA instead of a misleading average.
 */
export function computeBaseline(series: SeriesPoint[], windowDays: BaselineWindowDays, asOf: Date = new Date()): BaselineResult {
  const windowStart = new Date(asOf.getTime() - windowDays * 24 * 60 * 60 * 1000);
  const previousWindowStart = new Date(windowStart.getTime() - windowDays * 24 * 60 * 60 * 1000);

  const inWindow = series.filter((p) => p.date > windowStart && p.date <= asOf).map((p) => p.value);
  const inPreviousWindow = series.filter((p) => p.date > previousWindowStart && p.date <= windowStart).map((p) => p.value);

  if (inWindow.length < MIN_BASELINE_COUNT) {
    return { windowDays, status: "INSUFFICIENT_DATA", requiredCount: MIN_BASELINE_COUNT, count: inWindow.length };
  }

  const windowMean = mean(inWindow);
  const changeVsPreviousWindowPct =
    inPreviousWindow.length >= MIN_BASELINE_COUNT ? relativeChangePct(mean(inPreviousWindow), windowMean) : undefined;

  return {
    windowDays,
    status: "VALID",
    count: inWindow.length,
    mean: windowMean,
    median: median(inWindow),
    min: Math.min(...inWindow),
    max: Math.max(...inWindow),
    stdDev: stdDev(inWindow),
    p25: percentile(inWindow, 25),
    p75: percentile(inWindow, 75),
    changeVsPreviousWindowPct,
  };
}

/** Fetches a metric's full measurement history by BiomarkerDefinition.canonicalKey, as plain {date, value} points. */
export async function loadMetricSeries(canonicalKey: string): Promise<SeriesPoint[]> {
  const definition = await biomarkerRepo.findBiomarkerDefinitionByKey(canonicalKey);
  if (!definition) return [];
  const measurements = await biomarkerRepo.listMeasurementsForDefinition(definition.id);
  return measurements.map((m) => ({ date: m.measuredAt, value: m.value }));
}

export async function getBaselineForMetric(
  canonicalKey: string,
  windowDays: BaselineWindowDays,
  asOf: Date = new Date()
): Promise<BaselineResult> {
  const series = await loadMetricSeries(canonicalKey);
  return computeBaseline(series, windowDays, asOf);
}
