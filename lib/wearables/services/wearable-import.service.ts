import * as wearableRepo from "@/lib/db/repositories/wearable.repository";
import * as biomarkerRepo from "@/lib/db/repositories/biomarker.repository";
import { detectConnector, getConnector } from "@/lib/wearables/registry";
import { GenericCsvImporter } from "@/lib/wearables/importers/generic-csv.importer";
import { getMetricCatalogEntry } from "@/lib/wearables/normalization/metric-map";
import { measurementFingerprint, sleepSessionFingerprint, workoutFingerprint } from "@/lib/wearables/fingerprint";
import { inspectionFromParsed } from "@/lib/wearables/types";
import type { CsvColumnMapping } from "@/lib/wearables/importers/generic-csv.importer";
import type { ImportInspection, ImportWarning, ParsedWearableData, WearableInputFile, WearableSourceType } from "@/lib/wearables/types";
import type { Prisma } from "@/lib/generated/prisma/client";

export interface InspectOutcome {
  ok: true;
  sourceType: WearableSourceType;
  inspection: ImportInspection;
  parsed: ParsedWearableData;
}
export interface InspectFailure {
  ok: false;
  error: string;
}

/** Pure inspection — parses and validates but never touches the database. */
export function inspectWearableFiles(files: WearableInputFile[], forcedSourceType?: WearableSourceType, mapping?: CsvColumnMapping): InspectOutcome | InspectFailure {
  const connector = forcedSourceType ? getConnector(forcedSourceType) : detectConnector(files);
  if (!connector) {
    return { ok: false, error: "Unsupported export format — Meridian couldn't recognize any of the selected files as a Zepp export or a readable CSV." };
  }
  const parsed = connector instanceof GenericCsvImporter ? connector.parse(files, mapping) : connector.parse(files);
  return { ok: true, sourceType: connector.sourceType, inspection: inspectionFromParsed(connector.sourceType, parsed), parsed };
}

export interface ImportOutcome {
  importSessionId: string;
  status: "COMPLETED" | "PARTIAL" | "FAILED";
  recordsFound: number;
  recordsImported: number;
  recordsSkipped: number;
  recordsFailed: number;
  sleepSessionsImported: number;
  workoutsImported: number;
  warnings: ImportWarning[];
}

export interface ImportWearableFilesParams {
  dataSourceId: string;
  /** Used to build a stable fingerprint namespace (e.g. "ZEPP", "GENERIC_CSV") — kept separate from the DB provider enum so tests can pass anything. */
  provider: string;
  files: WearableInputFile[];
  forcedSourceType?: WearableSourceType;
  mapping?: CsvColumnMapping;
  originalFileName?: string;
  fileHash?: string;
}

/**
 * Parses, deduplicates, and persists a wearable import. Idempotent: running
 * this again with the same file produces the same canonical records, which
 * are recognized as already-present via their externalId (native id if the
 * source gave one, otherwise a deterministic fingerprint) and are not
 * re-inserted — see lib/wearables/fingerprint.ts.
 *
 * Also enforces demo/real isolation: the first time real data lands for a
 * given canonical metric, any pre-existing DEMO-seeded measurement for that
 * metric (sourceType=WEARABLE with no dataSourceId — see prisma/seed.ts) is
 * deleted first, so analytics never numerically blends demo noise with real
 * imported values. This check is cheap and idempotent, so it runs on every
 * import rather than needing separate "have we cleared demo data yet" state.
 */
