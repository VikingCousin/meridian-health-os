import { describe, it, expect } from "vitest";
import { compareOutcome, summarizeExperiment } from "@/lib/analytics/experiment-analysis.service";

describe("experiment analysis", () => {
  it("returns INSUFFICIENT_DATA when either period has too few samples", () => {
    const result = compareOutcome("hrv", [50, 51], [55, 56, 57, 58]);
    expect(result.classification).toBe("INSUFFICIENT_DATA");
  });

  it("classifies a favorable directional change (HRV up is favorable)", () => {
    const result = compareOutcome("hrv", [45, 46, 44, 45, 46], [52, 53, 51, 52, 54]);
    expect(result.classification).toBe("DIRECTIONALLY_FAVORABLE");
  });

  it("classifies an unfavorable directional change (resting HR up is unfavorable)", () => {
    const result = compareOutcome("resting_hr", [58, 59, 57, 58], [65, 66, 64, 65]);
    expect(result.classification).toBe("DIRECTIONALLY_UNFAVORABLE");
  });

  it("classifies a small change within noise as NO_CLEAR_CHANGE", () => {
    const result = compareOutcome("hrv", [50, 50.5, 49.5, 50], [50.2, 50.6, 49.8, 50.1]);
    expect(result.classification).toBe("NO_CLEAR_CHANGE");
  });

  it("never labels a comparison SUCCESS or FAILED", () => {
    const result = compareOutcome("hrv", [45, 46, 44], [55, 56, 57]);
    expect(["DIRECTIONALLY_FAVORABLE", "DIRECTIONALLY_UNFAVORABLE", "NO_CLEAR_CHANGE", "INSUFFICIENT_DATA"]).toContain(result.classification);
  });

  it("summarizes mixed outcomes as MIXED", () => {
    const favorable = compareOutcome("hrv", [45, 46, 44], [55, 56, 57]);
    const unfavorable = compareOutcome("resting_hr", [58, 59, 57], [65, 66, 64]);
    expect(summarizeExperiment([favorable, unfavorable])).toBe("MIXED");
  });

  it("summarizes all-insufficient outcomes as INSUFFICIENT_DATA", () => {
    const a = compareOutcome("hrv", [50], [55]);
    const b = compareOutcome("resting_hr", [60], [58]);
    expect(summarizeExperiment([a, b])).toBe("INSUFFICIENT_DATA");
  });
});
