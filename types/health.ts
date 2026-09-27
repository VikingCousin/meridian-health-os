// Core domain types for the Health OS prototype.
// Raw data (measurements), derived data (computed comparisons), and
// insights (interpreted patterns) are kept as distinct shapes throughout —
// see lib/mock-data for where each is produced.

export type DataSourceType =
  | "wearable"
  | "lab"
  | "manual"
  | "journal"
  | "ai_extracted"
  | "calculated"
  | "imported_pdf";

export interface DataSource {
  type: DataSourceType;
  label: string; // e.g. "Amazfit Helio Strap", "Quest Diagnostics"
  date?: string; // ISO date the value was captured
  subjective?: boolean;
}

export type BodySystemId =
  | "brain"
  | "cardiovascular"
  | "lungs"
  | "liver"
  | "gut"
  | "kidneys"
  | "metabolic"
  | "musculoskeletal"
  | "immune";

// "has_data" is a neutral, factual "there is at least one measurement on
// file" state — deliberately not a health judgment like the others, since
// real mode has no computed per-system score (see
// lib/services/body-system-status.service.ts).
export type SystemStatus = "good" | "stable" | "improving" | "attention" | "needs_data" | "has_data";

export interface BodySystem {
  id: BodySystemId;
  name: string;
  shortLabel: string;
  status: SystemStatus;
  statusNote: string;
  summary: string;
  color: string; // css var name, e.g. "sys-cardio"
  hasDetailPage: boolean;
}

export type TrendDirection = "up" | "down" | "flat";

export interface TrendPoint {
  date: string; // ISO date
  label: string; // display label e.g. "Feb 2025"
  value: number;
}

export type MetricRangeKind = "personal_target" | "lab_reference" | "baseline";

export interface MetricRange {
  kind: MetricRangeKind;
  label: string;
  min?: number;
  max?: number;
  display: string; // e.g. "<80 mg/dL"
}

export interface Biomarker {
  id: string;
  name: string;
  shortName: string;
  category: BodySystemId;
  unit: string;
  currentValue: number;
  previousValue?: number;
  changePct?: number;
  trendDirection: TrendDirection;
  ranges: MetricRange[];
  history: TrendPoint[];
  lastMeasured: string;
  source: DataSource;
  description: string;
  whyItMatters: string;
  dataCompleteness: "complete" | "partial" | "sparse";
}

export interface WearableMetric {
  id: string;
  name: string;
  unit: string;
  currentValue: number;
  baseline?: number;
  baselineLabel?: string;
  sevenDayChangePct?: number;
  trendDirection: TrendDirection;
  history: TrendPoint[];
  source: DataSource;
}

export type ConfidenceLevel =
  | "early_observation"
  | "possible_pattern"
  | "moderate_evidence"
  | "strong_pattern";

export interface Insight {
  id: string;
  title: string;
  explanation: string;
  confidence: ConfidenceLevel;
  sourceTypes: DataSourceType[];
  relatedSystem?: BodySystemId;
  exploreHref?: string;
  createdAt: string;
}

export type TimelineEventType =
  | "lab"
  | "wearable"
  | "training"
  | "weight"
  | "supplement"
  | "illness"
  | "journal"
  | "experiment"
  | "goal";

export interface HealthEvent {
  id: string;
  type: TimelineEventType;
  date: string;
  title: string;
  detail?: string;
  tags?: string[];
  metrics?: { label: string; value: string }[];
  source: DataSource;
}

export interface JournalTag {
  label: string;
  category: "nutrition" | "sleep" | "training" | "mood" | "symptom" | "other";
}

export interface JournalEntry {
  id: string;
  date: string;
  text: string;
  aiObservations: string[];
  tags: JournalTag[];
}

export type GoalKind = "long_term" | "supporting" | "project";
export type GoalStatus = "on_track" | "attention" | "preparation" | "completed" | "abandoned";
export type GoalTimeHorizon = "long_term" | "quarter" | "month" | "temporary";

export interface Goal {
  id: string;
  kind: GoalKind;
  title: string;
  description: string;
  status: GoalStatus;
  progress?: number; // 0-100
  targetDate?: string;
  relatedSystems?: BodySystemId[];
  /** Raw DB category enum (e.g. "CARDIOVASCULAR") — used by the Coach for goal-to-intervention matching; not yet styled for direct UI display. */
  category: string;
  parentGoalId?: string;
  timeHorizon?: GoalTimeHorizon;
  rationale?: string;
  successCriteria?: string;
}

export interface ExperimentMetricSnapshot {
  metric: string;
  baseline: number;
  current: number;
  unit: string;
}

export interface Experiment {
  id: string;
  title: string;
  hypothesis: string;
  durationDays: number;
  currentDay: number;
  status: "active" | "completed" | "planned" | "abandoned";
  trackedMetrics: string[];
  snapshots: ExperimentMetricSnapshot[];
  startDate: string;
}

