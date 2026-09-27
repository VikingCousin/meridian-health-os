import { listActiveInterventions } from "@/lib/coach/intervention-catalog";
import type { CoachContext, InterventionCandidate } from "@/lib/coach/types";
import type { GoalCategory, NormalizedEventType } from "@/lib/generated/prisma/client";

/**
 * Deterministic candidate generation — no LLM involved. Two sources, per
 * docs/COACH_ARCHITECTURE.md:
 *
 * 1. Personal pattern: an active insight's exposure type matches an
 *    intervention's `relevantExposureTypes` (e.g. LATE_MEAL insight ->
 *    "avoid large meals within 3 hours of bed").
 * 2. Goal alignment: an active goal's category matches an intervention's
 *    `supportedGoalCategories` (e.g. a CARDIOVASCULAR goal -> Zone 2 training).
 *
 * A candidate found via a personal pattern keeps that reason even if it also
 * aligns with a goal — personal evidence is the stronger, more specific
 * signal — but goal links accumulate either way, since "why this, why now"
 * should show every relevant goal, not just the first one found.
 */
export function generateCandidates(context: CoachContext): InterventionCandidate[] {
  const candidates = new Map<string, InterventionCandidate>();
  const catalog = listActiveInterventions();

  for (const insight of context.recentInsights) {
    if (!insight.exposureType) continue;
    const matches = catalog.filter((i) => i.relevantExposureTypes.includes(insight.exposureType as NormalizedEventType));
    for (const intervention of matches) {
      const existing = candidates.get(intervention.id);
      candidates.set(intervention.id, {
        intervention,
        reasonType: "personal_pattern",
        reasonText: `Linked to a recorded personal pattern: ${insight.title}`,
        linkedGoalIds: existing?.linkedGoalIds ?? [],
        linkedInsightIds: [...new Set([...(existing?.linkedInsightIds ?? []), insight.id])],
        linkedInsightConfidenceLevel: insight.confidence,
        linkedInsightStatus: insight.status,
      });
    }
  }

  for (const goal of context.activeGoals) {
    const matches = catalog.filter((i) => i.supportedGoalCategories.includes(goal.category as GoalCategory));
    for (const intervention of matches) {
      const existing = candidates.get(intervention.id);
      if (existing) {
        existing.linkedGoalIds = [...new Set([...existing.linkedGoalIds, goal.id])];
        continue;
      }
      candidates.set(intervention.id, {
        intervention,
        reasonType: "goal_alignment",
        reasonText: `Supports your active goal: ${goal.title}`,
        linkedGoalIds: [goal.id],
        linkedInsightIds: [],
      });
    }
  }

  return [...candidates.values()];
}
