import { describe, it, expect } from "vitest";
import { computeTrend, MIN_TREND_SAMPLES, MIN_TREND_SPAN_DAYS } from "@/lib/analytics/trend.service";

function series(values: number[], startDate = new Date("2026-06-01T00:00:00.000Z")): { date: Date; value: number }[] {
  return values.map((value, i) => ({ date: new Date(startDate.getTime() + i * 86_400_000), value }));
}

describe("trend service", () => {
  it("reports INSUFFICIENT_DATA below the minimum sample count", () => {
    const result = computeTrend(series([1, 2, 3]));
    expect(result.status).toBe("INSUFFICIENT_DATA");
    expect(result.direction).toBe("INSUFFICIENT_DATA");
    expect(result.samples).toBe(3);
  });

  it("reports INSUFFICIENT_DATA when samples span too few days", () => {
    // 6 samples but effectively same-day spacing (all within MIN_TREND_SPAN_DAYS).
    const values = Array.from({ length: MIN_TREND_SAMPLES + 1 }, (_, i) => 50 + i);
    const start = new Date("2026-06-01T00:00:00.000Z");
    const cramped = values.map((value, i) => ({ date: new Date(start.getTime() + i * 3600_000), value })); // hourly, not daily
    const result = computeTrend(cramped);
    expect(result.status).toBe("INSUFFICIENT_DATA");
  });

  it("classifies a clear upward trend as INCREASING", () => {
    const values = Array.from({ length: 20 }, (_, i) => 40 + i * 2);
    const result = computeTrend(series(values));
    expect(result.status).toBe("VALID");
    expect(result.direction).toBe("INCREASING");
    expect(result.slopePerDay).toBeGreaterThan(0);
    expect(result.samples).toBe(20);
    expect(result.observationDays).toBeGreaterThanOrEqual(MIN_TREND_SPAN_DAYS);
  });

  it("classifies a clear downward trend as DECREASING", () => {
    const values = Array.from({ length: 20 }, (_, i) => 100 - i * 2);
    const result = computeTrend(series(values));
    expect(result.direction).toBe("DECREASING");
    expect(result.slopePerDay).toBeLessThan(0);
  });

  it("classifies small noise-level fluctuation as STABLE, not a direction", () => {
    const values = [50, 50.5, 49.5, 50.2, 49.8, 50.1, 49.9, 50, 50.3, 49.7, 50, 50.1, 49.9, 50, 50.2, 49.8, 50, 50.1, 49.9, 50];
    const result = computeTrend(series(values));
    expect(result.direction).toBe("STABLE");
  });

  it("does not itself label a direction as good or bad — only reports the direction", () => {
    // A "decreasing" trend for two semantically opposite metrics (creatinine
    // vs VO2max) must come back with the same neutral shape.
    const decreasingCreatinine = computeTrend(series(Array.from({ length: 15 }, (_, i) => 1.1 - i * 0.01)));
    const decreasingVo2max = computeTrend(series(Array.from({ length: 15 }, (_, i) => 50 - i * 0.5)));
    expect(decreasingCreatinine.direction).toBe("DECREASING");
    expect(decreasingVo2max.direction).toBe("DECREASING");
    expect(decreasingCreatinine).not.toHaveProperty("isGood");
  });
});
