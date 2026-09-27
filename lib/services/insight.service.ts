import * as insightRepo from "@/lib/db/repositories/insight.repository";
import { toUiBodySystem } from "@/lib/services/enum-maps";
import { CAUSALITY_DISCLAIMER, LAG_LABELS, METRIC_LABELS, EVENT_TYPE_LABELS, associationCaveat } from "@/lib/analytics/language";
import type {
  HealthInsight,
  InsightEvidence,
  InsightType as DbInsightType,
  InsightStatus as DbInsightStatus,
  InsightConfidenceLevel as DbConfidenceLevel,
  InsightEvidenceRole as DbEvidenceRole,
  InsightEvidenceSourceType as DbEvidenceSourceType,
} from "@/lib/generated/prisma/client";
import type {
  BodySystemId,
  ConfidenceLevel,
  DataSourceType,
  HealthInsightStatus,
  HealthInsightType,
  Insight as LegacyInsight,
  InsightDetail,
  InsightEvidenceItem,
  InsightEvidenceRole,
  InsightEvidenceSourceType,
  InsightSummaryCard,
  MatchingStrategy,
} from "@/types/health";
import type { AssociationInsightMetadata } from "@/lib/analytics/health-analysis.service";

const typeToUi: Record<DbInsightType, HealthInsightType> = {
  TREND: "trend",
  ASSOCIATION: "association",
  RECOVERY: "recovery",
  BEHAVIOR: "behavior",
  EXPERIMENT: "experiment",
  BIOMARKER: "biomarker",
  DATA_QUALITY: "data_quality",
};

const statusToUi: Record<DbInsightStatus, HealthInsightStatus> = {
  ACTIVE: "active",
  WATCHING: "watching",
  CONFIRMED_BY_USER: "confirmed",
  DISMISSED: "dismissed",
  STALE: "stale",
};

const confidenceLevelToUi: Record<DbConfidenceLevel, ConfidenceLevel> = {
  EARLY: "early_observation",
  POSSIBLE: "possible_pattern",
  MODERATE: "moderate_evidence",
  STRONG: "strong_pattern",
};

const evidenceRoleToUi: Record<DbEvidenceRole, InsightEvidenceRole> = {
  EXPOSURE: "exposure",
  OUTCOME: "outcome",
  BASELINE: "baseline",
  CONTROL: "control",
  SUPPORTING: "supporting",
  CONTRADICTING: "contradicting",
  CONFOUNDING: "confounding",
};

const evidenceSourceToUi: Record<DbEvidenceSourceType, InsightEvidenceSourceType> = {
  JOURNAL_OBSERVATION: "journal_observation",
  NORMALIZED_EVENT: "normalized_event",
  BIOMARKER_MEASUREMENT: "biomarker_measurement",
};

function sourceTypesFor(metadata: AssociationInsightMetadata | null): DataSourceType[] {
  if (!metadata) return ["journal"];
  return ["journal", "wearable"];
}

function toUiSummary(insight: HealthInsight): InsightSummaryCard {
  const metadata = insight.metadata as unknown as AssociationInsightMetadata | null;
  return {
    id: insight.id,
    type: typeToUi[insight.type],
    title: insight.title,
    summary: insight.summary,
    status: statusToUi[insight.status],
    confidence: confidenceLevelToUi[insight.confidenceLevel],
    confidenceScore: insight.confidenceScore,
    primarySystem: insight.primarySystem ? toUiBodySystem(insight.primarySystem) : undefined,
    secondarySystem: insight.secondarySystem ? toUiBodySystem(insight.secondarySystem) : undefined,
    firstObservedAt: insight.firstObservedAt.toISOString(),
    lastObservedAt: insight.lastObservedAt.toISOString(),
    supportingCount: metadata?.association.supportingCount,
    contradictingCount: metadata?.association.contradictingCount,
    sourceTypes: sourceTypesFor(metadata),
    primaryMetricKey: metadata?.association.outcomeMetricKey,
    exposureType: metadata?.association.exposureType,
  };
}

