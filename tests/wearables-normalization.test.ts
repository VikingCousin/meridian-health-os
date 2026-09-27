import { describe, it, expect } from "vitest";
import {
  normalizeDuration,
  normalizeHeartRate,
  normalizeHrv,
  normalizePercentage,
  normalizeDistance,
  normalizeWeight,
  normalizeTemperature,
} from "@/lib/wearables/normalization/unit-normalizer";
import { parseTimestamp, resolveSleepDay } from "@/lib/wearables/normalization/timestamp-normalizer";
import { getMetricCatalogEntry, resolveMetricByRawName } from "@/lib/wearables/normalization/metric-map";
import { isPlausibleValue, isPlausibleTimestamp, isPlausibleSleepSession } from "@/lib/wearables/validation";
import { measurementFingerprint, sleepSessionFingerprint } from "@/lib/wearables/fingerprint";

describe("unit normalization", () => {
  it("converts duration units to minutes", () => {
    expect(normalizeDuration(90, "s")).toEqual({ value: 1.5, unit: "min" });
    expect(normalizeDuration(1.5, "h")).toEqual({ value: 90, unit: "min" });
    expect(normalizeDuration(45, "min")).toEqual({ value: 45, unit: "min" });
  });

  it("passes through heart rate as bpm and rejects an ambiguous unit", () => {
    expect(normalizeHeartRate(58, "bpm")).toEqual({ value: 58, unit: "bpm" });
    expect(normalizeHeartRate(58, "furlongs")).toBeNull();
  });

  it("converts HRV seconds to ms", () => {
    expect(normalizeHrv(0.048, "s")).toEqual({ value: 48, unit: "ms" });
    expect(normalizeHrv(48, "ms")).toEqual({ value: 48, unit: "ms" });
  });

  it("treats a 0-1 fraction as a percentage and passes through 0-100 unchanged", () => {
    expect(normalizePercentage(0.97, "%")).toEqual({ value: 97, unit: "%" });
    expect(normalizePercentage(97, "%")).toEqual({ value: 97, unit: "%" });
  });

  it("converts distance to km", () => {
    expect(normalizeDistance(5000, "m")).toEqual({ value: 5, unit: "km" });
    expect(normalizeDistance(1, "mile")).toEqual({ value: 1.609344, unit: "km" });
  });

  it("converts weight to kg and temperature to celsius", () => {
    expect(normalizeWeight(150, "lbs")!.value).toBeCloseTo(68.0389, 3);
    expect(normalizeTemperature(98.6, "F")!.value).toBeCloseTo(37, 1);
  });

  it("never guesses an ambiguous or unrecognized unit — returns null", () => {
    expect(normalizeDuration(5, "fortnights")).toBeNull();
    expect(normalizeDistance(5, "leagues")).toBeNull();
  });
});

describe("timestamp normalization", () => {
  it("parses ISO timestamps with an explicit offset", () => {
    const parsed = parseTimestamp("2026-06-01T10:00:00+02:00");
    expect(parsed).not.toBeNull();
    expect(parsed!.timezoneOffsetMinutes).toBe(120);
    expect(parsed!.date.toISOString()).toBe("2026-06-01T08:00:00.000Z");
  });

  it("parses a negative offset with minutes", () => {
    const parsed = parseTimestamp("2026-06-01T10:00:00-05:30");
    expect(parsed!.timezoneOffsetMinutes).toBe(-330);
  });

  it("assumes UTC and flags it when no offset is present", () => {
    const parsed = parseTimestamp("2026-06-01 10:00:00");
    expect(parsed).not.toBeNull();
    expect(parsed!.assumedUtc).toBe(true);
  });

  it("applies an explicitly supplied offset to a naive local timestamp", () => {
    const parsed = parseTimestamp("2026-06-01 10:00:00", -300); // UTC-5
    expect(parsed!.date.toISOString()).toBe("2026-06-01T15:00:00.000Z");
    expect(parsed!.assumedUtc).toBe(false);
  });

  it("parses date-only and epoch formats", () => {
    expect(parseTimestamp("2026-06-01")?.date.toISOString()).toBe("2026-06-01T00:00:00.000Z");
    expect(parseTimestamp("1780000000")?.date.getTime()).toBe(1780000000 * 1000);
    expect(parseTimestamp("1780000000000")?.date.getTime()).toBe(1780000000000);
  });

  it("returns null for unparseable input rather than guessing", () => {
    expect(parseTimestamp("not a date")).toBeNull();
    expect(parseTimestamp("")).toBeNull();
  });

  it("assigns a sleep session to the wake-up day, even when it starts the night before", () => {
    const sleepDay = resolveSleepDay(new Date("2026-09-07T06:42:00.000Z"));
    expect(sleepDay.toISOString().slice(0, 10)).toBe("2026-09-07");
  });

  it("resolves sleep day using the session's own timezone offset when known", () => {
    // 2026-09-07T01:30 UTC is still 2026-09-06 local at UTC-5 (20:30) — sleep day should be 09-06 there.
    const sleepDay = resolveSleepDay(new Date("2026-09-07T01:30:00.000Z"), -300);
    expect(sleepDay.toISOString().slice(0, 10)).toBe("2026-09-06");
  });

  it("handles a DST-transition-adjacent instant without shifting the wrong direction", () => {
    // US DST spring-forward 2026-03-08. A session ending just after 2am local (post-transition)
    // should still resolve to that calendar day.
    const sleepDay = resolveSleepDay(new Date("2026-03-08T09:15:00.000Z"), -240); // UTC-4 (post-transition EDT)
    expect(sleepDay.toISOString().slice(0, 10)).toBe("2026-03-08");
  });
});

