import { describe, it, expect } from "vitest";
import { generateCandidates } from "@/lib/coach/candidate-generation.service";
import type { CoachContext } from "@/lib/coach/types";

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

describe("coach candidate generation (deterministic)", () => {
  it("generates a personal-pattern candidate from an active insight with a matching exposure type", () => {
    const context = baseContext({
      recentInsights: [
        {
          id: "insight-1",
          type: "association",
          title: "LATE MEALS ↔ SLEEP DURATION",
          summary: "Your recorded sleep duration has been lower after late meals.",
          status: "active",
          confidence: "moderate_evidence",
          confidenceScore: 60,
          firstObservedAt: "2026-01-01",
          lastObservedAt: "2026-01-01",
          sourceTypes: ["journal", "wearable"],
          exposureType: "LATE_MEAL",
          primaryMetricKey: "sleep_duration",
        },
      ],
    });

    const candidates = generateCandidates(context);
    const match = candidates.find((c) => c.intervention.id === "reduce-late-meals");
    expect(match).toBeDefined();
    expect(match!.reasonType).toBe("personal_pattern");
    expect(match!.linkedInsightIds).toContain("insight-1");
  });

  it("generates a goal-alignment candidate from an active goal category", () => {
    const context = baseContext({
      activeGoals: [{ id: "goal-1", title: "Cardiovascular Health", kind: "supporting", category: "CARDIOVASCULAR", status: "on_track", priority: "MEDIUM" }],
    });

    const candidates = generateCandidates(context);
    const match = candidates.find((c) => c.intervention.id === "zone2-training");
    expect(match).toBeDefined();
    expect(match!.reasonType).toBe("goal_alignment");
    expect(match!.linkedGoalIds).toContain("goal-1");
  });

  it("prefers the personal_pattern reason over goal_alignment when both apply, but keeps both goal links", () => {
    const context = baseContext({
      activeGoals: [{ id: "goal-sleep", title: "Sleep", kind: "supporting", category: "SLEEP", status: "on_track", priority: "MEDIUM" }],
      recentInsights: [
        {
          id: "insight-1",
          type: "association",
          title: "LATE MEALS ↔ SLEEP DURATION",
          summary: "...",
          status: "active",
          confidence: "moderate_evidence",
          confidenceScore: 60,
          firstObservedAt: "2026-01-01",
          lastObservedAt: "2026-01-01",
          sourceTypes: ["journal"],
          exposureType: "LATE_MEAL",
        },
      ],
    });

    const candidates = generateCandidates(context);
    const match = candidates.find((c) => c.intervention.id === "reduce-late-meals")!;
    expect(match.reasonType).toBe("personal_pattern");
    expect(match.linkedGoalIds).toContain("goal-sleep");
  });

  it("does not generate a candidate for an insight with no matching intervention", () => {
    const context = baseContext({
      recentInsights: [
        {
          id: "insight-2",
          type: "association",
          title: "SOME OBSCURE PATTERN",
          summary: "...",
          status: "active",
          confidence: "possible_pattern",
          confidenceScore: 40,
          firstObservedAt: "2026-01-01",
          lastObservedAt: "2026-01-01",
          sourceTypes: ["journal"],
          exposureType: "SUPPLEMENT_STARTED",
        },
      ],
    });
    const candidates = generateCandidates(context);
    expect(candidates).toHaveLength(0);
  });

  it("never duplicates a candidate for the same intervention", () => {
    const context = baseContext({
      activeGoals: [
        { id: "g1", title: "Cardiovascular Health", kind: "supporting", category: "CARDIOVASCULAR", status: "on_track", priority: "MEDIUM" },
        { id: "g2", title: "Aerobic Fitness", kind: "supporting", category: "AEROBIC", status: "on_track", priority: "MEDIUM" },
      ],
    });
    const candidates = generateCandidates(context);
    const zone2Matches = candidates.filter((c) => c.intervention.id === "zone2-training");
    expect(zone2Matches).toHaveLength(1);
    expect(zone2Matches[0].linkedGoalIds.sort()).toEqual(["g1", "g2"]);
  });
});