function toUiEvidence(row: InsightEvidence): InsightEvidenceItem {
  return {
    id: row.id,
    role: evidenceRoleToUi[row.role],
    sourceType: evidenceSourceToUi[row.sourceType],
    sourceId: row.sourceId,
    observedAt: row.observedAt?.toISOString(),
    numericValue: row.numericValue ?? undefined,
  };
}

export async function listInsightSummaries(): Promise<InsightSummaryCard[]> {
  const insights = await insightRepo.listInsights();
  return insights.map(toUiSummary);
}

export async function listActiveInsightSummaries(): Promise<InsightSummaryCard[]> {
  const insights = await insightRepo.listActiveInsights();
  return insights.map(toUiSummary);
}

/**
 * Adapts a real InsightSummaryCard to the legacy `Insight` shape so the
 * existing `InsightCard` component (Home, Body) keeps working unchanged.
 */
export function toLegacyInsight(card: InsightSummaryCard): LegacyInsight {
  return {
    id: card.id,
    title: card.title,
    explanation: card.summary,
    confidence: card.confidence,
    sourceTypes: card.sourceTypes,
    relatedSystem: card.primarySystem,
    exploreHref: `/insights/${card.id}`,
    createdAt: card.lastObservedAt,
  };
}

/**
 * Home should only ever show meaningful, non-noisy insights — never
 * EARLY/WATCHING ones, and never a dismissed/stale one.
 */
export async function listHomeInsights(limit = 4): Promise<LegacyInsight[]> {
  const insights = await listActiveInsightSummaries();
  return insights
    .filter((i) => i.status === "active" && i.confidence !== "early_observation")
    .slice(0, limit)
    .map(toLegacyInsight);
}

export async function listInsightsForSystem(system: BodySystemId, limit = 3): Promise<LegacyInsight[]> {
  const insights = await listActiveInsightSummaries();
  return insights
    .filter((i) => i.status === "active" && (i.primarySystem === system || i.secondarySystem === system))
    .slice(0, limit)
    .map(toLegacyInsight);
}

export async function getInsightDetail(id: string): Promise<InsightDetail | null> {
  const insight = await insightRepo.findInsightById(id);
  if (!insight) return null;
  const metadata = insight.metadata as unknown as AssociationInsightMetadata | null;
  const summary = toUiSummary(insight);

  if (!metadata) {
    return {
      ...summary,
      confidenceDisclaimer: "This is an internal personal-pattern confidence score, not a probability.",
      evidence: insight.evidence.map(toUiEvidence),
      occasions: [],
      causalityDisclaimer: CAUSALITY_DISCLAIMER,
    };
  }

  const { association, confidence, dataQuality } = metadata;
  const matchingStrategyToUi: Record<string, MatchingStrategy> = {
    DAY_CONTEXT_LOCAL: "day_context_local",
    LOCAL_WINDOW: "local_window",
    INSUFFICIENT: "insufficient",
  };
  const confoundersFrequent =
    association.quality.confounding.totalExposureOccasions > 0 &&
    association.quality.confounding.overlapOccasions / association.quality.confounding.totalExposureOccasions >= 0.5;

  return {
    ...summary,
    exposureLabel: EVENT_TYPE_LABELS[association.exposureType] ?? association.exposureType,
    outcomeLabel: METRIC_LABELS[association.outcomeMetricKey] ?? association.outcomeMetricKey,
    lag: LAG_LABELS[association.lag] ?? association.lag,
    exposureGroup: association.exposureGroup,
    localControl: {
      ...association.localControl,
      matchingStrategy: matchingStrategyToUi[association.localControl.matchingStrategy],
      status: association.localControl.status === "VALID" ? "valid" : "limited_control_data",
    },
    globalControl: association.globalControl,
    primaryControlSource: association.primaryControlSource === "LOCAL" ? "local" : "global",
    personalBaseline: association.personalBaseline,
    effect: association.effect,
    quality: {
      missingOutcomeCount: association.quality.missingOutcomeCount,
      outlierCountExposure: association.quality.outlierCountExposure,
      outlierCountControl: association.quality.outlierCountControl,
      temporalDriftDetected: association.quality.temporalDriftDetected,
      sourceConfidenceAverage: association.quality.sourceConfidence.average,
      lowSourceConfidenceCount: association.quality.sourceConfidence.lowConfidenceCount,
    },
    confidenceComponents: confidence.components as unknown as Record<string, number>,
    confidenceDisclaimer: confidence.disclaimer,
    dataQualityStatus: dataQuality.status.toLowerCase() as InsightDetail["dataQualityStatus"],
    dataQualityReasons: dataQuality.reasons,
    confoundingNote: association.quality.confounding.note,
    coOccurringFactors: association.quality.confounding.coOccurringCounts,
    caveat: associationCaveat({
      localControlLimited: association.primaryControlSource === "GLOBAL",
      temporalDriftDetected: association.quality.temporalDriftDetected,
      confoundersFrequent,
    }),
    evidence: insight.evidence.map(toUiEvidence),
    occasions: association.occasions.map((o) => ({
      exposureDate: o.exposureDate,
      outcomeDate: o.outcomeDate,
      value: o.value,
      role: o.role === "SUPPORTING" ? "supporting" : "contradicting",
    })),
    causalityDisclaimer: CAUSALITY_DISCLAIMER,
  };
}