describe("metric catalog", () => {
  it("resolves common raw field name variants to canonical metrics", () => {
    expect(resolveMetricByRawName("Resting HR")?.metricKey).toBe("resting_hr");
    expect(resolveMetricByRawName("sleepHrv")?.metricKey).toBe("hrv");
    expect(resolveMetricByRawName("Sleep Score")?.metricKey).toBe("sleep_score");
  });

  it("returns undefined for an unrecognized field name rather than guessing", () => {
    expect(resolveMetricByRawName("someProprietaryZeppScore")).toBeUndefined();
  });

  it("every catalog entry's canonical unit round-trips through its own normalize function", () => {
    const entry = getMetricCatalogEntry("hrv")!;
    expect(entry.normalize(48, "ms")).toEqual({ value: 48, unit: "ms" });
  });
});

describe("plausibility validation (technical bounds only)", () => {
  it("flags a technically implausible value (likely a unit/parsing error)", () => {
    expect(isPlausibleValue("hrv", 9000).valid).toBe(false);
    expect(isPlausibleValue("spo2", 150).valid).toBe(false);
  });

  it("never rejects a medically unusual but technically plausible value", () => {
    // A very high but real resting heart rate, or a low-but-real SpO2 — not our judgment to reject.
    expect(isPlausibleValue("resting_hr", 110).valid).toBe(true);
    expect(isPlausibleValue("spo2", 88).valid).toBe(true);
  });

  it("flags impossible timestamps", () => {
    expect(isPlausibleTimestamp(new Date(Date.now() + 10 * 86_400_000)).valid).toBe(false);
    expect(isPlausibleTimestamp(new Date("1990-01-01")).valid).toBe(false);
    expect(isPlausibleTimestamp(new Date()).valid).toBe(true);
  });

  it("flags a sleep session with end before start, or longer than 24h", () => {
    expect(isPlausibleSleepSession(new Date("2026-01-02T00:00:00Z"), new Date("2026-01-01T00:00:00Z")).valid).toBe(false);
    expect(isPlausibleSleepSession(new Date("2026-01-01T00:00:00Z"), new Date("2026-01-03T00:00:00Z")).valid).toBe(false);
    expect(isPlausibleSleepSession(new Date("2026-01-01T23:00:00Z"), new Date("2026-01-02T06:00:00Z")).valid).toBe(true);
  });
});

describe("fingerprinting", () => {
  it("is deterministic — the same inputs always produce the same fingerprint", () => {
    const a = measurementFingerprint({ provider: "ZEPP", metricKey: "hrv", measuredAt: new Date("2026-06-01T00:00:00Z"), value: 48, unit: "ms" });
    const b = measurementFingerprint({ provider: "ZEPP", metricKey: "hrv", measuredAt: new Date("2026-06-01T00:00:00Z"), value: 48, unit: "ms" });
    expect(a).toBe(b);
  });

  it("produces different fingerprints for different values", () => {
    const a = measurementFingerprint({ provider: "ZEPP", metricKey: "hrv", measuredAt: new Date("2026-06-01T00:00:00Z"), value: 48, unit: "ms" });
    const b = measurementFingerprint({ provider: "ZEPP", metricKey: "hrv", measuredAt: new Date("2026-06-01T00:00:00Z"), value: 49, unit: "ms" });
    expect(a).not.toBe(b);
  });

  it("distinguishes sleep sessions by their start/end times", () => {
    const a = sleepSessionFingerprint({ provider: "ZEPP", startedAt: new Date("2026-06-01T23:00:00Z"), endedAt: new Date("2026-06-02T06:00:00Z") });
    const b = sleepSessionFingerprint({ provider: "ZEPP", startedAt: new Date("2026-06-02T23:00:00Z"), endedAt: new Date("2026-06-03T06:00:00Z") });
    expect(a).not.toBe(b);
  });
});
