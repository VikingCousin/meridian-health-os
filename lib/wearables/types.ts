// Canonical shapes for the wearable ingestion pipeline. A connector's job
// stops at producing these — it never touches Prisma directly (that's
// lib/wearables/services/wearable-import.service.ts) and never decides
// whether a record is a duplicate (that's the fingerprint/dedup layer).
// See docs/WEARABLE_ARCHITECTURE.md.

export type WearableSourceType = "ZEPP" | "GENERIC_CSV";

/** One already-decoded input file (a CSV/JSON member, whether from a folder pick or extracted from a zip). */
export interface WearableInputFile {
  name: string;
  content: string;
}

export interface ImportWarning {
  code: string;
  message: string;
  context?: Record<string, unknown>;
}

/** A single normalized daily/point measurement, ready to become a BiomarkerMeasurement row. */
export interface CanonicalMeasurement {
  /** BiomarkerDefinition.canonicalKey — must be one of the Phase 5 metric catalog keys (lib/wearables/normalization/metric-map.ts). */
  metricKey: string;
  value: number;
  unit: string;
  measuredAt: Date;
  /** A native id from the source file, when the format provides one — preferred over a computed fingerprint for dedup. */
  externalId?: string;
  rawMetricName?: string;
  rawValue?: string | number;
  rawUnit?: string;
}

export interface CanonicalSleepSession {
  externalId?: string;
  /** The calendar date this session is attributed to — see the sleep-day convention in docs/WEARABLE_ARCHITECTURE.md. */
  sleepDay: Date;
  startedAt: Date;
  endedAt: Date;
  durationMinutes: number;
  deepMinutes?: number;
  remMinutes?: number;
  lightMinutes?: number;
  awakeMinutes?: number;
  sleepScore?: number;
  averageHeartRate?: number;
  averageHrv?: number;
  averageSpo2?: number;
  respiratoryRate?: number;
  raw: Record<string, unknown>;
}

export interface CanonicalWorkoutSession {
  externalId?: string;
  type: string;
  startedAt: Date;
  endedAt: Date;
  durationMinutes: number;
  averageHeartRate?: number;
  maxHeartRate?: number;
  trainingLoad?: number;
  distanceKm?: number;
  calories?: number;
  raw: Record<string, unknown>;
}

export interface ParsedWearableData {
  measurements: CanonicalMeasurement[];
  sleepSessions: CanonicalSleepSession[];
  workoutSessions: CanonicalWorkoutSession[];
  warnings: ImportWarning[];
  /** Raw field/column names the connector saw but didn't recognize — surfaced to the user, never guessed at. */
  unknownFields: string[];
}

export interface ImportInspection {
  sourceType: WearableSourceType;
  detected: boolean;
  dateRangeStart?: Date;
  dateRangeEnd?: Date;
  /** canonical metric key -> record count */
  metricCounts: Record<string, number>;
  sleepSessionCount: number;
  workoutCount: number;
  unknownFields: string[];
  warnings: ImportWarning[];
}

/**
 * Provider-agnostic connector interface. A connector only ever does
 * deterministic parsing — never an LLM call (see "no AI parsing of
 * structured exports" in docs/WEARABLE_ARCHITECTURE.md).
 */
export interface WearableConnector {
  sourceType: WearableSourceType;
  /** Cheap structural check: could this connector plausibly handle these files? */
  detect(files: WearableInputFile[]): boolean;
  /** Full deterministic parse into canonical records. */
  parse(files: WearableInputFile[]): ParsedWearableData;
}

export function inspectionFromParsed(sourceType: WearableSourceType, parsed: ParsedWearableData): ImportInspection {
  const metricCounts: Record<string, number> = {};
  for (const m of parsed.measurements) metricCounts[m.metricKey] = (metricCounts[m.metricKey] ?? 0) + 1;

  const allDates = [
    ...parsed.measurements.map((m) => m.measuredAt),
    ...parsed.sleepSessions.map((s) => s.sleepDay),
    ...parsed.workoutSessions.map((w) => w.startedAt),
  ];
  const dateRangeStart = allDates.length > 0 ? new Date(Math.min(...allDates.map((d) => d.getTime()))) : undefined;
  const dateRangeEnd = allDates.length > 0 ? new Date(Math.max(...allDates.map((d) => d.getTime()))) : undefined;

  return {
    sourceType,
    detected: true,
    dateRangeStart,
    dateRangeEnd,
    metricCounts,
    sleepSessionCount: parsed.sleepSessions.length,
    workoutCount: parsed.workoutSessions.length,
    unknownFields: parsed.unknownFields,
    warnings: parsed.warnings,
  };
}