export async function importWearableFiles(params: ImportWearableFilesParams): Promise<ImportOutcome> {
  const inspectResult = inspectWearableFiles(params.files, params.forcedSourceType, params.mapping);

  const session = await wearableRepo.createImportSession({
    dataSource: { connect: { id: params.dataSourceId } },
    status: "IMPORTING",
    originalFileName: params.originalFileName,
    fileHash: params.fileHash,
    metadata: {},
  });

  if (!inspectResult.ok) {
    await wearableRepo.updateImportSession(session.id, { status: "FAILED", completedAt: new Date(), errorMessage: inspectResult.error });
    return {
      importSessionId: session.id,
      status: "FAILED",
      recordsFound: 0,
      recordsImported: 0,
      recordsSkipped: 0,
      recordsFailed: 0,
      sleepSessionsImported: 0,
      workoutsImported: 0,
      warnings: [{ code: "UNSUPPORTED_FORMAT", message: inspectResult.error }],
    };
  }

  const { parsed } = inspectResult;
  const warnings = [...parsed.warnings];
  let recordsImported = 0;
  let recordsSkipped = 0;
  let recordsFailed = 0;

  // --- Measurements ---
  const definitionCache = new Map<string, string | null>(); // canonicalKey -> BiomarkerDefinition.id | null (not found)
  const clearedDemoForMetric = new Set<string>();

  for (const measurement of parsed.measurements) {
    const catalogEntry = getMetricCatalogEntry(measurement.metricKey);
    if (!catalogEntry) {
      warnings.push({ code: "UNKNOWN_METRIC", message: `"${measurement.metricKey}" is not a recognized canonical metric — skipped.` });
      recordsSkipped++;
      continue;
    }

    if (!definitionCache.has(measurement.metricKey)) {
      const definition = await biomarkerRepo.findBiomarkerDefinitionByKey(measurement.metricKey);
      definitionCache.set(measurement.metricKey, definition?.id ?? null);
    }
    const definitionId = definitionCache.get(measurement.metricKey);
    if (!definitionId) {
      warnings.push({ code: "MISSING_DEFINITION", message: `No BiomarkerDefinition exists for "${measurement.metricKey}" — run the seed script, or add it to the catalog first.` });
      recordsFailed++;
      continue;
    }

    if (!clearedDemoForMetric.has(measurement.metricKey)) {
      await wearableRepo.deleteDemoMeasurementsForDefinition(definitionId);
      clearedDemoForMetric.add(measurement.metricKey);
    }

    const externalId =
      measurement.externalId ?? measurementFingerprint({ provider: params.provider, metricKey: measurement.metricKey, measuredAt: measurement.measuredAt, value: measurement.value, unit: measurement.unit });

    const existing = await wearableRepo.countExistingMeasurements(params.dataSourceId, [externalId]);
    if (existing.has(externalId)) {
      recordsSkipped++;
      continue;
    }

    await wearableRepo.upsertMeasurement({
      biomarkerDefinitionId: definitionId,
      value: measurement.value,
      unit: measurement.unit,
      measuredAt: measurement.measuredAt,
      sourceType: "WEARABLE",
      dataSourceId: params.dataSourceId,
      externalId,
    });
    recordsImported++;
  }

  // --- Sleep sessions ---
  let sleepSessionsImported = 0;
  for (const session_ of parsed.sleepSessions) {
    const externalId = session_.externalId ?? sleepSessionFingerprint({ provider: params.provider, startedAt: session_.startedAt, endedAt: session_.endedAt });
    const existing = await wearableRepo.existingSleepExternalIds(params.dataSourceId, [externalId]);
    if (existing.has(externalId)) {
      recordsSkipped++;
      continue;
    }
    await wearableRepo.upsertSleepSession({
      dataSourceId: params.dataSourceId,
      externalId,
      sleepDay: session_.sleepDay,
      startedAt: session_.startedAt,
      endedAt: session_.endedAt,
      durationMinutes: session_.durationMinutes,
      deepMinutes: session_.deepMinutes,
      remMinutes: session_.remMinutes,
      lightMinutes: session_.lightMinutes,
      awakeMinutes: session_.awakeMinutes,
      sleepScore: session_.sleepScore,
      averageHeartRate: session_.averageHeartRate,
      averageHrv: session_.averageHrv,
      averageSpo2: session_.averageSpo2,
      sourceMetadata: session_.raw as Prisma.InputJsonValue,
    });
    sleepSessionsImported++;
    recordsImported++;
  }

  // --- Workout sessions ---
  let workoutsImported = 0;
  for (const workout of parsed.workoutSessions) {
    const externalId = workout.externalId ?? workoutFingerprint({ provider: params.provider, type: workout.type, startedAt: workout.startedAt, endedAt: workout.endedAt });
    const existing = await wearableRepo.existingWorkoutExternalIds(params.dataSourceId, [externalId]);
    if (existing.has(externalId)) {
      recordsSkipped++;
      continue;
    }
    await wearableRepo.upsertWorkoutSession({
      dataSourceId: params.dataSourceId,
      externalId,
      type: workout.type,
      startedAt: workout.startedAt,
      endedAt: workout.endedAt,
      durationMinutes: workout.durationMinutes,
      averageHeartRate: workout.averageHeartRate,
      maxHeartRate: workout.maxHeartRate,
      trainingLoad: workout.trainingLoad,
      distanceKm: workout.distanceKm,
      calories: workout.calories,
      sourceMetadata: workout.raw as Prisma.InputJsonValue,
    });
    workoutsImported++;
    recordsImported++;
  }

  const recordsFound = parsed.measurements.length + parsed.sleepSessions.length + parsed.workoutSessions.length;
  // A 100%-duplicate re-import is a successful no-op, not a partial failure —
  // only actual failed records make a run PARTIAL (or FAILED, if nothing at
  // all got through).
  const status: ImportOutcome["status"] = recordsFailed === 0 ? "COMPLETED" : recordsImported === 0 ? "FAILED" : "PARTIAL";

  await wearableRepo.updateImportSession(session.id, {
    status,
    completedAt: new Date(),
    recordsFound,
    recordsImported,
    recordsSkipped,
    recordsFailed,
    metadata: JSON.parse(JSON.stringify({ warnings: warnings.slice(0, 200), unknownFields: parsed.unknownFields })) as Prisma.InputJsonValue,
  });

  await wearableRepo.updateDataSource(params.dataSourceId, {
    status: recordsImported > 0 ? "CONNECTED" : "NEEDS_IMPORT",
    lastImportAt: new Date(),
    ...(recordsImported > 0 ? { lastSuccessfulImportAt: new Date() } : {}),
  });

  return { importSessionId: session.id, status, recordsFound, recordsImported, recordsSkipped, recordsFailed, sleepSessionsImported, workoutsImported, warnings };
}
