// Shared result shapes for the deterministic analytics layer. Every field
// here is produced by plain TypeScript arithmetic (lib/analytics/stats.ts) —
// nothing in this file is ever filled in by an LLM. See
// docs/ANALYTICS_ARCHITECTURE.md for the full pipeline this feeds.

export type BaselineWindowDays = 7 | 14 | 30 | 90;

export interface BaselineResult {
  windowDays: BaselineWindowDays;
  status: "VALID" | "INSUFFICIENT_DATA";
  requiredCount?: number;
  count: number;
  mean?: number;
  median?: number;
  min?: number;
  max?: number;
  stdDev?: number;
  p25?: number;
  p75?: number;
  changeVsPreviousWindowPct?: number;
}

export type TrendDirection = "INCREASING" | "DECREASING" | "STABLE" | "INSUFFICIENT_DATA";

export interface TrendResult {
  direction: TrendDirection;
  samples: number;
  observationDays: number;
  firstValue?: number;
  lastValue?: number;
  relativeChangePct?: number;
  slopePerDay?: number;
  rSquared?: number;
  status: "VALID" | "INSUFFICIENT_DATA";
}

export type EventLag = "SAME_DAY" | "SAME_NIGHT" | "NEXT_MORNING" | "NEXT_NIGHT" | "NEXT_DAY" | "NEXT_24H" | "NEXT_48H";

export interface GroupStats {
  n: number;
  mean?: number;
  median?: number;
  stdDev?: number;
}

export interface ConfoundingSummary {
  totalExposureOccasions: number;
  /** How many of the exposure occasions also had at least one other recorded factor. */
  overlapOccasions: number;
  coOccurringCounts: { eventType: string; count: number }[];
  note: string;
}

export interface AssociationOccasion {
  exposureEventId: string;
  exposureDate: string;
  outcomeDate: string;
  value: number;
  role: "SUPPORTING" | "CONTRADICTING";
  /** Source confidence carried over from the originating NormalizedHealthEvent, when available. */
  confidence?: number;
}

/** How a local-control comparison was actually built for a candidate. */
export type MatchingStrategy = "DAY_CONTEXT_LOCAL" | "LOCAL_WINDOW" | "INSUFFICIENT";

export interface LocalControlStats extends GroupStats {
  windowDays: number;
  matchingStrategy: MatchingStrategy;
  status: "VALID" | "LIMITED_CONTROL_DATA";
}

export interface EffectStats {
  meanDifference?: number;
  medianDifference?: number;
  relativeDifferencePct?: number;
  /** Cohen's d (pooled-SD standardized mean difference) between the exposure group and whichever control is primary. Null, never NaN/Infinity, when undefined. */
  standardizedDifference: number | null;
}

export interface SourceConfidenceSummary {
  /** Mean of the exposure occasions' source confidence, where available. */
  average?: number;
  /** Count of exposure occasions with a recorded confidence below the low-confidence threshold. */
  lowConfidenceCount: number;
}

export interface QualityDiagnostics {
  missingOutcomeCount: number;
  outlierCountExposure: number;
  outlierCountControl: number;
  temporalDriftDetected: boolean;
  confounding: ConfoundingSummary;
  sourceConfidence: SourceConfidenceSummary;
}

export interface AssociationResult {
  exposureType: string;
  outcomeMetricKey: string;
  lag: EventLag;
  exposureGroup: GroupStats;
  localControl: LocalControlStats;
  globalControl: GroupStats;
  /** Which control group the effect/difference figures below are computed against — LOCAL when sufficient, GLOBAL as a documented fallback otherwise. */
  primaryControlSource: "LOCAL" | "GLOBAL";
  personalBaseline?: GroupStats & { windowDays: BaselineWindowDays };
  effect: EffectStats;
  quality: QualityDiagnostics;
  supportingCount: number;
  contradictingCount: number;
  /** Per-occasion detail behind supportingCount/contradictingCount — the raw material for "why am I seeing this?" */
  occasions: AssociationOccasion[];
  status: "VALID" | "INSUFFICIENT_DATA";
  reasons?: string[];
}

export type ConfidenceLevel = "EARLY" | "POSSIBLE" | "MODERATE" | "STRONG";

export interface ConfidenceComponents {
  exposureCount: number;
  controlCount: number;
  consistency: number;
  effectSize: number;
  dataCompleteness: number;
  contradictionPenalty: number;
  confoundingPenalty: number;
  /** Applied when local control was insufficient and the comparison fell back to global control. */
  localControlPenalty: number;
  /** Applied when the outcome metric showed strong drift across the full analysis period. */
  temporalDriftPenalty: number;
  /** Applied when the underlying exposure observations have low average source confidence. */
  sourceConfidencePenalty: number;
}

export interface ConfidenceResult {
  total: number;
  level: ConfidenceLevel;
  components: ConfidenceComponents;
  /** Always attach this note wherever a score is displayed — see language-safety rules. */
  disclaimer: string;
}

export type DataQualityStatus = "GOOD" | "LIMITED" | "POOR" | "INSUFFICIENT";

export interface DataQualityResult {
  status: DataQualityStatus;
  reasons: string[];
}
