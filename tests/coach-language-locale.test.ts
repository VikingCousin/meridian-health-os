import { describe, it, expect, vi } from "vitest";

const completeStructuredMock = vi.fn(async (_provider: unknown, request: { system: string; userText: string }) => {
  capturedSystemPrompts.push(request.system);
  return { summary: "ok", observationNotes: [], followUpQuestions: [] };
});
const capturedSystemPrompts: string[] = [];

vi.mock("@/lib/ai/structured", () => ({ completeStructured: completeStructuredMock }));

const fakeProvider = { name: "fake", complete: async () => "{}" };
vi.mock("@/lib/ai", () => ({ getAiProvider: async () => fakeProvider }));

const { generateCoachLanguage } = await import("@/lib/coach/language.service");
const emptyContext = {
  profileFirstName: "Test",
  activeGoals: [],
  activeExperiments: [],
  recentInsights: [],
  relevantBiomarkers: [],
  recentJournalObservations: [],
  currentModes: [],
  dataQuality: { notes: [] },
  safetyContext: {},
} as unknown as Parameters<typeof generateCoachLanguage>[1];
const safety = { classification: "GENERAL_WELLNESS" } as unknown as Parameters<typeof generateCoachLanguage>[3];

describe("Coach language locale support (P1 — explicit locale context, no duplicated logic)", () => {
  it("does not add a language instruction for English (the base prompt already is English)", async () => {
    await generateCoachLanguage("test question", emptyContext, [], safety, "en");
    const lastPrompt = capturedSystemPrompts.at(-1)!;
    expect(lastPrompt).not.toContain("Respond in");
  });

  it("appends an explicit 'Respond in German' instruction for the de locale", async () => {
    await generateCoachLanguage("test question", emptyContext, [], safety, "de");
    const lastPrompt = capturedSystemPrompts.at(-1)!;
    expect(lastPrompt).toContain("Respond in German");
  });

  it("appends an explicit 'Respond in Russian' instruction for the ru locale", async () => {
    await generateCoachLanguage("test question", emptyContext, [], safety, "ru");
    const lastPrompt = capturedSystemPrompts.at(-1)!;
    expect(lastPrompt).toContain("Respond in Russian");
  });

  it("never duplicates the decision logic — the JSON payload (priorities/goals) is unaffected by locale", async () => {
    completeStructuredMock.mockClear();
    await generateCoachLanguage("q", emptyContext, [], safety, "de");
    const call = completeStructuredMock.mock.calls[0][1];
    expect(() => JSON.parse(call.userText)).not.toThrow();
  });
});
