import { parseCsv } from "@/lib/wearables/importers/csv-utils";
import { GenericCsvImporter, autoDetectMapping } from "@/lib/wearables/importers/generic-csv.importer";
import { parseTimestamp, resolveSleepDay } from "@/lib/wearables/normalization/timestamp-normalizer";
import { isPlausibleSleepSession, isPlausibleTimestamp } from "@/lib/wearables/validation";
import type { CanonicalSleepSession, CanonicalWorkoutSession, ImportWarning, ParsedWearableData, WearableConnector, WearableInputFile } from "@/lib/wearables/types";

/**
 * ⚠️ AWAITING VALIDATION AGAINST A REAL ZEPP EXPORT ⚠️
 *
 * This importer targets the general shape of a Zepp/Mi Fit "request my
 * data" (GDPR-style) export: a zip of per-metric CSV files. That overall
 * shape (one CSV per metric family: heart rate, sleep, SpO2, activity,
 * workouts) is well documented by community export tools, but Zepp has
 * changed exact column names across app versions and no real export file
 * has been used to verify this implementation. Do not present this as a
 * validated Amazfit/Zepp integration — see docs/WEARABLE_ARCHITECTURE.md,
 * "Zepp import format," for exactly what is and isn't verified.
 *
 * To reduce the blast radius of that uncertainty, this importer reuses the
 * SAME flexible, alias-based column matching as the generic CSV importer
 * for point metrics (heart rate, SpO2, activity, stress) — any column whose
 * header isn't recognized is reported as an unknown field rather than
 * misparsed. Only sleep-session and workout-session reconstruction have
 * Zepp-specific column-alias handling, since those need multiple columns
 * combined into one structured record.
 */

type ZeppFileKind = "sleep" | "sport" | "point_metric" | "unrecognized";

function classifyFile(fileName: string): ZeppFileKind {
  const name = fileName.toUpperCase();
  if (name.includes("SLEEP")) return "sleep";
  if (name.includes("SPORT") || name.includes("WORKOUT") || name.includes("EXERCISE")) return "sport";
  if (name.includes("HEARTRATE") || name.includes("HEART_RATE") || name.includes("SPO2") || name.includes("ACTIVITY") || name.includes("STRESS") || name.includes("PAI")) {
    return "point_metric";
  }
  return "unrecognized";
}

function findColumn(headers: string[], aliases: string[]): number {
  const normalized = headers.map((h) => h.trim().toLowerCase().replace(/[^a-z0-9]/g, ""));
  for (const alias of aliases) {
    const idx = normalized.indexOf(alias);
    if (idx !== -1) return idx;
  }
  return -1;
}

function parseSleepFile(file: WearableInputFile, warnings: ImportWarning[]): CanonicalSleepSession[] {
  const { headers, rows } = parseCsv(file.content);
  const startIdx = findColumn(headers, ["start", "starttime", "sleepstart", "bedtime"]);
  const endIdx = findColumn(headers, ["stop", "end", "endtime", "sleepend", "waketime"]);
  const deepIdx = findColumn(headers, ["deepsleeptime", "deep", "deepsleepminutes", "deepsleepduration"]);
  const lightIdx = findColumn(headers, ["shallowsleeptime", "light", "lightsleepminutes", "lightsleepduration"]);
  const remIdx = findColumn(headers, ["remtime", "rem", "remsleepminutes", "remsleepduration"]);
  const awakeIdx = findColumn(headers, ["wake", "awake", "awaketime", "awakeminutes"]);
  const scoreIdx = findColumn(headers, ["score", "sleepscore"]);
  const hrIdx = findColumn(headers, ["heartrate", "averageheartrate", "sleepheartrate"]);
  const hrvIdx = findColumn(headers, ["hrv", "sleephrv"]);
  const spo2Idx = findColumn(headers, ["spo2", "sleepspo2average"]);
  const idIdx = findColumn(headers, ["id", "sessionid"]);

  if (startIdx === -1 || endIdx === -1) {
    warnings.push({ code: "SLEEP_COLUMNS_NOT_RECOGNIZED", message: `Could not find start/end columns in ${file.name} — no sleep sessions imported from this file.` });
    return [];
  }

  const sessions: CanonicalSleepSession[] = [];
  for (const [rowIndex, row] of rows.entries()) {
    const start = parseTimestamp(row[startIdx]);
    const end = parseTimestamp(row[endIdx]);
    if (!start || !end) {
      warnings.push({ code: "BAD_SLEEP_TIMESTAMP", message: `Row ${rowIndex + 2} in ${file.name}: could not parse sleep start/end time.` });
      continue;
    }
    const plausible = isPlausibleSleepSession(start.date, end.date);
    if (!plausible.valid) {
      warnings.push({ code: "IMPLAUSIBLE_SLEEP_SESSION", message: `Row ${rowIndex + 2} in ${file.name}: ${plausible.reason}` });
      continue;
    }

    const numOrUndefined = (idx: number) => (idx !== -1 && row[idx] !== "" ? Number(row[idx]) : undefined);
    sessions.push({
      externalId: idIdx !== -1 ? row[idIdx] : undefined,
      sleepDay: resolveSleepDay(end.date, end.timezoneOffsetMinutes),
      startedAt: start.date,
      endedAt: end.date,
      durationMinutes: Math.round((end.date.getTime() - start.date.getTime()) / 60_000),
      deepMinutes: numOrUndefined(deepIdx),
      lightMinutes: numOrUndefined(lightIdx),
      remMinutes: numOrUndefined(remIdx),
      awakeMinutes: numOrUndefined(awakeIdx),
      sleepScore: numOrUndefined(scoreIdx),
      averageHeartRate: numOrUndefined(hrIdx),
      averageHrv: numOrUndefined(hrvIdx),
      averageSpo2: numOrUndefined(spo2Idx),
      raw: Object.fromEntries(headers.map((h, i) => [h, row[i]])),
    });
  }
  return sessions;
}

