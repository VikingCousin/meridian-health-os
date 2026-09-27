import { mean, median, relativeChangePct } from "@/lib/analytics/stats";
import type { GroupStats } from "@/lib/analytics/types";
import { loadMetricSeries } from "@/lib/analytics/baseline.service";

export type ExperimentClassification =
  | "DIRECTIONALLY_FAVORABLE"
  | "MIXED"
  | "NO_CLEAR_CHANGE"
  | "DIRECTIONALLY_UNFAVORABLE"
  | "INSUFFICIENT_DATA";

/** Which direction counts as "favorable" for a given metric — this is domain knowledge, not something inferred from the data. */
export const FAVORABLE_DIRECTION: Record<string, "increase" | "decrease"> = {
  sleep_duration: "increase",
  sleep_score: "increase",
  hrv: "increase",
  resting_hr: "decrease",
  subjective_energy: "increase",
  stress_level: "decrease",
};

const MIN_PERIOD_SAMPLES = 3;
const NOISE_THRESHOLD_PCT = 3;

export interface OutcomeComparison {
  metricKey: string;
  baseline: GroupStats;
  experiment: GroupStats;
  differenceAbsolute?: number;
  differenceRelativePct?: number;
  classification: ExperimentClassification;
}

function toGroupStats(values: number[]): GroupStats {
  if (values.length === 0) return { n: 0 };
  return { n: values.length, mean: mean(values), median: median(values) };
}

/**
 * Compares a metric's values across a before/after window. Never emits
 * "SUCCESS" or "FAILED" — only a neutral directional classification, and
 * only when there's a known favorable direction and enough data on both
 * sides.
 */
export function compareOutcome(
  metricKey: string,
  baselineValues: number[],
  experimentValues: number[],
  favorableDirection = FAVORABLE_DIRECTION[metricKey]
): OutcomeComparison {
  const baseline = toGroupStats(baselineValues);
  const experiment = toGroupStats(experimentValues);

  if (baseline.n < MIN_PERIOD_SAMPLES || experiment.n < MIN_PERIOD_SAMPLES) {
    return { metricKey, baseline, experiment, classification: "INSUFFICIENT_DATA" };
  }

  const differenceAbsolute = experiment.mean! - baseline.mean!;
  const differenceRelativePct = relativeChangePct(baseline.mean!, experiment.mean!);

  let classification: ExperimentClassification = "NO_CLEAR_CHANGE";
  if (differenceRelativePct !== undefined && Math.abs(differenceRelativePct) >= NOISE_THRESHOLD_PCT && favorableDirection) {
    const movedUp = differenceRelativePct > 0;
    const isFavorable = (movedUp && favorableDirection === "increase") || (!movedUp && favorableDirection === "decrease");
    classification = isFavorable ? "DIRECTIONALLY_FAVORABLE" : "DIRECTIONALLY_UNFAVORABLE";
  }

  return { metricKey, baseline, experiment, differenceAbsolute, differenceRelativePct, classification };
}

/** Rolls several outcome comparisons into one overall experiment classification. */
export function summarizeExperiment(outcomes: OutcomeComparison[]): ExperimentClassification {
  const usable = outcomes.filter((o) => o.classification !== "INSUFFICIENT_DATA");
  if (usable.length === 0) return "INSUFFICIENT_DATA";
  const favorable = usable.filter((o) => o.classification === "DIRECTIONALLY_FAVORABLE").length;
  const unfavorable = usable.filter((o) => o.classification === "DIRECTIONALLY_UNFAVORABLE").length;
  if (favorable > 0 && unfavorable > 0) return "MIXED";
  if (favorable > 0) return "DIRECTIONALLY_FAVORABLE";
  if (unfavorable > 0) return "DIRECTIONALLY_UNFAVORABLE";
  return "NO_CLEAR_CHANGE";
}

export interface ExperimentAnalysis {
  outcomes: OutcomeComparison[];
  overall: ExperimentClassification;
}

/** DB-wired: compares each metric's values in [baselineStart,baselineEnd) against [experimentStart,experimentEnd]. */
export async function analyzeExperiment(
  metricKeys: string[],
  baselineStart: Date,
  baselineEnd: Date,
  experimentStart: Date,
  experimentEnd: Date
): Promise<ExperimentAnalysis> {
  const outcomes: OutcomeComparison[] = [];
  for (const key of metricKeys) {
    const series = await loadMetricSeries(key);
    const baselineValues = series.filter((p) => p.date >= baselineStart && p.date < baselineEnd).map((p) => p.value);
    const experimentValues = series.filter((p) => p.date >= experimentStart && p.date <= experimentEnd).map((p) => p.value);
    outcomes.push(compareOutcome(key, baselineValues, experimentValues));
  }
  return { outcomes, overall: summarizeExperiment(outcomes) };
}
