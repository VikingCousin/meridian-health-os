import { describe, it, expect } from "vitest";
import { computeAssociation, MIN_GROUP_SIZE, MIN_LOCAL_CONTROL } from "@/lib/analytics/association.service";
import { resolveLagDayOffset } from "@/lib/analytics/lag";

function day(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

/** Builds a flat baseline series of `value` for every day in [start, end], inclusive. */
function flatSeries(start: string, end: string, value: number): { date: Date; value: number }[] {
  const points: { date: Date; value: number }[] = [];
  let d = day(start);
  const endDate = day(end);
  while (d <= endDate) {
    points.push({ date: new Date(d), value });
    d = new Date(d.getTime() + 86_400_000);
  }
  return points;
}

describe("lag resolution", () => {
  it("resolves same-day lag to 0 and 48h lag to 2", () => {
    expect(resolveLagDayOffset("SAME_DAY")).toBe(0);
    expect(resolveLagDayOffset("NEXT_48H")).toBe(2);
  });

  it("resolves SAME_NIGHT/NEXT_MORNING/NEXT_NIGHT/NEXT_DAY/NEXT_24H to the same 1-day offset", () => {
    for (const lag of ["SAME_NIGHT", "NEXT_MORNING", "NEXT_NIGHT", "NEXT_DAY", "NEXT_24H"] as const) {
      expect(resolveLagDayOffset(lag)).toBe(1);
    }
  });
});

describe("association service — group formation", () => {
  it("flags INSUFFICIENT_DATA when there are too few exposure occasions", () => {
    const outcomeSeries = flatSeries("2026-01-01", "2026-03-01", 50);
    const result = computeAssociation({
      exposureType: "LATE_MEAL",
      outcomeMetricKey: "sleep_duration",
      lag: "NEXT_NIGHT",
      exposures: [{ id: "e1", date: day("2026-01-10") }],
      outcomeSeries,
    });
    expect(result.status).toBe("INSUFFICIENT_DATA");
    expect(result.reasons?.some((r) => r.includes("exposure occasion"))).toBe(true);
  });

  it("flags INSUFFICIENT_DATA when outcome data is missing for the exposure occasions", () => {
    const outcomeSeries = flatSeries("2026-06-01", "2026-06-30", 50);
    const result = computeAssociation({
      exposureType: "LATE_MEAL",
      outcomeMetricKey: "sleep_duration",
      lag: "NEXT_DAY",
      exposures: [
        { id: "e1", date: day("2026-01-01") },
        { id: "e2", date: day("2026-01-02") },
        { id: "e3", date: day("2026-01-03") },
      ],
      outcomeSeries,
    });
    expect(result.status).toBe("INSUFFICIENT_DATA");
    expect(result.exposureGroup.n).toBe(0);
    expect(result.quality.missingOutcomeCount).toBe(3);
  });

  it("computes exposure vs. global-control groups with a clear same-day effect", () => {
    const outcomeSeries = flatSeries("2026-01-01", "2026-03-01", 60);
    const exposureDates = ["2026-01-05", "2026-01-10", "2026-01-15", "2026-01-20"];
    for (const d of exposureDates) {
      const point = outcomeSeries.find((p) => p.date.getTime() === day(d).getTime());
      if (point) point.value = 40;
    }

    const result = computeAssociation({
      exposureType: "ALCOHOL",
      outcomeMetricKey: "hrv",
      lag: "SAME_DAY",
      exposures: exposureDates.map((d, i) => ({ id: `e${i}`, date: day(d) })),
      outcomeSeries,
    });

    expect(result.status).toBe("VALID");
    expect(result.exposureGroup.n).toBe(4);
    expect(result.exposureGroup.mean).toBe(40);
    expect(result.globalControl.mean).toBeCloseTo(60, 1);
    expect(result.effect.meanDifference).toBeCloseTo(-20, 1);
    expect(result.supportingCount).toBe(4);
    expect(result.contradictingCount).toBe(0);
  });

  it("records both supporting and contradicting occasions rather than only supporting ones", () => {
    const outcomeSeries = flatSeries("2026-01-01", "2026-03-01", 60);
    const exposureDates = ["2026-01-05", "2026-01-10", "2026-01-15", "2026-01-20"];
    const outcomeDates = exposureDates.map((d) => new Date(day(d).getTime() + 86_400_000));
    outcomeDates.slice(0, 3).forEach((d) => {
      const point = outcomeSeries.find((p) => p.date.getTime() === d.getTime());
      if (point) point.value = 40;
    });

    const result = computeAssociation({
      exposureType: "LATE_MEAL",
      outcomeMetricKey: "sleep_duration",
      lag: "NEXT_DAY",
      exposures: exposureDates.map((d, i) => ({ id: `e${i}`, date: day(d) })),
      outcomeSeries,
    });

    expect(result.supportingCount).toBe(3);
    expect(result.contradictingCount).toBe(1);
    expect(result.occasions).toHaveLength(4);
    expect(result.occasions.filter((o) => o.role === "CONTRADICTING")).toHaveLength(1);
  });

  it(`requires at least ${MIN_GROUP_SIZE} global control days`, () => {
    const outcomeSeries = [
      { date: day("2026-01-01"), value: 50 },
      { date: day("2026-01-02"), value: 50 },
    ];
    const result = computeAssociation({
      exposureType: "SAUNA",
      outcomeMetricKey: "hrv",
      lag: "SAME_DAY",
      exposures: [{ id: "e1", date: day("2026-01-01") }],
      outcomeSeries,
    });
    expect(result.status).toBe("INSUFFICIENT_DATA");
  });
});

describe("association service — local vs. global control", () => {
  it("excludes every occurrence of the same exposure type from both control groups, not just paired ones", () => {
    const outcomeSeries = flatSeries("2026-01-01", "2026-03-01", 60);
    // Give three exposures matching outcome data, and a fourth with none — the
    // fourth's outcome-equivalent day must still be excluded from control.
    const paired = ["2026-01-05", "2026-01-10", "2026-01-15"];
    const unpaired = "2026-01-25"; // its +1 day outcome slot is deliberately removed from the series below
    const outcomeDates = paired.map((d) => new Date(day(d).getTime() + 86_400_000));
    outcomeDates.forEach((d) => {
      const point = outcomeSeries.find((p) => p.date.getTime() === d.getTime());
      if (point) point.value = 40;
    });
    const unpairedOutcomeKey = new Date(day(unpaired).getTime() + 86_400_000).toISOString().slice(0, 10);
    const filteredSeries = outcomeSeries.filter((p) => p.date.toISOString().slice(0, 10) !== unpairedOutcomeKey);

    const result = computeAssociation({
      exposureType: "LATE_MEAL",
      outcomeMetricKey: "sleep_duration",
      lag: "NEXT_DAY",
      exposures: [...paired, unpaired].map((d, i) => ({ id: `e${i}`, date: day(d) })),
      outcomeSeries: filteredSeries,
    });

    expect(result.exposureGroup.n).toBe(3);
    expect(result.quality.missingOutcomeCount).toBe(1);
    // The global control count must exclude every exposure date AND every
    // outcome-equivalent date (60 days - 1 removed day - 4 exposure dates -
    // 3 present outcome dates [the 4th was already removed] = 52).
    expect(result.globalControl.n).toBe(52);
  });

  it("selects a local control window around each exposure occasion, not the whole series", () => {
    const outcomeSeries = flatSeries("2026-01-01", "2026-06-30", 60);
    // A late-June exposure with a very different long-range baseline should
    // still be compared fairly if local days are flat — but here we deflate
    // far-away days to prove the LOCAL window (not the whole series) is used.
    for (const p of outcomeSeries) {
      if (p.date < day("2026-05-01")) p.value = 30; // far from the exposure occasions below, must not pollute the local window
    }
    const exposureDates = ["2026-06-05", "2026-06-10", "2026-06-15", "2026-06-20", "2026-06-25"];
    const outcomeDates = exposureDates.map((d) => new Date(day(d).getTime() + 86_400_000));
    outcomeDates.forEach((d) => {
      const point = outcomeSeries.find((p) => p.date.getTime() === d.getTime());
      if (point) point.value = 40;
    });

    const result = computeAssociation({
      exposureType: "ALCOHOL",
      outcomeMetricKey: "hrv",
      lag: "NEXT_MORNING",
      exposures: exposureDates.map((d, i) => ({ id: `e${i}`, date: day(d) })),
      outcomeSeries,
      localWindowDays: 14,
    });

    expect(result.localControl.status).toBe("VALID");
    // Local control should stay close to 60 (the nearby, undeflated days),
    // not be dragged toward 30 by the far-away deflated portion of the series.
    expect(result.localControl.mean).toBeGreaterThan(55);
    expect(result.primaryControlSource).toBe("LOCAL");
  });

  it(`reports LIMITED_CONTROL_DATA with fewer than ${MIN_LOCAL_CONTROL} local control points, and falls back to global control`, () => {
    const outcomeSeries = [
      ...flatSeries("2026-01-01", "2026-01-04", 61), // 4 lonely nearby days — below MIN_LOCAL_CONTROL
      { date: day("2026-01-05"), value: 60 },
      { date: day("2026-01-06"), value: 40 },
      { date: day("2026-01-10"), value: 60 },
      { date: day("2026-01-11"), value: 40 },
      { date: day("2026-01-15"), value: 60 },
      { date: day("2026-01-16"), value: 40 },
      ...flatSeries("2026-04-01", "2026-05-01", 62), // plentiful global control, far from the exposures
    ];

    const result = computeAssociation({
      exposureType: "SAUNA",
      outcomeMetricKey: "hrv",
      lag: "NEXT_MORNING",
      exposures: [
        { id: "e1", date: day("2026-01-05") },
        { id: "e2", date: day("2026-01-10") },
        { id: "e3", date: day("2026-01-15") },
      ],
      outcomeSeries,
      localWindowDays: 14,
    });

    expect(result.status).toBe("VALID");
    expect(result.localControl.status).toBe("LIMITED_CONTROL_DATA");
    expect(result.localControl.n).toBeLessThan(MIN_LOCAL_CONTROL);
    expect(result.primaryControlSource).toBe("GLOBAL");
  });

  it("prefers day-context (weekday/weekend) matched local control when enough exists", () => {
    // 2026-01-02, -09, -16 are Fridays (UTC) — classified WEEKEND by
    // classifyDayContext(). Build a series where WEEKEND-context days sit at
    // one value and WEEKDAY-context days sit at another, so the
    // context-matched pool is clearly distinguishable from the mixed pool.
    const outcomeSeries: { date: Date; value: number }[] = [];
    for (let i = -20; i <= 40; i++) {
      const date = new Date(day("2026-01-02").getTime() + i * 86_400_000);
      const dow = date.getUTCDay();
      const isWeekendLike = dow === 0 || dow === 5 || dow === 6;
      outcomeSeries.push({ date, value: isWeekendLike ? 65 : 55 });
    }
    const exposureDates = ["2026-01-02", "2026-01-09", "2026-01-16"];
    // The exposure (Friday) nights themselves show a depressed effect.
    for (const d of exposureDates) {
      const point = outcomeSeries.find((p) => p.date.getTime() === day(d).getTime());
      if (point) point.value = 40;
    }

    const result = computeAssociation({
      exposureType: "ALCOHOL",
      outcomeMetricKey: "hrv",
      lag: "SAME_DAY",
      exposures: exposureDates.map((d, i) => ({ id: `e${i}`, date: day(d) })),
      outcomeSeries,
      localWindowDays: 20,
    });

    expect(result.status).toBe("VALID");
    expect(result.localControl.matchingStrategy).toBe("DAY_CONTEXT_LOCAL");
    // The context-matched (weekend-like) local control should sit near 65,
    // not be dragged down toward the 55 weekday value mixed into the full window.
    expect(result.localControl.mean).toBeGreaterThan(60);
  });
});

describe("association service — effect size, outliers, temporal drift", () => {
  it("computes a pooled-SD standardized difference (Cohen's d) rather than using only control spread", () => {
    const outcomeSeries = flatSeries("2026-01-01", "2026-03-01", 60);
    const exposureDates = ["2026-01-05", "2026-01-10", "2026-01-15", "2026-01-20", "2026-01-25"];
    const outcomeDates = exposureDates.map((d) => new Date(day(d).getTime() + 86_400_000));
    outcomeDates.forEach((d, i) => {
      const point = outcomeSeries.find((p) => p.date.getTime() === d.getTime());
      if (point) point.value = 40 + i; // some spread within the exposure group itself
    });

    const result = computeAssociation({
      exposureType: "LATE_MEAL",
      outcomeMetricKey: "sleep_duration",
      lag: "NEXT_DAY",
      exposures: exposureDates.map((d, i) => ({ id: `e${i}`, date: day(d) })),
      outcomeSeries,
    });

    expect(result.effect.standardizedDifference).not.toBeNull();
    expect(result.effect.standardizedDifference).toBeLessThan(0);
  });

  it("returns null (never NaN/Infinity) for standardizedDifference when pooled SD is zero", () => {
    const outcomeSeries = flatSeries("2026-01-01", "2026-03-01", 60);
    const exposureDates = ["2026-01-05", "2026-01-10", "2026-01-15"];
    outcomeDatesSetTo(outcomeSeries, exposureDates, 1, 40);

    const result = computeAssociation({
      exposureType: "LATE_MEAL",
      outcomeMetricKey: "sleep_duration",
      lag: "NEXT_DAY",
      exposures: exposureDates.map((d, i) => ({ id: `e${i}`, date: day(d) })),
      outcomeSeries,
    });

    // Exposure values are all exactly 40 (zero variance) and control values
    // are all exactly 60 (zero variance) -> pooled SD is 0 -> null, not Infinity/NaN.
    expect(result.effect.standardizedDifference).toBeNull();
    expect(Number.isNaN(result.effect.standardizedDifference)).toBe(false);
  });

  it("computes a median difference alongside the mean difference", () => {
    const outcomeSeries = flatSeries("2026-01-01", "2026-03-01", 60);
    const exposureDates = ["2026-01-05", "2026-01-10", "2026-01-15", "2026-01-20", "2026-01-25"];
    outcomeDatesSetTo(outcomeSeries, exposureDates, 1, 40);

    const result = computeAssociation({
      exposureType: "LATE_MEAL",
      outcomeMetricKey: "sleep_duration",
      lag: "NEXT_DAY",
      exposures: exposureDates.map((d, i) => ({ id: `e${i}`, date: day(d) })),
      outcomeSeries,
    });

    expect(result.effect.medianDifference).toBeCloseTo(-20, 1);
  });

  it("flags outliers via IQR without excluding them from the reported groups", () => {
    const outcomeSeries = flatSeries("2026-01-01", "2026-03-01", 60);
    const exposureDates = ["2026-01-05", "2026-01-10", "2026-01-15", "2026-01-20", "2026-01-25", "2026-01-30"];
    outcomeDatesSetTo(outcomeSeries, exposureDates, 1, 40);
    // Make one exposure occasion an extreme outlier relative to the rest of the exposure group.
    const extremeDate = new Date(day("2026-01-30").getTime() + 86_400_000);
    const extremePoint = outcomeSeries.find((p) => p.date.getTime() === extremeDate.getTime());
    if (extremePoint) extremePoint.value = 5;

    const result = computeAssociation({
      exposureType: "LATE_MEAL",
      outcomeMetricKey: "sleep_duration",
      lag: "NEXT_DAY",
      exposures: exposureDates.map((d, i) => ({ id: `e${i}`, date: day(d) })),
      outcomeSeries,
    });

    expect(result.quality.outlierCountExposure).toBeGreaterThanOrEqual(1);
    // The outlier occasion must still appear in the exposure group, not be silently dropped.
    expect(result.exposureGroup.n).toBe(6);
  });

  it("detects temporal drift when the outcome metric trends strongly across the full series", () => {
    const start = day("2026-01-01");
    const driftingSeries = Array.from({ length: 120 }, (_, i) => ({
      date: new Date(start.getTime() + i * 86_400_000),
      value: 50 + i * 0.3, // strong upward drift over the full series
    }));
    const exposureDates = ["2026-02-01", "2026-02-10", "2026-02-20", "2026-03-01"];
    const result = computeAssociation({
      exposureType: "LATE_MEAL",
      outcomeMetricKey: "sleep_duration",
      lag: "NEXT_DAY",
      exposures: exposureDates.map((d, i) => ({ id: `e${i}`, date: day(d) })),
      outcomeSeries: driftingSeries,
    });

    expect(result.quality.temporalDriftDetected).toBe(true);
  });

  it("does not flag temporal drift for a flat series", () => {
    const outcomeSeries = flatSeries("2026-01-01", "2026-04-01", 60);
    const exposureDates = ["2026-02-01", "2026-02-10", "2026-02-20"];
    const result = computeAssociation({
      exposureType: "LATE_MEAL",
      outcomeMetricKey: "sleep_duration",
      lag: "NEXT_DAY",
      exposures: exposureDates.map((d, i) => ({ id: `e${i}`, date: day(d) })),
      outcomeSeries,
    });
    expect(result.quality.temporalDriftDetected).toBe(false);
  });
});

describe("association service — confounding breakdown and source confidence", () => {
  it("returns a full per-type confounding breakdown, not just an aggregate count", () => {
    const outcomeSeries = flatSeries("2026-01-01", "2026-03-01", 60);
    const exposureDates = ["2026-01-05", "2026-01-10", "2026-01-15"];
    const eventsByDate = new Map<string, string[]>([
      ["2026-01-05", ["LATE_MEAL", "ALCOHOL"]],
      ["2026-01-10", ["LATE_MEAL", "HIGH_STRESS"]],
      ["2026-01-15", ["LATE_MEAL"]],
    ]);

    const result = computeAssociation({
      exposureType: "LATE_MEAL",
      outcomeMetricKey: "sleep_duration",
      lag: "NEXT_DAY",
      exposures: exposureDates.map((d, i) => ({ id: `e${i}`, date: day(d) })),
      outcomeSeries,
      eventsByDate,
    });

    expect(result.quality.confounding.totalExposureOccasions).toBe(3);
    expect(result.quality.confounding.overlapOccasions).toBe(2);
    expect(result.quality.confounding.coOccurringCounts).toEqual(
      expect.arrayContaining([
        { eventType: "ALCOHOL", count: 1 },
        { eventType: "HIGH_STRESS", count: 1 },
      ])
    );
  });

  it("carries exposure source confidence through to occasions and summarizes it", () => {
    const outcomeSeries = flatSeries("2026-01-01", "2026-03-01", 60);
    const exposureDates = ["2026-01-05", "2026-01-10", "2026-01-15"];
    const result = computeAssociation({
      exposureType: "LATE_MEAL",
      outcomeMetricKey: "sleep_duration",
      lag: "NEXT_DAY",
      exposures: exposureDates.map((d, i) => ({ id: `e${i}`, date: day(d), confidence: i === 0 ? 0.3 : 0.9 })),
      outcomeSeries,
    });

    expect(result.quality.sourceConfidence.lowConfidenceCount).toBe(1);
    expect(result.quality.sourceConfidence.average).toBeCloseTo((0.3 + 0.9 + 0.9) / 3, 5);
    expect(result.occasions.find((o) => o.exposureEventId === "e0")?.confidence).toBe(0.3);
  });
});

function outcomeDatesSetTo(series: { date: Date; value: number }[], exposureDates: string[], offsetDays: number, value: number) {
  for (const d of exposureDates) {
    const outcomeDate = new Date(day(d).getTime() + offsetDays * 86_400_000);
    const point = series.find((p) => p.date.getTime() === outcomeDate.getTime());
    if (point) point.value = value;
  }
}
