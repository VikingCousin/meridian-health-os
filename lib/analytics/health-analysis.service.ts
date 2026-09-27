import { normalizePendingObservations } from "@/lib/health-events/normalization.service";
import { ASSOCIATION_REGISTRY } from "@/lib/analytics/association-registry";
import { evaluateAssociation } from "@/lib/analytics/association.service";
import { computeDataQualityFromAssociation } from "@/lib/analytics/data-quality.service";
import { computeConfidence } from "@/lib/analytics/confidence.service";
import { associationSummary, associationTitle } from "@/lib/analytics/language";
import * as insightRepo from "@/lib/db/repositories/insight.repository";
import { fromUiBodySystem } from "@/lib/services/enum-maps";
import type { AssociationResult, ConfidenceResult, DataQualityResult } from "@/lib/analytics/types";
import type { NormalizedEventType, Prisma } from "@/lib/generated/prisma/client";

export interface AssociationInsightMetadata {
  association: AssociationResult;
  confidence: ConfidenceResult;
  dataQuality: DataQualityResult;
}

// Worked examples from the spec: "late meal <-> sleep = Gut + Brain/Recovery",
// "training load <-> recovery = Musculoskeletal + Brain". Anything not listed
// here simply gets no primary system (the insight still renders, just
// without a Body-page link) rather than a guessed mapping.
const EXPOSURE_PRIMARY_SYSTEM: Partial<Record<NormalizedEventType, ReturnType<typeof fromUiBodySystem>>> = {
  LATE_MEAL: fromUiBodySystem("gut"),
  LARGE_MEAL: fromUiBodySystem("gut"),
  ALCOHOL: fromUiBodySystem("liver"),
  CAFFEINE_LATE: fromUiBodySystem("brain"),
  SAUNA: fromUiBodySystem("cardiovascular"),
  COLD_EXPOSURE: fromUiBodySystem("cardiovascular"),
  BREATHWORK: fromUiBodySystem("brain"),
  STRENGTH_TRAINING: fromUiBodySystem("musculoskeletal"),
  ZONE2: fromUiBodySystem("cardiovascular"),
  HIGH_INTENSITY: fromUiBodySystem("musculoskeletal"),
  JUDO: fromUiBodySystem("musculoskeletal"),
  POOR_SLEEP_SUBJECTIVE: fromUiBodySystem("brain"),
};

const METRIC_SYSTEM: Record<string, ReturnType<typeof fromUiBodySystem>> = {
  hrv: fromUiBodySystem("cardiovascular"),
  resting_hr: fromUiBodySystem("cardiovascular"),
  sleep_duration: fromUiBodySystem("brain"),
  sleep_score: fromUiBodySystem("brain"),
  training_load: fromUiBodySystem("musculoskeletal"),
  subjective_energy: fromUiBodySystem("brain"),
};

function fingerprintFor(exposureType: string, outcomeMetricKey: string, lag: string): string {
  return `association:${exposureType}:${outcomeMetricKey}:${lag}`;
}

function levelToStatus(level: ConfidenceResult["level"]): "ACTIVE" | "WATCHING" {
  return level === "EARLY" ? "WATCHING" : "ACTIVE";
}

export interface AnalysisRunSummary {
  candidatesEvaluated: number;
  insightsCreated: number;
  insightsUpdated: number;
  insightsSkippedInsufficientData: number;
  insightsSkippedDismissed: number;
}

/**
 * The orchestrator: normalize events, evaluate every registered association,
 * and create/update the matching HealthInsight + evidence. Manual-trigger
 * only ("Analyze my health data") — there is no background job scheduling
 * this, per the Phase 4 spec.
 */
