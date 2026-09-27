import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { GenericCsvImporter, autoDetectMapping } from "@/lib/wearables/importers/generic-csv.importer";
import { ZeppWearableImporter } from "@/lib/wearables/importers/zepp.importer";
import { detectConnector } from "@/lib/wearables/registry";
import type { WearableInputFile } from "@/lib/wearables/types";

function loadFixture(name: string): WearableInputFile {
  const content = readFileSync(path.join(__dirname, "fixtures", "wearables", name), "utf8");
  return { name, content };
}

describe("GenericCsvImporter", () => {
  const file = loadFixture("generic-sample.csv");

  it("auto-detects a timestamp column and recognized metric columns from headers", () => {
    const mapping = autoDetectMapping(["Date", "HRV", "Resting HR", "Sleep Duration"]);
    expect(mapping).not.toBeNull();
    expect(mapping!.timestampColumn).toBe("Date");
    expect(mapping!.columns.map((c) => c.metricKey).sort()).toEqual(["hrv", "resting_hr", "sleep_duration"]);
  });

  it("parses HRV and resting HR end to end using auto-detected mapping", () => {
    const result = new GenericCsvImporter().parse([file]);
    expect(result.unknownFields).toEqual([]);
    const hrvValues = result.measurements.filter((m) => m.metricKey === "hrv").map((m) => m.value);
    expect(hrvValues).toEqual([52, 49, 55, 51]);
    const restingHrValues = result.measurements.filter((m) => m.metricKey === "resting_hr").map((m) => m.value);
    expect(restingHrValues).toEqual([58, 59, 57, 60, 58]);
  });

  it("skips empty cells without treating them as errors", () => {
    const result = new GenericCsvImporter().parse([file]);
    const warningsAboutRow4 = result.warnings.filter((w) => w.message.includes("Row 5") && w.code !== "AMBIGUOUS_UNIT");
    expect(warningsAboutRow4).toHaveLength(0);
  });

  it("flags a duration-type column with no stated unit as ambiguous rather than assuming hours or minutes", () => {
    // A plain "Sleep Duration" CSV column with numeric-only values (no unit
    // column, no header hint) is genuinely ambiguous — 7.1 could mean 7.1
    // hours or 7.1 minutes. The importer must not guess.
    const result = new GenericCsvImporter().parse([file]);
    const sleepDurationValues = result.measurements.filter((m) => m.metricKey === "sleep_duration");
    expect(sleepDurationValues).toHaveLength(0);
    expect(result.warnings.some((w) => w.code === "AMBIGUOUS_UNIT" && w.message.includes("Sleep Duration"))).toBe(true);
  });

  it("reports an unrecognized column as an unknown field instead of guessing", () => {
    const csv = "Date,HRV,SomeProprietaryScore\n2026-01-01,50,123\n2026-01-02,51,124\n";
    const result = new GenericCsvImporter().parse([{ name: "test.csv", content: csv }]);
    expect(result.unknownFields).toContain("SomeProprietaryScore");
    expect(result.measurements.every((m) => m.metricKey !== "someproprietaryscore")).toBe(true);
  });

  it("flags a non-numeric value instead of silently dropping or coercing it", () => {
    const csv = "Date,HRV\n2026-01-01,not-a-number\n";
    const result = new GenericCsvImporter().parse([{ name: "test.csv", content: csv }]);
    expect(result.measurements).toHaveLength(0);
    expect(result.warnings.some((w) => w.code === "NON_NUMERIC_VALUE")).toBe(true);
  });

  it("flags an unparseable timestamp row instead of guessing a date", () => {
    const csv = "Date,HRV\nnot-a-date,50\n2026-01-02,51\n";
    const result = new GenericCsvImporter().parse([{ name: "test.csv", content: csv }]);
    expect(result.measurements).toHaveLength(1);
    expect(result.warnings.some((w) => w.code === "BAD_TIMESTAMP")).toBe(true);
  });

  it("skips a technically implausible value with a clear reason", () => {
    const csv = "Date,HRV\n2026-01-01,9000\n2026-01-02,50\n";
    const result = new GenericCsvImporter().parse([{ name: "test.csv", content: csv }]);
    expect(result.measurements).toHaveLength(1);
    expect(result.warnings.some((w) => w.code === "IMPLAUSIBLE_VALUE")).toBe(true);
  });

  it("returns no mapping (and flags every header as unknown) when no timestamp column is found", () => {
    const csv = "A,B\n1,2\n";
    const result = new GenericCsvImporter().parse([{ name: "test.csv", content: csv }]);
    expect(result.warnings.some((w) => w.code === "NO_MAPPING")).toBe(true);
    expect(result.unknownFields).toEqual(["A", "B"]);
  });
});

