import type { NormalizedEventType } from "@/lib/generated/prisma/client";
import type { EventLag } from "@/lib/analytics/types";

export interface AssociationCandidate {
  exposureType: NormalizedEventType;
  /** BiomarkerDefinition.canonicalKey of the outcome metric. */
  outcomeMetricKey: string;
  lag: EventLag;
}

/**
 * The explicit, hand-authored set of relationships the pattern engine is
 * allowed to test. This is code/configuration, not AI-generated, and is
 * deliberately NOT "every exposure against every metric" — an untargeted
 * search like that would be data-mining bias dressed up as personalization.
 * Add a row here only when there's a real reason to expect (or rule out) a
 * relationship; see docs/ANALYTICS_ARCHITECTURE.md.
 */
export const ASSOCIATION_REGISTRY: AssociationCandidate[] = [
  { exposureType: "LATE_MEAL", outcomeMetricKey: "sleep_duration", lag: "NEXT_NIGHT" },
  { exposureType: "LATE_MEAL", outcomeMetricKey: "sleep_score", lag: "NEXT_NIGHT" },
  { exposureType: "LATE_MEAL", outcomeMetricKey: "hrv", lag: "NEXT_MORNING" },
  { exposureType: "LATE_MEAL", outcomeMetricKey: "resting_hr", lag: "NEXT_MORNING" },
  { exposureType: "LATE_MEAL", outcomeMetricKey: "subjective_energy", lag: "NEXT_DAY" },

  { exposureType: "ALCOHOL", outcomeMetricKey: "sleep_duration", lag: "SAME_NIGHT" },
  { exposureType: "ALCOHOL", outcomeMetricKey: "hrv", lag: "NEXT_MORNING" },
  { exposureType: "ALCOHOL", outcomeMetricKey: "resting_hr", lag: "NEXT_MORNING" },

  { exposureType: "SAUNA", outcomeMetricKey: "sleep_duration", lag: "SAME_NIGHT" },
  { exposureType: "SAUNA", outcomeMetricKey: "hrv", lag: "NEXT_MORNING" },

  { exposureType: "HIGH_INTENSITY", outcomeMetricKey: "hrv", lag: "NEXT_DAY" },
  { exposureType: "HIGH_INTENSITY", outcomeMetricKey: "resting_hr", lag: "NEXT_DAY" },
  { exposureType: "HIGH_INTENSITY", outcomeMetricKey: "subjective_energy", lag: "NEXT_DAY" },

  { exposureType: "STRENGTH_TRAINING", outcomeMetricKey: "hrv", lag: "NEXT_DAY" },
  { exposureType: "POOR_SLEEP_SUBJECTIVE", outcomeMetricKey: "subjective_energy", lag: "NEXT_DAY" },
];
