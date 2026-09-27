import { describe, it, expect, vi, afterEach } from "vitest";
import type { CoachContext, CoachPriorityView, SafetyResult } from "@/lib/coach/types";

const baseContext: CoachContext = {
  profileFirstName: "Alex",
  activeGoals: [],
  activeExperiments: [],
  recentInsights: [],
  relevantBiomarkers: [],
  recentJournalObservations: [],
  currentModes: [],
  dataQuality: { overallStatus: "good", notes: [] },
  safetyContext: { medications: [], supplements: [], medicalConditions: [] },
};

const priorities: CoachPriorityView[] = [
  {
    interventionId: "reduce-late-meals",
    title: "Avoid large meals within 3 hours of bed",
    tier: "primary",
    score: 70,
    breakdown: { goalAlignment: 8, personalEvidence: 15, expectedImpact: 14, measurementClarity: 10, burdenPenalty: -5, riskPenalty: 0, conflictPenalty: 0, modeModifier: 0, recentExperimentPenalty: 0, dataQualityPenalty: 0 },
    why: "Linked to a recorded personal pattern",
    linkedGoalIds: [],
    linkedInsightIds: [],
    linkedMetricKeys: ["sleep_duration"],
    confidence: "moderate",
    burden: "MEDIUM",
    cautions: [],
    evidenceLevel: "MODERATE",
    requiresMedicalReview: false,
  },
];

const generalSafety: SafetyResult = { classification: "GENERAL_WELLNESS", reasons: [] };

describe("coach language generation — fallback and AI validation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("falls back to a deterministic template when no AI provider is configured", async () => {
    vi.doMock("@/lib/ai", () => ({ getAiProvider: () => null }));
    const { generateCoachLanguage } = await import("@/lib/coach/language.service");

    const result = await generateCoachLanguage("What should I focus on this week?", baseContext, priorities, generalSafety);

    expect(result.aiGenerated).toBe(false);
    expect(result.output.summary.toLowerCase()).toContain("avoid large meals within 3 hours of bed");
  });

  it("falls back to the deterministic template when the provider throws", async () => {
    vi.doMock("@/lib/ai", () => ({
      getAiProvider: () => ({
        name: "fake",
        complete: async () => {
          throw new Error("simulated outage");
        },
      }),
    }));
    const { generateCoachLanguage } = await import("@/lib/coach/language.service");

    const result = await generateCoachLanguage("What should I focus on?", baseContext, priorities, generalSafety);
    expect(result.aiGenerated).toBe(false);
  });

  it("falls back to the deterministic template when the provider returns invalid JSON", async () => {
    vi.doMock("@/lib/ai", () => ({
      getAiProvider: () => ({ name: "fake", complete: async () => "not json at all" }),
    }));
    const { generateCoachLanguage } = await import("@/lib/coach/language.service");

    const result = await generateCoachLanguage("What should I focus on?", baseContext, priorities, generalSafety);
    expect(result.aiGenerated).toBe(false);
  });

  it("falls back when the provider's JSON doesn't match the coach language schema", async () => {
    vi.doMock("@/lib/ai", () => ({
      getAiProvider: () => ({ name: "fake", complete: async () => JSON.stringify({ wrongField: true }) }),
    }));
    const { generateCoachLanguage } = await import("@/lib/coach/language.service");

    const result = await generateCoachLanguage("What should I focus on?", baseContext, priorities, generalSafety);
    expect(result.aiGenerated).toBe(false);
  });

  it("uses the AI-generated output when the provider returns a valid, schema-matching response", async () => {
    vi.doMock("@/lib/ai", () => ({
      getAiProvider: () => ({
        name: "fake",
        complete: async () => JSON.stringify({ summary: "Focus on your late meals this week.", observationNotes: ["Sleep has been shorter after late meals."], followUpQuestions: ["What else affects my sleep?"] }),
      }),
    }));
    const { generateCoachLanguage } = await import("@/lib/coach/language.service");

    const result = await generateCoachLanguage("What should I focus on?", baseContext, priorities, generalSafety);
    expect(result.aiGenerated).toBe(true);
    expect(result.output.summary).toBe("Focus on your late meals this week.");
  });

  it("never lets the AI introduce a priority that isn't in the given list — schema has no field for it", async () => {
    const { coachLanguageSchema } = await import("@/lib/validation/coach");
    const attemptedInjection = { summary: "ok", observationNotes: [], followUpQuestions: [], priorities: [{ title: "Invented priority" }] };
    const parsed = coachLanguageSchema.parse(attemptedInjection);
    expect(parsed).not.toHaveProperty("priorities");
  });
});