function parseSportFile(file: WearableInputFile, warnings: ImportWarning[]): CanonicalWorkoutSession[] {
  const { headers, rows } = parseCsv(file.content);
  const typeIdx = findColumn(headers, ["type", "sporttype", "workouttype"]);
  const startIdx = findColumn(headers, ["starttime", "start"]);
  const endIdx = findColumn(headers, ["endtime", "end", "stop"]);
  const durationIdx = findColumn(headers, ["duration", "durationminutes"]);
  const avgHrIdx = findColumn(headers, ["averageheartrate", "avgheartrate", "avghr"]);
  const maxHrIdx = findColumn(headers, ["maxheartrate", "maxhr"]);
  const loadIdx = findColumn(headers, ["trainingload", "load"]);
  const distanceIdx = findColumn(headers, ["distance", "distancekm"]);
  const caloriesIdx = findColumn(headers, ["calories", "caloriesburned"]);
  const idIdx = findColumn(headers, ["id", "workoutid"]);

  if (startIdx === -1) {
    warnings.push({ code: "WORKOUT_COLUMNS_NOT_RECOGNIZED", message: `Could not find a start-time column in ${file.name} — no workouts imported from this file.` });
    return [];
  }

  const sessions: CanonicalWorkoutSession[] = [];
  for (const [rowIndex, row] of rows.entries()) {
    const start = parseTimestamp(row[startIdx]);
    if (!start || !isPlausibleTimestamp(start.date).valid) {
      warnings.push({ code: "BAD_WORKOUT_TIMESTAMP", message: `Row ${rowIndex + 2} in ${file.name}: could not parse a valid start time.` });
      continue;
    }
    const end = endIdx !== -1 ? parseTimestamp(row[endIdx]) : null;
    const durationMinutes = durationIdx !== -1 && row[durationIdx] !== "" ? Number(row[durationIdx]) : end ? Math.round((end.date.getTime() - start.date.getTime()) / 60_000) : undefined;
    if (durationMinutes === undefined || Number.isNaN(durationMinutes) || durationMinutes <= 0) {
      warnings.push({ code: "WORKOUT_DURATION_UNKNOWN", message: `Row ${rowIndex + 2} in ${file.name}: could not determine workout duration.` });
      continue;
    }
    const endedAt = end?.date ?? new Date(start.date.getTime() + durationMinutes * 60_000);
    const numOrUndefined = (idx: number) => (idx !== -1 && row[idx] !== "" ? Number(row[idx]) : undefined);

    sessions.push({
      externalId: idIdx !== -1 ? row[idIdx] : undefined,
      type: typeIdx !== -1 && row[typeIdx] ? row[typeIdx] : "unknown",
      startedAt: start.date,
      endedAt,
      durationMinutes,
      averageHeartRate: numOrUndefined(avgHrIdx),
      maxHeartRate: numOrUndefined(maxHrIdx),
      trainingLoad: numOrUndefined(loadIdx),
      distanceKm: numOrUndefined(distanceIdx),
      calories: numOrUndefined(caloriesIdx),
      raw: Object.fromEntries(headers.map((h, i) => [h, row[i]])),
    });
  }
  return sessions;
}

export class ZeppWearableImporter implements WearableConnector {
  sourceType = "ZEPP" as const;

  detect(files: WearableInputFile[]): boolean {
    return files.some((f) => classifyFile(f.name) !== "unrecognized");
  }

  parse(files: WearableInputFile[]): ParsedWearableData {
    const warnings: ImportWarning[] = [];
    const sleepSessions: CanonicalSleepSession[] = [];
    const workoutSessions: CanonicalWorkoutSession[] = [];
    const pointMetricFiles: WearableInputFile[] = [];
    const unknownFields: string[] = [];

    for (const file of files) {
      const kind = classifyFile(file.name);
      if (kind === "sleep") sleepSessions.push(...parseSleepFile(file, warnings));
      else if (kind === "sport") workoutSessions.push(...parseSportFile(file, warnings));
      else if (kind === "point_metric") pointMetricFiles.push(file);
      else unknownFields.push(file.name);
    }

    // Point metrics (heart rate, SpO2, activity, stress) reuse the exact
    // same header-alias matching as the generic CSV importer — no
    // Zepp-specific parsing needed for a simple timestamp+value file. Each
    // file is mapped independently since Zepp export files can differ in
    // header shape per metric family.
    const measurements = pointMetricFiles.flatMap((file) => {
      const { headers } = parseCsv(file.content);
      const mapping = autoDetectMapping(headers);
      if (!mapping) {
        warnings.push({ code: "NO_MAPPING", message: `Could not recognize columns in ${file.name}.` });
        unknownFields.push(...headers);
        return [];
      }
      const result = new GenericCsvImporter().parse([file], mapping);
      warnings.push(...result.warnings);
      unknownFields.push(...result.unknownFields);
      return result.measurements;
    });

    return { measurements, sleepSessions, workoutSessions, warnings, unknownFields: [...new Set(unknownFields)] };
  }
}
