import { describe, it, expect } from "vitest";
import { pooledStdDev, standardizedMeanDifference, iqrOutlierCount, classifyDayContext } from "@/lib/analytics/stats";

describe("pooledStdDev", () => {
  it("computes the standard pooled SD for two independent groups", () => {
    const groupA = [7, 9, 11, 13, 10];
    const groupB = [20, 20, 21, 19, 20];
    const result = pooledStdDev(groupA, groupB);
    expect(result).not.toBeNull();
    expect(result).toBeGreaterThan(0);
  });

  it("returns null when there are fewer than 2 total degrees of freedom", () => {
    expect(pooledStdDev([5], [])).toBeNull();
    expect(pooledStdDev([5], [6])).toBeNull(); // n1+n2=2 -> 0 degrees of freedom
  });

  it("handles a zero-variance group without throwing", () => {
    const result = pooledStdDev([5, 5, 5], [1, 2, 3]);
    expect(result).not.toBeNull();
    expect(Number.isFinite(result)).toBe(true);
  });
});

describe("standardizedMeanDifference (Cohen's d)", () => {
  it("computes a standard Cohen's d value", () => {
    const d = standardizedMeanDifference(10, 8, 2);
    expect(d).toBe(1);
  });

  it("returns null rather than Infinity when pooled SD is zero", () => {
    const d = standardizedMeanDifference(10, 8, 0);
    expect(d).toBeNull();
    expect(d).not.toBe(Infinity);
  });

  it("returns null when pooled SD itself is null", () => {
    expect(standardizedMeanDifference(10, 8, null)).toBeNull();
  });

  it("returns null when a mean is missing, never NaN", () => {
    const d = standardizedMeanDifference(undefined, 8, 2);
    expect(d).toBeNull();
    expect(Number.isNaN(d)).toBe(false);
  });
});

describe("iqrOutlierCount", () => {
  it("flags values outside the Tukey fences", () => {
    const values = [10, 11, 12, 11, 10, 12, 11, 100]; // 100 is a clear outlier
    expect(iqrOutlierCount(values)).toBeGreaterThanOrEqual(1);
  });

  it("returns 0 for a tight, outlier-free cluster", () => {
    const values = [10, 11, 10, 11, 10, 11, 10];
    expect(iqrOutlierCount(values)).toBe(0);
  });

  it("returns 0 when there are too few points to define quartiles meaningfully", () => {
    expect(iqrOutlierCount([1, 2, 3])).toBe(0);
  });

  it("never excludes anything itself — it only counts", () => {
    const values = [10, 11, 12, 100];
    const before = values.length;
    iqrOutlierCount(values);
    expect(values.length).toBe(before);
  });
});

describe("classifyDayContext", () => {
  it("classifies Friday, Saturday, and Sunday as WEEKEND", () => {
    expect(classifyDayContext(new Date("2026-01-02T00:00:00.000Z"))).toBe("WEEKEND"); // Friday
    expect(classifyDayContext(new Date("2026-01-03T00:00:00.000Z"))).toBe("WEEKEND"); // Saturday
    expect(classifyDayContext(new Date("2026-01-04T00:00:00.000Z"))).toBe("WEEKEND"); // Sunday
  });

  it("classifies Monday through Thursday as WEEKDAY", () => {
    expect(classifyDayContext(new Date("2026-01-05T00:00:00.000Z"))).toBe("WEEKDAY"); // Monday
    expect(classifyDayContext(new Date("2026-01-08T00:00:00.000Z"))).toBe("WEEKDAY"); // Thursday
  });
});
