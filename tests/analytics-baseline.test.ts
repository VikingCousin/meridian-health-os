import { describe, it, expect } from "vitest";
import { computeBaseline, MIN_BASELINE_COUNT } from "@/lib/analytics/baseline.service";
import { mean, median, percentile, stdDev, linearRegression } from "@/lib/analytics/stats";

function points(values: number[], startDate: Date): { date: Date; value: number }[] {
  return values.map((value, i) => ({ date: new Date(startDate.getTime() + i * 86_400_000), value }));
}

describe("stats primitives", () => {
  it("computes mean, median, percentiles and stdDev correctly", () => {
    const values = [1, 2, 3, 4, 5];
    expect(mean(values)).toBe(3);
    expect(median(values)).toBe(3);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(percentile(values, 50)).toBe(3);
    expect(stdDev(values)).toBeCloseTo(1.5811, 3);
    expect(stdDev([5])).toBe(0);
  });

  it("fits a simple linear regression", () => {
    const { slope, rSquared } = linearRegression([
      { day: 0, value: 10 },
      { day: 1, value: 12 },
      { day: 2, value: 14 },
      { day: 3, value: 16 },
    ]);
    expect(slope).toBeCloseTo(2, 5);
    expect(rSquared).toBeCloseTo(1, 5);
  });
});

describe("baseline service", () => {
  const asOf = new Date("2026-08-01T00:00:00.000Z");

  it("returns INSUFFICIENT_DATA with a requiredCount below the minimum sample size", () => {
    const series = points([50, 51], new Date("2026-07-30T00:00:00.000Z"));
    const result = computeBaseline(series, 7, asOf);
    expect(result.status).toBe("INSUFFICIENT_DATA");
    expect(result.requiredCount).toBe(MIN_BASELINE_COUNT);
    expect(result.count).toBe(2);
  });

  it("computes mean/median/min/max/stdDev/percentiles for a valid window", () => {
    const series = points([40, 42, 44, 46, 48, 50, 52], new Date("2026-07-26T00:00:00.000Z"));
    const result = computeBaseline(series, 7, asOf);
    expect(result.status).toBe("VALID");
    expect(result.count).toBe(7);
    expect(result.mean).toBe(46);
    expect(result.median).toBe(46);
    expect(result.min).toBe(40);
    expect(result.max).toBe(52);
    expect(result.p25).toBeLessThan(result.median!);
    expect(result.p75).toBeGreaterThan(result.median!);
  });

  it("computes change vs the previous comparable window when enough history exists", () => {
    const previousWindow = points([40, 40, 40, 40, 40, 40, 40], new Date("2026-07-19T00:00:00.000Z"));
    const currentWindow = points([44, 44, 44, 44, 44, 44, 44], new Date("2026-07-26T00:00:00.000Z"));
    const result = computeBaseline([...previousWindow, ...currentWindow], 7, asOf);
    expect(result.status).toBe("VALID");
    expect(result.changeVsPreviousWindowPct).toBeCloseTo(10, 5);
  });

  it("never fabricates a baseline when there is no data at all", () => {
    const result = computeBaseline([], 30, asOf);
    expect(result.status).toBe("INSUFFICIENT_DATA");
    expect(result.mean).toBeUndefined();
  });
});
