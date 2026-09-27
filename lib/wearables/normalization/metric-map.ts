import {
  normalizeDuration,
  normalizeHeartRate,
  normalizeHrv,
  normalizePercentage,
  normalizeDistance,
  normalizeScore,
  type NormalizedValue,
} from "@/lib/wearables/normalization/unit-normalizer";

/**
 * One entry per canonical metric this importer will ever write to
 * BiomarkerMeasurement. `normalize` converts a (value, rawUnit) pair to this
 * metric's canonical unit, or returns `null` for an unrecognized/ambiguous
 * unit — callers must then flag the record for review rather than guess.
 *
 * `aliases` are raw source field names (case-insensitive, matched after
 * stripping non-alphanumerics) this metric is recognized under — this is
 * what lets the Zepp importer and the generic-CSV mapping UI suggest a
 * mapping without an LLM.
 */
export interface WearableMetricCatalogEntry {
  metricKey: string;
  label: string;
  canonicalUnit: string;
  normalize: (value: number, rawUnit: string) => NormalizedValue | null;
  aliases: string[];
}

// Sleep duration is a deliberate exception to the "duration -> minutes"
// default below: Meridian's existing seed data, UI formatting, and Phase 4
// analytics all pre-date this phase and already treat `sleep_duration` as
// hours (see lib/mock-data/wearables.ts and the insight detail page's
// formatGroupValue()). Changing that convention now would touch working,
// already-tested UI/analytics code for a purely cosmetic unit preference —
// so imported sleep duration is normalized to hours here, not minutes, and
// this exception is documented in docs/WEARABLE_ARCHITECTURE.md.
function normalizeSleepDurationHours(value: number, rawUnit: string): NormalizedValue | null {
  const minutes = normalizeDuration(value, rawUnit);
  if (!minutes) return null;
  return { value: minutes.value / 60, unit: "hrs" };
}

function minutes(value: number, rawUnit: string): NormalizedValue | null {
  return normalizeDuration(value, rawUnit);
}

export const WEARABLE_METRIC_CATALOG: WearableMetricCatalogEntry[] = [
  // --- Sleep ---
  { metricKey: "sleep_duration", label: "Sleep duration", canonicalUnit: "hrs", normalize: normalizeSleepDurationHours, aliases: ["sleepduration", "totalsleeptime", "sleeptime", "totalsleep"] },
  { metricKey: "sleep_score", label: "Sleep score", canonicalUnit: "/100", normalize: (v, u) => normalizeScore(v, u, "/100"), aliases: ["sleepscore"] },
  { metricKey: "deep_sleep", label: "Deep sleep", canonicalUnit: "min", normalize: minutes, aliases: ["deepsleep", "deepsleepduration", "deepsleepminutes"] },
  { metricKey: "rem_sleep", label: "REM sleep", canonicalUnit: "min", normalize: minutes, aliases: ["remsleep", "remsleepduration", "remsleepminutes"] },
  { metricKey: "light_sleep", label: "Light sleep", canonicalUnit: "min", normalize: minutes, aliases: ["lightsleep", "lightsleepduration", "lightsleepminutes"] },
  { metricKey: "awake_duration", label: "Awake during sleep", canonicalUnit: "min", normalize: minutes, aliases: ["awakeduration", "awaketime", "awakeminutes"] },
  { metricKey: "sleep_efficiency", label: "Sleep efficiency", canonicalUnit: "%", normalize: normalizePercentage, aliases: ["sleepefficiency"] },
  { metricKey: "sleep_latency", label: "Sleep latency", canonicalUnit: "min", normalize: minutes, aliases: ["sleeplatency", "timetofallasleep"] },

  // --- Recovery / cardiovascular ---
  { metricKey: "hrv", label: "HRV", canonicalUnit: "ms", normalize: normalizeHrv, aliases: ["hrv", "heartratevariability", "sleephrv"] },
  { metricKey: "resting_hr", label: "Resting heart rate", canonicalUnit: "bpm", normalize: normalizeHeartRate, aliases: ["restinghr", "restingheartrate", "rhr"] },
  { metricKey: "average_sleeping_heart_rate", label: "Average sleeping heart rate", canonicalUnit: "bpm", normalize: normalizeHeartRate, aliases: ["averagesleepingheartrate", "sleepinghr", "sleepheartrate"] },
  { metricKey: "heart_rate", label: "Average heart rate", canonicalUnit: "bpm", normalize: normalizeHeartRate, aliases: ["heartrate", "averageheartrate", "hr"] },
  { metricKey: "respiratory_rate", label: "Respiratory rate", canonicalUnit: "breaths/min", normalize: (v, u) => normalizeScore(v, u, "breaths/min"), aliases: ["respiratoryrate", "breathingrate"] },

  // --- Oxygen ---
  { metricKey: "spo2", label: "SpO2", canonicalUnit: "%", normalize: normalizePercentage, aliases: ["spo2", "sleepspo2average", "bloodoxygen", "oxygensaturation"] },

  // --- Activity ---
  { metricKey: "steps", label: "Steps", canonicalUnit: "steps", normalize: (v, u) => normalizeScore(v, u, "steps"), aliases: ["steps", "stepcount"] },
  { metricKey: "active_minutes", label: "Active minutes", canonicalUnit: "min", normalize: minutes, aliases: ["activeminutes", "activetime"] },
  { metricKey: "distance", label: "Distance", canonicalUnit: "km", normalize: normalizeDistance, aliases: ["distance"] },
  { metricKey: "calories_active", label: "Active calories", canonicalUnit: "kcal", normalize: (v, u) => normalizeScore(v, u, "kcal"), aliases: ["caloriesactive", "activecalories"] },

  // --- Training ---
  { metricKey: "training_load", label: "Training load", canonicalUnit: "AU", normalize: (v, u) => normalizeScore(v, u, "AU"), aliases: ["trainingload"] },
  { metricKey: "vo2max", label: "VO2max", canonicalUnit: "mL/kg/min", normalize: (v, u) => normalizeScore(v, u, "mL/kg/min"), aliases: ["vo2max"] },

  // --- Stress ---
  { metricKey: "stress_level", label: "Stress level", canonicalUnit: "/100", normalize: (v, u) => normalizeScore(v, u, "/100"), aliases: ["stresslevel", "stressscore"] },
];

const METRIC_BY_KEY = new Map(WEARABLE_METRIC_CATALOG.map((m) => [m.metricKey, m]));
const METRIC_BY_ALIAS = new Map(WEARABLE_METRIC_CATALOG.flatMap((m) => m.aliases.map((a) => [a, m] as const)));

function normalizeFieldName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function getMetricCatalogEntry(metricKey: string): WearableMetricCatalogEntry | undefined {
  return METRIC_BY_KEY.get(metricKey);
}

/** Resolves a raw source field/column name (e.g. "Sleep HRV", "restingHeartRate") to a canonical metric, or `undefined` if unrecognized. */
export function resolveMetricByRawName(rawName: string): WearableMetricCatalogEntry | undefined {
  return METRIC_BY_ALIAS.get(normalizeFieldName(rawName));
}
