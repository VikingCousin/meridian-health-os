import { detectConflicts } from "@/lib/coach/conflict.service";
import type { CoachContext, InterventionCandidate, PriorityScoreBreakdown, PriorityTier, ScoredCandidate } from "@/lib/coach/types";

/** Meridian never overwhelms the user with a long list — see docs/COACH_ARCHITECTURE.md, "Limit active priorities." */
export const MAX_ACTIVE_PRIORITIES = 3;

const CONFIDENCE_EVIDENCE_POINTS: Record<string, number> = {
  early_observation: 5,
  possible_pattern: 10,
  moderate_evidence: 15,
  strong_pattern: 20,
};

const EVIDENCE_LEVEL_IMPACT: Record<string, number> = {
  ESTABLISHED: 20,
  MODERATE: 14,
  EMERGING: 8,
  PERSONAL_EXPERIMENT: 5,
  UNKNOWN: 2,
};

const BURDEN_PENALTY: Record<string, number> = { LOW: 0, MEDIUM: -5, HIGH: -10 };
const RISK_PENALTY: Record<string, number> = { LOW: 0, MEDIUM: -5, HIGH: -12 };

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Deterministic, transparent scoring — NEVER delegated to the LLM (see
 * docs/COACH_ARCHITECTURE.md, "Prioritization engine"). This is a product
 * priority score: it says what's most worth this app's and this user's
 * attention right now, not a measure of medical probability or clinical
 * efficacy.
 */
export function scoreCandidates(candidates: InterventionCandidate[], context: CoachContext): ScoredCandidate[] {
  const conflicts = detectConflicts(candidates, context);
  const conflictsByIntervention = new Map<string, { penalty: number; cautions: string[] }>();
  for (const finding of conflicts) {
    const existing = conflictsByIntervention.get(finding.interventionId) ?? { penalty: 0, cautions: [] };
    existing.penalty += finding.penalty;
    existing.cautions.push(finding.caution);
    conflictsByIntervention.set(finding.interventionId, existing);
  }

  return candidates.map((candidate) => {
    const { intervention } = candidate;

    const goalAlignment = clamp(candidate.linkedGoalIds.length * 8, 0, 20);
    const personalEvidence = candidate.reasonType === "personal_pattern" ? (CONFIDENCE_EVIDENCE_POINTS[candidate.linkedInsightConfidenceLevel ?? ""] ?? 0) : 0;
    const expectedImpact = EVIDENCE_LEVEL_IMPACT[intervention.evidenceLevel] ?? 0;
    const measurementClarity = clamp(intervention.measurementOptions.length * 5, 0, 15);
    const burdenPenalty = BURDEN_PENALTY[intervention.burden] ?? 0;
    const riskPenalty = RISK_PENALTY[intervention.riskLevel] ?? 0;

    const conflict = conflictsByIntervention.get(intervention.id);
    const conflictPenalty = conflict?.penalty ?? 0;

    let modeModifier = 0;
    for (const mode of context.currentModes) {
      if (mode.boostCategories.includes(intervention.category)) modeModifier += 8;
      if (mode.suppressCategories.includes(intervention.category)) modeModifier -= 8;
    }

    const alreadyTracked = intervention.measurementOptions.length > 0 && context.activeExperiments.some((exp) => intervention.measurementOptions.every((m) => exp.trackedMetrics.some((t) => t.toLowerCase().includes(m.replace(/_/g, " ")))));
    const recentExperimentPenalty = alreadyTracked ? -10 : 0;

    const dataQualityPenalty = context.dataQuality.overallStatus === "poor" ? -8 : context.dataQuality.overallStatus === "limited" ? -3 : 0;

    const breakdown: PriorityScoreBreakdown = {
      goalAlignment,
      personalEvidence,
      expectedImpact,
      measurementClarity,
      burdenPenalty,
      riskPenalty,
      conflictPenalty,
      modeModifier,
      recentExperimentPenalty,
      dataQualityPenalty,
    };

    const totalScore = clamp(
      goalAlignment + personalEvidence + expectedImpact + measurementClarity + burdenPenalty + riskPenalty + conflictPenalty + modeModifier + recentExperimentPenalty + dataQualityPenalty,
      0,
      100
    );

    return { candidate, totalScore, breakdown, cautions: conflict?.cautions ?? [] };
  });
}

export function tierFor(index: number): PriorityTier {
  return index === 0 ? "primary" : index === 1 ? "secondary" : "optional";
}

/** Sorts by score and caps at MAX_ACTIVE_PRIORITIES — Meridian shows 1 primary, 1 secondary, 1 optional, never a long list. */
export function selectTopPriorities(scored: ScoredCandidate[]): ScoredCandidate[] {
  return [...scored].sort((a, b) => b.totalScore - a.totalScore).slice(0, MAX_ACTIVE_PRIORITIES);
}