/** Surfaces data-quality reasons already computed for active insights, without re-running any analysis. */
export async function listDataQualityFlags(): Promise<string[]> {
  const insights = await insightRepo.listActiveInsights();
  const reasons = new Set<string>();
  for (const insight of insights) {
    const metadata = insight.metadata as unknown as AssociationInsightMetadata | null;
    if (!metadata) continue;
    for (const reason of metadata.dataQuality.reasons) reasons.add(`${insight.title}: ${reason}`);
  }
  return [...reasons];
}

export async function dismissInsight(id: string): Promise<void> {
  await insightRepo.dismissInsight(id);
}

export interface ExperimentPrefillData {
  title: string;
  hypothesis: string;
  protocol: string;
  durationDays: number;
  outcomes: { label: string; metricType: "BIOMARKER" | "JOURNAL_OBSERVATION" | "SUBJECTIVE_RATING" | "OTHER"; metricReference?: string }[];
}

/**
 * Builds the prefilled (but unsaved) experiment draft for an insight's
 * "Test this" action. The caller must still show this to the user for
 * review and explicit confirmation before persisting — this function never
 * creates an experiment itself.
 */
export function buildExperimentPrefill(detail: InsightDetail): ExperimentPrefillData {
  const exposure = detail.exposureLabel ?? "this exposure";
  const outcomeLabel = detail.outcomeLabel ?? "the outcome metric";
  return {
    title: `Reduce ${exposure.toLowerCase()}`,
    hypothesis: `Avoiding ${exposure.toLowerCase()} may improve ${outcomeLabel}, based on a recorded association (personal confidence: ${detail.confidence.replace("_", " ")}).`,
    protocol: `For 14 days, avoid ${exposure.toLowerCase()} and continue logging sleep, HRV, resting heart rate and morning energy as usual.`,
    durationDays: 14,
    outcomes: [
      { label: "Sleep duration", metricType: "BIOMARKER", metricReference: "sleep_duration" },
      { label: "HRV", metricType: "BIOMARKER", metricReference: "hrv" },
      { label: "Resting heart rate", metricType: "BIOMARKER", metricReference: "resting_hr" },
      { label: "Morning energy", metricType: "SUBJECTIVE_RATING", metricReference: "subjective_energy" },
    ],
  };
}