export interface ReadinessScore {
  id: string;
  label: string;
  score: number; // 0-100
  note?: string;
}

export type ConfidenceTier = "high" | "medium" | "low" | "unrecognized";

export interface ExtractedLabValue {
  id: string;
  name: string;
  value: string;
  unit: string;
  confirmed: boolean;
  /** @deprecated superseded by confidenceTier; kept so nothing reading it breaks. */
  flagged?: boolean;
  confidenceTier: ConfidenceTier;
  /** Whether this raw marker name currently resolves to a known BiomarkerDefinition. */
  mapped: boolean;
  biomarkerDefinitionId?: string;
  referenceMin?: number;
  referenceMax?: number;
  /** A non-numeric reference range as printed (e.g. "Premenopausal: 15-350"), when it can't be reduced to two numbers. */
  referenceText?: string;
}

// ---------------------------------------------------------------------------
// Phase 4 — Personal Pattern Engine (real, DB-backed insights)
//
// These reuse the existing `ConfidenceLevel` vocabulary from `Insight` above
// (early_observation/possible_pattern/moderate_evidence/strong_pattern) so
// the Home/Body insight cards built in earlier phases keep working
// unchanged; `InsightSummaryCard`/`InsightDetail` add the richer,
// traceable shape the real analytics engine produces.
// ---------------------------------------------------------------------------

export type HealthInsightType = "trend" | "association" | "recovery" | "behavior" | "experiment" | "biomarker" | "data_quality";
export type HealthInsightStatus = "active" | "watching" | "confirmed" | "dismissed" | "stale";
export type InsightEvidenceRole = "exposure" | "outcome" | "baseline" | "control" | "supporting" | "contradicting" | "confounding";
export type InsightEvidenceSourceType = "journal_observation" | "normalized_event" | "biomarker_measurement";

export interface InsightGroupStat {
  n: number;
  mean?: number;
  median?: number;
  stdDev?: number;
}

export interface InsightEvidenceItem {
  id: string;
  role: InsightEvidenceRole;
  sourceType: InsightEvidenceSourceType;
  sourceId: string;
  observedAt?: string;
  numericValue?: number;
}

export interface InsightOccasion {
  exposureDate: string;
  outcomeDate: string;
  value: number;
  role: "supporting" | "contradicting";
}

export interface InsightSummaryCard {
  id: string;
  type: HealthInsightType;
  title: string;
  summary: string;
  status: HealthInsightStatus;
  confidence: ConfidenceLevel;
  confidenceScore: number;
  primarySystem?: BodySystemId;
  secondarySystem?: BodySystemId;
  firstObservedAt: string;
  lastObservedAt: string;
  supportingCount?: number;
  contradictingCount?: number;
  sourceTypes: DataSourceType[];
  /** The outcome metric's canonical key, for an association insight — lets callers (e.g. the Coach) resolve relevant biomarkers without re-parsing the title. */
  primaryMetricKey?: string;
  /** The exposure event type, for an association insight (e.g. "LATE_MEAL"). */
  exposureType?: string;
}

export type MatchingStrategy = "day_context_local" | "local_window" | "insufficient";

export interface LocalControlGroupStat extends InsightGroupStat {
  windowDays: number;
  matchingStrategy: MatchingStrategy;
  status: "valid" | "limited_control_data";
}

export interface EffectStats {
  meanDifference?: number;
  medianDifference?: number;
  relativeDifferencePct?: number;
  /** Cohen's d (pooled-SD standardized mean difference) vs. whichever control is primary. Null when not computable — never NaN/Infinity. */
  standardizedDifference: number | null;
}

export interface QualityDiagnostics {
  missingOutcomeCount: number;
  outlierCountExposure: number;
  outlierCountControl: number;
  temporalDriftDetected: boolean;
  sourceConfidenceAverage?: number;
  lowSourceConfidenceCount: number;
}

export interface InsightDetail extends InsightSummaryCard {
  exposureLabel?: string;
  outcomeLabel?: string;
  lag?: string;
  exposureGroup?: InsightGroupStat;
  localControl?: LocalControlGroupStat;
  globalControl?: InsightGroupStat;
  /** Which control the comparison above and the headline difference use. */
  primaryControlSource?: "local" | "global";
  personalBaseline?: InsightGroupStat & { windowDays: number };
  effect?: EffectStats;
  quality?: QualityDiagnostics;
  confidenceComponents?: Record<string, number>;
  confidenceDisclaimer: string;
  dataQualityStatus?: "good" | "limited" | "poor" | "insufficient";
  dataQualityReasons?: string[];
  confoundingNote?: string;
  coOccurringFactors?: { eventType: string; count: number }[];
  /** A cautious caveat sentence (weak local control / temporal drift / frequent confounders), if any applies. */
  caveat?: string;
  evidence: InsightEvidenceItem[];
  occasions: InsightOccasion[];
  /** Always shown in the UI footer: "Association observed — not proof of causation." */
  causalityDisclaimer: string;
}
