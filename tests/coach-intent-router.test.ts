import { describe, it, expect } from "vitest";
import { classifyIntent } from "@/lib/coach/intent-router.service";

describe("coach intent router (deterministic, no LLM)", () => {
  it("classifies weekly-focus questions", () => {
    expect(classifyIntent("What should I focus on this week?").intent).toBe("weekly_focus");
    expect(classifyIntent("What are my biggest priorities?").intent).toBe("weekly_focus");
  });

  it("classifies metric-explanation questions and extracts the metric phrase", () => {
    const result = classifyIntent("Explain my ApoB trend");
    expect(result.intent).toBe("explain_metric");
    expect(result.metricPhrase).toBe("apob");
  });

  it("classifies recovery questions", () => {
    expect(classifyIntent("Why has my recovery been worse?").intent).toBe("explain_recovery");
  });

  it("classifies goal-progress questions", () => {
    expect(classifyIntent("How am I progressing toward my goals?").intent).toBe("goal_progress");
  });

  it("classifies pattern questions", () => {
    expect(classifyIntent("What patterns are affecting my sleep?").intent).toBe("pattern_question");
  });

  it("classifies experiment-suggestion questions", () => {
    expect(classifyIntent("What should I test next?").intent).toBe("experiment_suggestion");
  });

  it("falls back to general for anything unrecognized", () => {
    expect(classifyIntent("Tell me a joke").intent).toBe("general");
  });
});