export async function analyzeHealthData(): Promise<AnalysisRunSummary> {
  await normalizePendingObservations();

  const summary: AnalysisRunSummary = {
    candidatesEvaluated: 0,
    insightsCreated: 0,
    insightsUpdated: 0,
    insightsSkippedInsufficientData: 0,
    insightsSkippedDismissed: 0,
  };

  for (const candidate of ASSOCIATION_REGISTRY) {
    summary.candidatesEvaluated++;
    const association = await evaluateAssociation(candidate);
    const fingerprint = fingerprintFor(candidate.exposureType, candidate.outcomeMetricKey, candidate.lag);

    if (association.status !== "VALID") {
      summary.insightsSkippedInsufficientData++;
      continue;
    }

    const existing = await insightRepo.findInsightByFingerprint(fingerprint);
    if (existing?.status === "DISMISSED") {
      // "Do not silently reactivate a user-dismissed insight" — Phase 4 keeps
      // dismissed insights dismissed, full stop.
      summary.insightsSkippedDismissed++;
      continue;
    }

    const dataQuality = computeDataQualityFromAssociation(association);
    const confidence = computeConfidence(association, dataQuality);

    const occasionDates = association.occasions.map((o) => new Date(o.exposureDate)).sort((a, b) => a.getTime() - b.getTime());
    const firstObservedAt = occasionDates[0];
    const lastObservedAt = occasionDates[occasionDates.length - 1];

    const primarySystem = EXPOSURE_PRIMARY_SYSTEM[candidate.exposureType as NormalizedEventType];
    const metricSystem = METRIC_SYSTEM[candidate.outcomeMetricKey];
    const secondarySystem = metricSystem && metricSystem !== primarySystem ? metricSystem : undefined;

    const metadata: AssociationInsightMetadata = { association, confidence, dataQuality };
    const status = existing && existing.status === "CONFIRMED_BY_USER" ? "CONFIRMED_BY_USER" : levelToStatus(confidence.level);

    const insightData: Prisma.HealthInsightCreateInput = {
      fingerprint,
      type: "ASSOCIATION",
      title: associationTitle(candidate.exposureType, candidate.outcomeMetricKey),
      summary: associationSummary({
        exposureType: candidate.exposureType,
        outcomeMetricKey: candidate.outcomeMetricKey,
        lag: candidate.lag,
        differenceRelativePct: association.effect.relativeDifferencePct,
        localControlLimited: association.primaryControlSource === "GLOBAL",
        temporalDriftDetected: association.quality.temporalDriftDetected,
        confoundersFrequent:
          association.quality.confounding.totalExposureOccasions > 0 &&
          association.quality.confounding.overlapOccasions / association.quality.confounding.totalExposureOccasions >= 0.5,
      }),
      status,
      confidenceLevel: confidence.level,
      confidenceScore: confidence.total,
      primarySystem,
      secondarySystem,
      firstObservedAt,
      lastObservedAt,
      metadata: metadata as unknown as Prisma.InputJsonValue,
    };

    const insight = existing
      ? await insightRepo.updateInsight(existing.id, insightData)
      : await insightRepo.createInsight(insightData);

    if (existing) summary.insightsUpdated++;
    else summary.insightsCreated++;

    const evidence: Omit<Prisma.InsightEvidenceCreateManyInput, "insightId">[] = association.occasions.map((o) => ({
      sourceType: "NORMALIZED_EVENT",
      sourceId: o.exposureEventId,
      role: o.role,
      observedAt: new Date(o.outcomeDate),
      numericValue: o.value,
      metadata: { exposureDate: o.exposureDate },
    }));

    if (association.personalBaseline) {
      evidence.push({
        sourceType: "BIOMARKER_MEASUREMENT",
        sourceId: candidate.outcomeMetricKey,
        role: "BASELINE",
        numericValue: association.personalBaseline.mean,
        metadata: { windowDays: association.personalBaseline.windowDays },
      });
    }
    if (association.globalControl.mean !== undefined) {
      evidence.push({
        sourceType: "BIOMARKER_MEASUREMENT",
        sourceId: candidate.outcomeMetricKey,
        role: "CONTROL",
        numericValue: association.globalControl.mean,
        metadata: { scope: "GLOBAL", n: association.globalControl.n },
      });
    }
    if (association.localControl.mean !== undefined) {
      evidence.push({
        sourceType: "BIOMARKER_MEASUREMENT",
        sourceId: candidate.outcomeMetricKey,
        role: "CONTROL",
        numericValue: association.localControl.mean,
        metadata: {
          scope: "LOCAL",
          n: association.localControl.n,
          windowDays: association.localControl.windowDays,
          matchingStrategy: association.localControl.matchingStrategy,
          status: association.localControl.status,
        },
      });
    }
    for (const co of association.quality.confounding.coOccurringCounts) {
      evidence.push({
        sourceType: "NORMALIZED_EVENT",
        sourceId: co.eventType,
        role: "CONFOUNDING",
        numericValue: co.count,
        metadata: { eventType: co.eventType },
      });
    }

    await insightRepo.replaceEvidence(insight.id, evidence);
  }

  return summary;
}
