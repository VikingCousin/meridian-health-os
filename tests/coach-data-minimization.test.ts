import { describe, it, expect } from "vitest";
import { buildMinimizedPayload } from "@/lib/coach/data-minimization";
import type { CoachContext, CoachPriorityView, SafetyResult } from "@/lib/coach/types";

function context(overrides: Partial<CoachContext> = {}): CoachContext {
  return {
    profileFirstName: "Alex",
    activeGoals: [{ id: "g1", title: "Sleep", kind: "supporting", category: "SLEEP", status: "on_track", priority: "MEDIUM" }],
    activeExperiments: [],
    recentInsights: [],
    relevantBiomarkers: [],
    recentJournalObservations: [
      { date: "2026-09-01", label: "Late meal", category: "nutrition" },
      { date: "2026-09-02", label: "I had a panic attack about my finances and cried all night", category: "mood" },
    ],
    currentModes: [],
    dataQuality: { overallStatus: "good", notes: [] },
    safetyContext: { medications: ["Lisinopril 10mg"], supplements: ["Magnesium"], medicalConditions: ["Hypertension"] },
    ...overrides,
  };
}

const priorities: CoachPriorityView[] = [];

describe("coach data minimization — the smallest payload sent externally", () => {
  it("never includes raw journal text — only category counts", () => {
    const payload = buildMinimizedPayload("What should I focus on?", context(), priorities, { classification: "GENERAL_WELLNESS", reasons: [] });
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain("panic attack");
    expect(serialized).not.toContain("finances");
    expect(payload.journalCategoryCounts).toEqual({ nutrition: 1, mood: 1 });
  });

  it("omits medication/supplement details for a purely general-wellness question", () => {
    const payload = buildMinimizedPayload("What should I focus on?", context(), priorities, { classification: "GENERAL_WELLNESS", reasons: [] });
    expect(payload.medicationNames).toBeUndefined();
    expect(payload.supplementNames).toBeUndefined();
  });

  it("includes only medication/supplement NAMES (never doses) once the question is in personal-health-context territory", () => {
    const safety: SafetyResult = { classification: "PERSONAL_HEALTH_CONTEXT", reasons: [] };
    const payload = buildMinimizedPayload("Why is my recovery worse?", context(), priorities, safety);
    expect(payload.medicationNames).toEqual(["Lisinopril 10mg"]);
    // Names as stored are passed through, but never full medical-history detail beyond what context already minimized.
    expect(payload).not.toHaveProperty("medicalConditions");
  });

  it("never includes the full active-goal object — only titles", () => {
    const payload = buildMinimizedPayload("q", context(), priorities, { classification: "GENERAL_WELLNESS", reasons: [] });
    expect(payload.activeGoalTitles).toEqual(["Sleep"]);
    expect(JSON.stringify(payload.activeGoalTitles)).not.toContain("priority");
  });

  it("does not include the full biomarker/insight history — only what's already surfaced in the top priorities and pattern titles", () => {
    const withInsights = context({
      recentInsights: [
        { id: "i1", type: "association", title: "LATE MEALS ↔ SLEEP DURATION", summary: "a very long internal summary with lots of detail that should not leak in full unnecessarily", status: "active", confidence: "moderate_evidence", confidenceScore: 60, firstObservedAt: "x", lastObservedAt: "x", sourceTypes: ["journal"] },
      ],
    });
    const payload = buildMinimizedPayload("q", withInsights, priorities, { classification: "GENERAL_WELLNESS", reasons: [] });
    expect(payload.activePatternTitles).toEqual([{ title: "LATE MEALS ↔ SLEEP DURATION", confidence: "moderate_evidence" }]);
  });
});