describe("ZeppWearableImporter", () => {
  const heartRateFile = loadFixture("zepp-heartrate-auto.csv");
  const sleepFile = loadFixture("zepp-sleep.csv");

  it("detects itself for files with recognizable Zepp export names", () => {
    expect(new ZeppWearableImporter().detect([heartRateFile])).toBe(true);
    expect(new ZeppWearableImporter().detect([{ name: "random.csv", content: "a,b\n1,2" }])).toBe(false);
  });

  it("parses point-metric files (heart rate) via the same alias matching as the generic importer", () => {
    const result = new ZeppWearableImporter().parse([heartRateFile]);
    expect(result.measurements).toHaveLength(5);
    expect(result.measurements[0].metricKey).toBe("heart_rate");
    expect(result.measurements[0].unit).toBe("bpm");
  });

  it("reconstructs sleep sessions with the wake-up-day convention, including a session crossing midnight", () => {
    const result = new ZeppWearableImporter().parse([sleepFile]);
    expect(result.sleepSessions).toHaveLength(3);
    const first = result.sleepSessions[0];
    // Starts 2026-06-01 23:15, ends 2026-06-02 06:40 -> sleep day is the wake-up day.
    expect(first.startedAt.toISOString()).toBe("2026-06-01T23:15:00.000Z");
    expect(first.endedAt.toISOString()).toBe("2026-06-02T06:40:00.000Z");
    expect(first.sleepDay.toISOString().slice(0, 10)).toBe("2026-06-02");
    expect(first.deepMinutes).toBe(95);
    expect(first.remMinutes).toBe(80);
    expect(first.durationMinutes).toBe(445);
  });

  it("flags a partial sleep session (missing recognizable start/end columns) instead of guessing", () => {
    const csv = "id,deepSleepTime\n1,90\n";
    const result = new ZeppWearableImporter().parse([{ name: "SLEEP_partial.csv", content: csv }]);
    expect(result.sleepSessions).toHaveLength(0);
    expect(result.warnings.some((w) => w.code === "SLEEP_COLUMNS_NOT_RECOGNIZED")).toBe(true);
  });

  it("rejects an implausible sleep session (e.g. end before start) rather than importing it", () => {
    const csv = "id,start,stop\n1,2026-06-02T06:00:00Z,2026-06-01T23:00:00Z\n";
    const result = new ZeppWearableImporter().parse([{ name: "SLEEP_bad.csv", content: csv }]);
    expect(result.sleepSessions).toHaveLength(0);
    expect(result.warnings.some((w) => w.code === "IMPLAUSIBLE_SLEEP_SESSION")).toBe(true);
  });

  it("parses a workout/sport file into a workout session", () => {
    const csv = "id,type,startTime,endTime,averageHeartRate,trainingLoad\nw1,Judo,2026-06-01T18:00:00Z,2026-06-01T19:30:00Z,142,85\n";
    const result = new ZeppWearableImporter().parse([{ name: "SPORT.csv", content: csv }]);
    expect(result.workoutSessions).toHaveLength(1);
    expect(result.workoutSessions[0].type).toBe("Judo");
    expect(result.workoutSessions[0].durationMinutes).toBe(90);
    expect(result.workoutSessions[0].trainingLoad).toBe(85);
  });

  it("reports an unrecognized file as an unknown field rather than misparsing it", () => {
    const result = new ZeppWearableImporter().parse([{ name: "MYSTERY_FILE.csv", content: "a,b\n1,2" }]);
    expect(result.unknownFields).toContain("MYSTERY_FILE.csv");
  });
});

describe("connector registry / format detection", () => {
  it("prefers the Zepp connector when files look like a Zepp export", () => {
    const connector = detectConnector([loadFixture("zepp-heartrate-auto.csv")]);
    expect(connector?.sourceType).toBe("ZEPP");
  });

  it("falls back to generic CSV for an unbranded CSV file", () => {
    const connector = detectConnector([loadFixture("generic-sample.csv")]);
    expect(connector?.sourceType).toBe("GENERIC_CSV");
  });

  it("returns undefined (unsupported format) for something unrecognizable", () => {
    const connector = detectConnector([{ name: "notes.txt", content: "just some notes, not tabular data at all" }]);
    expect(connector).toBeUndefined();
  });
});
