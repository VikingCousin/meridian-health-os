import { describe, it, expect } from "vitest";
import { computeConfidence } from "@/lib/analytics/confidence.service";
import { computeDataQuality } from "@/lib/analytics/data-quality.service";
import type { AssociationResult } from "@/lib/analytics/types";

function baseAssociation(overrides: Partial<AssociationResult> = {}): AssociationResult {
  return {
    exposureType: "LATE_MEAL",
    outcomeMetricKey: "sleep_duration",
    lag: "NEXT_NIGHT",
    exposureGroup: { n: 10, mean: 6.2, median: 6.2, stdDev: 0.4 },
    localControl: { n: 20, mean: 7.0, median: 7.0, stdDev: 0.5, windowDays: 14, matchingStrategy: "LOCAL_WINDOW", status: "VALID" },
    globalControl: { n: 50, mean: 7.0, median: 7.0, stdDev: 0.5 },
    primaryControlSource: "LOCAL",
    supportingCount: 8,
    contradictingCount: 2,
    occasions: [],
    effect: { meanDifference: -0.8, medianDifference: -0.8, relativeDifferencePct: -11.4, standardizedDifference: -1.6 },
    quality: {
      missingOutcomeCount: 0,
      outlierCountExposure: 0,
      outlierCountControl: 0,
      temporalDriftDetected: false,
      confounding: { totalExposureOccasions: 10, overlapOccasions: 0, coOccurringCounts: [], note: "No other recorded factors overlapped with these occasions." },
      sourceConfidence: { average: 0.9, lowConfidenceCount: 0 },
    },
    status: "VALID",
    ...overrides,
  };
}

