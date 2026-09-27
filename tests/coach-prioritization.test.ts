import { describe, it, expect } from "vitest";
import { scoreCandidates, selectTopPriorities, MAX_ACTIVE_PRIORITIES } from "@/lib/coach/prioritization.service";
import { getInterventionById } from "@/lib/coach/intervention-catalog";
import type { CoachContext, InterventionCandidate } from "@/lib/coach/types";

function baseContext(overrides: Partial<CoachContext> = {}): CoachContext {
  return {
    profileFirstName: "Alex",
    activeGoals: [],
    activeExperiments: [],
    recentInsights: [],
    relevantBiomarkers: [],
    recentJournalObservations: [],
    currentModes: [],
    dataQuality: { overallStatus: "good", notes: [] },
    safetyContext: { medications: [], supplements: [], medicalConditions: [] },
    ...overrides,
  };
}

function candidateFor(interventionId: string, overrides: Partial<InterventionCandidate> = {}): InterventionCandidate {
  return {
    intervention: getInterventionById(interventionId)!,
    reasonType: "goal_alignment",
    reasonText: "test",
    linkedGoalIds: ["g1"],
    linkedInsightIds: [],
    ...overrides,
  };
}

describe("coach prioritization scoring", () => {
  it("returns a transparent, additive breakdown that sums to the total score", () => {
    const context = baseContext();
    const [scored] = scoreCandidates([candidateFor("zone2-training")], context);
    const sum = Object.values(scored.breakdown).reduce((a, b) => a + b, 0);
    expect(scored.totalScore).toBe(Math.max(0, Math.min(100, sum)));
  });

  it("gives a higher personalEvidence score for stronger insight confidence", () => {
    const context = baseContext();
    const low = scoreCandidates([candidateFor("reduce-late-meals", { reasonType: "personal_pattern", linkedInsightConfidenceLevel: "early_observation" })], context)[0];
    const high = scoreCandidates([candidateFor("reduce-late-meals", { reasonType: "personal_pattern", linkedInsightConfidenceLevel: "strong_pattern" })], context)[0];
    expect(high.breakdown.personalEvidence).toBeGreaterThan(low.breakdown.personalEvidence);
    expect(high.totalScore).toBeGreaterThan(low.totalScore);
  });

  it("applies a burden penalty scaled by the intervention's burden level", () => {
    const context = baseContext();
    const [lowBurden] = scoreCandidates([candidateFor("hydration")], context); // LOW burden
    const [highBurden] = scoreCandidates([candidateFor("smoking-cessation-support")], context); // HIGH burden
    expect(highBurden.breakdown.burdenPenalty).toBeLessThan(lowBurden.breakdown.burdenPenalty);
  });

  it("applies a risk penalty scaled by the intervention's risk level", () => {
    const context = baseContext();
    const [lowRisk] = scoreCandidates([candidateFor("hydration")], context); // LOW risk
    const [highRisk] = scoreCandidates([candidateFor("vo2max-intervals")], context); // MEDIUM risk
    expect(highRisk.breakdown.riskPenalty).toBeLessThan(lowRisk.breakdown.riskPenalty);
  });

  it("applies a data-quality penalty when overall data quality is limited or poor", () => {
    const good = scoreCandidates([candidateFor("zone2-training")], baseContext({ dataQuality: { overallStatus: "good", notes: [] } }))[0];
    const poor = scoreCandidates([candidateFor("zone2-training")], baseContext({ dataQuality: { overallStatus: "poor", notes: ["thin data"] } }))[0];
    expect(poor.breakdown.dataQualityPenalty).toBeLessThan(good.breakdown.dataQualityPenalty);
    expect(poor.totalScore).toBeLessThan(good.totalScore);
  });

  it("boosts a candidate whose category is boosted by an active health mode", () => {
    const context = baseContext({ currentModes: [{ id: "m1", title: "Competition prep", type: "COMPETITION_PREP", boostCategories: ["RECOVERY"], suppressCategories: [] }] });
    const noMode = scoreCandidates([candidateFor("sauna-sessions")], baseContext())[0]; // RECOVERY category
    const withMode = scoreCandidates([candidateFor("sauna-sessions")], context)[0];
    expect(withMode.breakdown.modeModifier).toBeGreaterThan(noMode.breakdown.modeModifier);
    expect(withMode.totalScore).toBeGreaterThan(noMode.totalScore);
  });

  it("suppresses a candidate whose category is suppressed by an active health mode", () => {
    const context = baseContext({ currentModes: [{ id: "m1", title: "Competition prep", type: "COMPETITION_PREP", boostCategories: [], suppressCategories: ["STRENGTH"] }] });
    const [scored] = scoreCandidates([candidateFor("strength-training")], context);
    expect(scored.breakdown.modeModifier).toBeLessThan(0);
  });

  it("penalizes a candidate that conflicts with an active illness-recovery mode", () => {
    const context = baseContext({ currentModes: [{ id: "m1", title: "Illness recovery", type: "ILLNESS_RECOVERY", boostCategories: [], suppressCategories: [] }] });
    const candidates = [candidateFor("vo2max-intervals"), candidateFor("hydration")];
    const scored = scoreCandidates(candidates, context);
    const vo2 = scored.find((s) => s.candidate.intervention.id === "vo2max-intervals")!;
    expect(vo2.breakdown.conflictPenalty).toBeLessThan(0);
    expect(vo2.cautions.length).toBeGreaterThan(0);
  });

  it("penalizes cold exposure when paired with strength training in the same candidate set (adaptation conflict)", () => {
    const context = baseContext();
    const candidates = [candidateFor("cold-exposure"), candidateFor("strength-training")];
    const scored = scoreCandidates(candidates, context);
    const cold = scored.find((s) => s.candidate.intervention.id === "cold-exposure")!;
    expect(cold.breakdown.conflictPenalty).toBeLessThan(0);
  });

  it(`never selects more than ${MAX_ACTIVE_PRIORITIES} priorities, even with many candidates`, () => {
    const context = baseContext();
    const candidates = ["zone2-training", "strength-training", "hydration", "sauna-sessions", "breathwork", "fiber-intake"].map((id) => candidateFor(id));
    const scored = scoreCandidates(candidates, context);
    const top = selectTopPriorities(scored);
    expect(top.length).toBeLessThanOrEqual(MAX_ACTIVE_PRIORITIES);
  });

  it("selects strictly the highest-scoring candidates, in descending order", () => {
    const context = baseContext();
    const candidates = ["zone2-training", "strength-training", "hydration"].map((id) => candidateFor(id));
    const scored = scoreCandidates(candidates, context);
    const top = selectTopPriorities(scored);
    for (let i = 1; i < top.length; i++) {
      expect(top[i - 1].totalScore).toBeGreaterThanOrEqual(top[i].totalScore);
    }
  });
});
