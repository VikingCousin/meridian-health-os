import { LOW_SOURCE_CONFIDENCE_THRESHOLD } from "@/lib/analytics/association.service";
import type { AssociationResult, ConfidenceResult, DataQualityResult } from "@/lib/analytics/types";

export const CONFIDENCE_DISCLAIMER =
  "This is an internal personal-pattern confidence score, not a probability, and not a measure of scientific, clinical, or medical certainty.";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function levelFor(total: number): ConfidenceResult["level"] {
  if (total >= 75) return "STRONG";
  if (total >= 55) return "MODERATE";
  if (total >= 35) return "POSSIBLE";
  return "EARLY";
}

/**
 * Combines exposure/control sample size, consistency, effect size, data
 * completeness, contradictions, confounding overlap, local-control
 * availability, temporal drift, and source confidence into a single 0-100
 * "personal confidence" score.
 *
 * Every weight below is a documented, heuristic choice — not a statistically
 * derived or validated instrument (see docs/ANALYTICS_ARCHITECTURE.md).
 * Event count alone is capped well below the threshold needed to reach
 * STRONG on its own: with zero consistency and zero effect size, the
 * maximum reachable total from counts + data completeness is 50 — the
 * consistency and effect-size components (up to 40 combined) are required
 * to cross into STRONG territory.
 */
export function computeConfidence(association: AssociationResult, dataQuality: DataQualityResult): ConfidenceResult {
  const totalOccasions = association.supportingCount + association.contradictingCount;

  const exposureCount = Math.round(clamp(association.exposureGroup.n * 1.5, 0, 20));
  const controlCount = Math.round(clamp((association.primaryControlSource === "LOCAL" ? association.localControl.n : association.globalControl.n) * 0.5, 0, 15));
  const consistencyRatio = totalOccasions > 0 ? association.supportingCount / totalOccasions : 0;
  const consistency = Math.round(consistencyRatio * 20);
  const effectSize = Math.round(clamp(Math.abs(association.effect.standardizedDifference ?? 0) * 10, 0, 20));
  const dataCompleteness = { GOOD: 15, LIMITED: 8, POOR: 3, INSUFFICIENT: 0 }[dataQuality.status];
  const contradictionPenalty = -Math.round(clamp(association.contradictingCount * 2, 0, 20));
  const overlapFraction =
    association.quality.confounding.totalExposureOccasions > 0
      ? association.quality.confounding.overlapOccasions / association.quality.confounding.totalExposureOccasions
      : 0;
  const confoundingPenalty = -Math.round(overlapFraction * 15);

  // Falling back from a matched local comparison to the coarser global
  // control is a real loss of specificity — this does not mean the local
  // comparison was insufficient because of anything the user did wrong.
  const localControlPenalty = association.primaryControlSource === "GLOBAL" ? -8 : 0;

  // A metric that itself trended strongly over the analysis window makes a
  // plain exposure-vs-control comparison less trustworthy — the "control"
  // days early in the window may not be comparable to exposure days late in
  // it. This is a documented penalty, not an attempted correction.
  const temporalDriftPenalty = association.quality.temporalDriftDetected ? -8 : 0;

  // Internal analysis weight only — never a claim about medical reliability.
  const avgSourceConfidence = association.quality.sourceConfidence.average;
  const sourceConfidencePenalty =
    avgSourceConfidence !== undefined && avgSourceConfidence < LOW_SOURCE_CONFIDENCE_THRESHOLD
      ? -Math.round(clamp((LOW_SOURCE_CONFIDENCE_THRESHOLD - avgSourceConfidence) * 20, 0, 10))
      : 0;

  const total = clamp(
    exposureCount +
      controlCount +
      consistency +
      effectSize +
      dataCompleteness +
      contradictionPenalty +
      confoundingPenalty +
      localControlPenalty +
      temporalDriftPenalty +
      sourceConfidencePenalty,
    0,
    100
  );

  return {
    total,
    level: levelFor(total),
    components: {
      exposureCount,
      controlCount,
      consistency,
      effectSize,
      dataCompleteness,
      contradictionPenalty,
      confoundingPenalty,
      localControlPenalty,
      temporalDriftPenalty,
      sourceConfidencePenalty,
    },
    disclaimer: CONFIDENCE_DISCLAIMER,
  };
}
