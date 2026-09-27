import type { CoachContext, CoachPriorityView, SafetyResult } from "@/lib/coach/types";

// The smallest payload actually needed for the LLM to phrase an explanation
// — see docs/COACH_ARCHITECTURE.md, "Data minimization." Deliberately
// excludes: raw journal text (only category counts survive), medication/
// supplement details (only included when the question is itself about
// personal health context, and only names — never doses), full evidence
// breakdowns, and anything not already surfaced in the top priorities.

export interface MinimizedCoachPayload {
  question: string;
  safetyClassification: SafetyResult["classification"];
  activeGoalTitles: string[];
  activePatternTitles: { title: string; confidence: string }[];
  journalCategoryCounts: Record<string, number>;
  priorities: { tier: string; title: string; why: string; confidence: string; burden: string }[];
  medicationNames?: string[];
  supplementNames?: string[];
}

export function buildMinimizedPayload(question: string, context: CoachContext, priorities: CoachPriorityView[], safety: SafetyResult): MinimizedCoachPayload {
  const journalCategoryCounts: Record<string, number> = {};
  for (const obs of context.recentJournalObservations) {
    journalCategoryCounts[obs.category] = (journalCategoryCounts[obs.category] ?? 0) + 1;
  }

  const includeMedicationContext = safety.classification !== "GENERAL_WELLNESS";

  return {
    question,
    safetyClassification: safety.classification,
    activeGoalTitles: context.activeGoals.map((g) => g.title),
    activePatternTitles: context.recentInsights.map((i) => ({ title: i.title, confidence: i.confidence })),
    journalCategoryCounts,
    priorities: priorities.map((p) => ({ tier: p.tier, title: p.title, why: p.why, confidence: p.confidence, burden: p.burden })),
    ...(includeMedicationContext
      ? { medicationNames: context.safetyContext.medications, supplementNames: context.safetyContext.supplements }
      : {}),
  };
}