describe("data quality service", () => {
  it("flags INSUFFICIENT when exposure or control counts are too low", () => {
    const result = computeDataQuality({ exposureCount: 1, controlCount: 20 });
    expect(result.status).toBe("INSUFFICIENT");
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("returns GOOD with no reasons for a well-covered comparison", () => {
    const result = computeDataQuality({ exposureCount: 10, controlCount: 50 });
    expect(result.status).toBe("GOOD");
    expect(result.reasons).toHaveLength(0);
  });

  it("returns LIMITED when the control group is thin but not insufficient", () => {
    const result = computeDataQuality({ exposureCount: 10, controlCount: 4 });
    expect(result.status).toBe("LIMITED");
    expect(result.reasons.length).toBeGreaterThan(0);
  });
});

describe("confidence service", () => {
  it("produces a higher score for strong consistency and effect size than for weak ones", () => {
    const strong = computeConfidence(baseAssociation(), computeDataQuality({ exposureCount: 10, controlCount: 50 }));
    const weak = computeConfidence(
      baseAssociation({ exposureGroup: { n: 3, mean: 6.8, median: 6.8, stdDev: 0.4 }, supportingCount: 2, contradictingCount: 1, effect: { ...baseAssociation().effect, standardizedDifference: -0.2 } }),
      computeDataQuality({ exposureCount: 3, controlCount: 50 })
    );
    expect(strong.total).toBeGreaterThan(weak.total);
  });

  it("never exceeds 100 or drops below 0", () => {
    const extreme = computeConfidence(
      baseAssociation({
        exposureGroup: { n: 100, mean: 5, median: 5, stdDev: 0.1 },
        globalControl: { n: 200, mean: 8, median: 8, stdDev: 0.1 },
        effect: { ...baseAssociation().effect, standardizedDifference: 10 },
      }),
      computeDataQuality({ exposureCount: 100, controlCount: 200 })
    );
    expect(extreme.total).toBeLessThanOrEqual(100);
    expect(extreme.total).toBeGreaterThanOrEqual(0);
  });

  it("applies a contradiction penalty and a confounding penalty", () => {
    const clean = computeConfidence(baseAssociation(), computeDataQuality({ exposureCount: 10, controlCount: 50 }));
    const contradicted = computeConfidence(
      baseAssociation({ supportingCount: 5, contradictingCount: 5 }),
      computeDataQuality({ exposureCount: 10, controlCount: 50 })
    );
    const confounded = computeConfidence(
      baseAssociation({
        quality: {
          ...baseAssociation().quality,
          confounding: { totalExposureOccasions: 10, overlapOccasions: 8, coOccurringCounts: [{ eventType: "ALCOHOL", count: 8 }], note: "" },
        },
      }),
      computeDataQuality({ exposureCount: 10, controlCount: 50 })
    );
    expect(contradicted.components.contradictionPenalty).toBeLessThan(0);
    expect(contradicted.total).toBeLessThan(clean.total);
    expect(confounded.components.confoundingPenalty).toBeLessThan(0);
    expect(confounded.total).toBeLessThan(clean.total);
  });

  it("never claims to be a probability — carries the disclaimer", () => {
    const result = computeConfidence(baseAssociation(), computeDataQuality({ exposureCount: 10, controlCount: 50 }));
    expect(result.disclaimer.toLowerCase()).toContain("not a probability");
  });

  it("does not determine level from event count alone — sample count alone cannot produce STRONG confidence", () => {
    const countOnly = computeConfidence(
      baseAssociation({
        exposureGroup: { n: 100, mean: 6.9, median: 6.9, stdDev: 1.5 },
        globalControl: { n: 500, mean: 7.0, median: 7.0, stdDev: 1.5 },
        supportingCount: 50,
        contradictingCount: 50,
        effect: { meanDifference: -0.1, medianDifference: -0.1, relativeDifferencePct: -1.4, standardizedDifference: 0.02 },
      }),
      computeDataQuality({ exposureCount: 100, controlCount: 500 })
    );
    expect(countOnly.level).not.toBe("STRONG");
  });

  it("strong temporal drift lowers confidence", () => {
    const stable = computeConfidence(baseAssociation(), computeDataQuality({ exposureCount: 10, controlCount: 50 }));
    const drifting = computeConfidence(
      baseAssociation({ quality: { ...baseAssociation().quality, temporalDriftDetected: true } }),
      computeDataQuality({ exposureCount: 10, controlCount: 50 })
    );
    expect(drifting.components.temporalDriftPenalty).toBeLessThan(0);
    expect(drifting.total).toBeLessThan(stable.total);
  });

  it("insufficient local control (fallback to global) lowers confidence", () => {
    const local = computeConfidence(baseAssociation(), computeDataQuality({ exposureCount: 10, controlCount: 50 }));
    const fallenBack = computeConfidence(
      baseAssociation({
        primaryControlSource: "GLOBAL",
        localControl: { n: 2, mean: 7.1, median: 7.1, stdDev: 0.3, windowDays: 14, matchingStrategy: "INSUFFICIENT", status: "LIMITED_CONTROL_DATA" },
      }),
      computeDataQuality({ exposureCount: 10, controlCount: 50 })
    );
    expect(fallenBack.components.localControlPenalty).toBeLessThan(0);
    expect(fallenBack.total).toBeLessThan(local.total);
  });

  it("low average source confidence lowers confidence", () => {
    const highConfidence = computeConfidence(baseAssociation(), computeDataQuality({ exposureCount: 10, controlCount: 50 }));
    const lowConfidence = computeConfidence(
      baseAssociation({ quality: { ...baseAssociation().quality, sourceConfidence: { average: 0.3, lowConfidenceCount: 6 } } }),
      computeDataQuality({ exposureCount: 10, controlCount: 50 })
    );
    expect(lowConfidence.components.sourceConfidencePenalty).toBeLessThan(0);
    expect(lowConfidence.total).toBeLessThan(highConfidence.total);
  });

  it("a larger, consistent effect raises confidence", () => {
    const smallEffect = computeConfidence(
      baseAssociation({ effect: { ...baseAssociation().effect, standardizedDifference: -0.1 } }),
      computeDataQuality({ exposureCount: 10, controlCount: 50 })
    );
    const largeEffect = computeConfidence(
      baseAssociation({ effect: { ...baseAssociation().effect, standardizedDifference: -1.8 } }),
      computeDataQuality({ exposureCount: 10, controlCount: 50 })
    );
    expect(largeEffect.components.effectSize).toBeGreaterThan(smallEffect.components.effectSize);
    expect(largeEffect.total).toBeGreaterThan(smallEffect.total);
  });
});
