import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { importWearableFiles } from "@/lib/wearables/services/wearable-import.service";
import { getBaselineForMetric } from "@/lib/analytics/baseline.service";
import { getBiomarkerDetail } from "@/lib/services/biomarker.service";

const MARKER = "TEST_WEARABLE_IMPORT_SVC";

const HRV_CSV = ["Date,HRV", "2026-08-01,44", "2026-08-02,46", "2026-08-03,45", "2026-08-04,47", "2026-08-05,43"].join("\n");

const SLEEP_CSV = [
  "id,start,stop,deepSleepTime,shallowSleepTime,remTime,wakeTime,score",
  "s1,2026-08-01T23:10:00Z,2026-08-02T06:30:00Z,90,240,70,10,80",
  "s2,2026-08-02T23:20:00Z,2026-08-03T06:40:00Z,95,235,75,12,82",
].join("\n");

const SPORT_CSV = ["id,type,startTime,endTime,averageHeartRate,trainingLoad", "w1,Judo,2026-08-01T18:00:00Z,2026-08-01T19:30:00Z,140,80"].join("\n");

describe("wearable import service (DB-wired)", () => {
  let dataSourceId: string;
  let hrvDefinitionId: string;
  let restingHrDefinitionId: string;

  beforeAll(async () => {
    const hrvDef = await prisma.biomarkerDefinition.create({
      data: { canonicalKey: "hrv", displayName: "HRV", category: "Cardiac function", defaultUnit: "ms", bodySystem: "CARDIOVASCULAR", aliases: [] },
    });
    hrvDefinitionId = hrvDef.id;

    const restingHrDef = await prisma.biomarkerDefinition.create({
      data: { canonicalKey: "resting_hr", displayName: "Resting Heart Rate", category: "Cardiac function", defaultUnit: "bpm", bodySystem: "CARDIOVASCULAR", aliases: [] },
    });
    restingHrDefinitionId = restingHrDef.id;

    // Pre-existing DEMO data for both metrics, exactly like prisma/seed.ts writes: WEARABLE sourceType, no dataSourceId.
    await prisma.biomarkerMeasurement.create({
      data: { biomarkerDefinitionId: hrvDefinitionId, value: 999, unit: "ms", measuredAt: new Date("2026-07-01"), sourceType: "WEARABLE", verified: true },
    });
    await prisma.biomarkerMeasurement.create({
      data: { biomarkerDefinitionId: restingHrDefinitionId, value: 61, unit: "bpm", measuredAt: new Date("2026-07-01"), sourceType: "WEARABLE", verified: true },
    });

    const dataSource = await prisma.healthDataSource.create({
      data: { type: "WEARABLE", provider: "GENERIC_CSV", displayName: MARKER, status: "NOT_CONFIGURED", metadata: {} },
    });
    dataSourceId = dataSource.id;
  });

  afterAll(async () => {
    await prisma.sleepSession.deleteMany({ where: { dataSourceId } });
    await prisma.workoutSession.deleteMany({ where: { dataSourceId } });
    await prisma.wearableImportSession.deleteMany({ where: { dataSourceId } });
    await prisma.biomarkerMeasurement.deleteMany({ where: { biomarkerDefinitionId: { in: [hrvDefinitionId, restingHrDefinitionId] } } });
    await prisma.healthDataSource.deleteMany({ where: { id: dataSourceId } });
    await prisma.biomarkerDefinition.deleteMany({ where: { id: { in: [hrvDefinitionId, restingHrDefinitionId] } } });
  });

  it("imports real measurements with correct provenance, and clears only the demo data for the imported metric", async () => {
    const result = await importWearableFiles({
      dataSourceId,
      provider: "GENERIC_CSV",
      files: [{ name: "test-hrv.csv", content: HRV_CSV }],
      forcedSourceType: "GENERIC_CSV",
      originalFileName: "test-hrv.csv",
    });

    expect(result.status).toBe("COMPLETED");
    expect(result.recordsImported).toBe(5);
    expect(result.recordsSkipped).toBe(0);
    expect(result.recordsFailed).toBe(0);

    // Demo HRV row (dataSourceId null) must be gone — real/demo isolation.
    const demoHrv = await prisma.biomarkerMeasurement.count({ where: { biomarkerDefinitionId: hrvDefinitionId, dataSourceId: null } });
    expect(demoHrv).toBe(0);

    // Demo resting-HR row (a DIFFERENT metric) must be untouched.
    const demoRestingHr = await prisma.biomarkerMeasurement.count({ where: { biomarkerDefinitionId: restingHrDefinitionId, dataSourceId: null } });
    expect(demoRestingHr).toBe(1);

    // Provenance: the real biomarker service (unmodified) surfaces the data source's display name.
    const hrv = await getBiomarkerDetail("hrv");
    expect(hrv).not.toBeNull();
    expect(hrv!.source.label).toBe(MARKER);
    expect(hrv!.source.type).toBe("wearable");
  });

  it("is idempotent — re-importing the identical file creates zero duplicate measurements", async () => {
    const before = await prisma.biomarkerMeasurement.count({ where: { biomarkerDefinitionId: hrvDefinitionId, dataSourceId } });

    const result = await importWearableFiles({
      dataSourceId,
      provider: "GENERIC_CSV",
      files: [{ name: "test-hrv.csv", content: HRV_CSV }],
      forcedSourceType: "GENERIC_CSV",
    });

    expect(result.recordsImported).toBe(0);
    expect(result.recordsSkipped).toBe(5);
    // A fully-duplicate re-import is a successful no-op, not a partial failure.
    expect(result.status).toBe("COMPLETED");

    const after = await prisma.biomarkerMeasurement.count({ where: { biomarkerDefinitionId: hrvDefinitionId, dataSourceId } });
    expect(after).toBe(before);
  });

  it("makes imported data immediately usable by the existing (unmodified) Phase 4 baseline engine", async () => {
    const baseline = await getBaselineForMetric("hrv", 7, new Date("2026-08-06"));
    expect(baseline.status).toBe("VALID");
    expect(baseline.count).toBe(5);
    expect(baseline.mean).toBeCloseTo((44 + 46 + 45 + 47 + 43) / 5, 5);
  });

  it("records accurate import session accounting", async () => {
    const sessions = await prisma.wearableImportSession.findMany({ where: { dataSourceId }, orderBy: { startedAt: "asc" } });
    expect(sessions).toHaveLength(2);
    expect(sessions[0].status).toBe("COMPLETED");
    expect(sessions[0].recordsImported).toBe(5);
    expect(sessions[1].recordsSkipped).toBe(5);
  });

  it("imports sleep sessions and workout sessions, both idempotently", async () => {
    const firstImport = await importWearableFiles({
      dataSourceId,
      provider: "ZEPP",
      files: [
        { name: "SLEEP.csv", content: SLEEP_CSV },
        { name: "SPORT.csv", content: SPORT_CSV },
      ],
      forcedSourceType: "ZEPP",
    });
    expect(firstImport.sleepSessionsImported).toBe(2);
    expect(firstImport.workoutsImported).toBe(1);

    const sleepSessions = await prisma.sleepSession.findMany({ where: { dataSourceId } });
    expect(sleepSessions).toHaveLength(2);
    expect(sleepSessions[0].sourceMetadata).toBeTruthy();

    const workouts = await prisma.workoutSession.findMany({ where: { dataSourceId } });
    expect(workouts).toHaveLength(1);
    expect(workouts[0].type).toBe("Judo");

    const secondImport = await importWearableFiles({
      dataSourceId,
      provider: "ZEPP",
      files: [
        { name: "SLEEP.csv", content: SLEEP_CSV },
        { name: "SPORT.csv", content: SPORT_CSV },
      ],
      forcedSourceType: "ZEPP",
    });
    expect(secondImport.sleepSessionsImported).toBe(0);
    expect(secondImport.workoutsImported).toBe(0);

    const sleepSessionsAfter = await prisma.sleepSession.count({ where: { dataSourceId } });
    expect(sleepSessionsAfter).toBe(2);
  });

  it("reports an unsupported format as a failed import rather than crashing", async () => {
    const result = await importWearableFiles({
      dataSourceId,
      provider: "GENERIC_CSV",
      files: [{ name: "notes.txt", content: "not tabular data at all, just some prose about my day" }],
    });
    expect(result.status).toBe("FAILED");
    expect(result.warnings.some((w) => w.code === "UNSUPPORTED_FORMAT")).toBe(true);
  });
});
