import type { AssociationResult, DataQualityResult } from "@/lib/analytics/types";

export interface DataQualityInput {
  exposureCount: number;
  controlCount: number;
  /** Exposure occasions that had no matching outcome measurement at all. */
  missingOutcomeCount?: number;
  /** Largest gap, in days, found in the outcome metric's measurement history. */
  largestGapDays?: number;
  /** How many of the underlying exposure observations were extracted with low confidence. */
  lowConfidenceObservationCount?: number;
}

const MIN_EXPOSURE_FOR_INSUFFICIENT = 3;
const MIN_CONTROL_FOR_INSUFFICIENT = 3;
const LOW_CONTROL_WARNING = 5;
const LARGE_GAP_DAYS = 14;

/**
 * Flags reasons an association's data might be thin or unreliable — this
 * feeds directly into the confidence score's dataCompleteness component and
 * can suppress an insight outright. Every status carries an explicit
 * `reasons` list; "POOR" or "INSUFFICIENT" should never be silent.
 */
export function computeDataQuality(input: DataQualityInput): DataQualityResult {
  const reasons: string[] = [];

  if (input.exposureCount < MIN_EXPOSURE_FOR_INSUFFICIENT) reasons.push(`Only ${input.exposureCount} exposure event(s) available`);
  if (input.controlCount < LOW_CONTROL_WARNING) reasons.push(`Only ${input.controlCount} non-exposure day(s) available for comparison`);
  if (input.missingOutcomeCount && input.missingOutcomeCount > 0)
    reasons.push(`Outcome data missing on ${input.missingOutcomeCount} relevant occasion(s)`);
  if (input.largestGapDays && input.largestGapDays > LARGE_GAP_DAYS)
    reasons.push(`A ${Math.round(input.largestGapDays)}-day gap exists in the outcome measurement history`);
  if (input.lowConfidenceObservationCount && input.lowConfidenceObservationCount > 0)
    reasons.push(`${input.lowConfidenceObservationCount} exposure observation(s) were recorded with low extraction confidence`);

  const insufficient = input.exposureCount < MIN_EXPOSURE_FOR_INSUFFICIENT || input.controlCount < MIN_CONTROL_FOR_INSUFFICIENT;
  const status: DataQualityResult["status"] = insufficient ? "INSUFFICIENT" : reasons.length >= 3 ? "POOR" : reasons.length >= 1 ? "LIMITED" : "GOOD";

  return { status, reasons };
}

export function computeDataQualityFromAssociation(association: AssociationResult): DataQualityResult {
  const controlCount = association.primaryControlSource === "LOCAL" ? association.localControl.n : association.globalControl.n;
  return computeDataQuality({
    exposureCount: association.exposureGroup.n,
    controlCount,
    missingOutcomeCount: association.quality.missingOutcomeCount,
  });
}
