// Conservative TECHNICAL plausibility bounds for ingestion validation only —
// these catch parsing/unit mistakes (e.g. HRV = 9000ms is almost certainly a
// unit error), never medically unusual-but-real values. Meridian does not
// reject a value merely for being outside a normal reference range; that
// judgment belongs to the person and their clinician, not the importer. See
// docs/WEARABLE_ARCHITECTURE.md, "Data quality" / "Import validation."

export interface PlausibilityBounds {
  min: number;
  max: number;
}

const BOUNDS_BY_METRIC: Record<string, PlausibilityBounds> = {
  sleep_duration: { min: 0, max: 24 },
  sleep_score: { min: 0, max: 100 },
  deep_sleep: { min: 0, max: 24 * 60 },
  rem_sleep: { min: 0, max: 24 * 60 },
  light_sleep: { min: 0, max: 24 * 60 },
  awake_duration: { min: 0, max: 24 * 60 },
  sleep_efficiency: { min: 0, max: 100 },
  sleep_latency: { min: 0, max: 24 * 60 },
  hrv: { min: 0, max: 500 },
  resting_hr: { min: 0, max: 300 },
  average_sleeping_heart_rate: { min: 0, max: 300 },
  heart_rate: { min: 0, max: 300 },
  respiratory_rate: { min: 0, max: 60 },
  spo2: { min: 0, max: 100 },
  steps: { min: 0, max: 200_000 },
  active_minutes: { min: 0, max: 24 * 60 },
  distance: { min: 0, max: 500 },
  calories_active: { min: 0, max: 20_000 },
  training_load: { min: 0, max: 100_000 },
  vo2max: { min: 0, max: 100 },
  stress_level: { min: 0, max: 100 },
};

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

/** Pure technical bounds check — never a "normal range" judgment. */
export function isPlausibleValue(metricKey: string, value: number): ValidationResult {
  if (!Number.isFinite(value)) return { valid: false, reason: "Value is not a finite number" };
  const bounds = BOUNDS_BY_METRIC[metricKey];
  if (!bounds) return { valid: true };
  if (value < bounds.min || value > bounds.max) {
    return { valid: false, reason: `${metricKey} value ${value} is outside the technically plausible range [${bounds.min}, ${bounds.max}]` };
  }
  return { valid: true };
}

export function isPlausibleTimestamp(date: Date): ValidationResult {
  if (Number.isNaN(date.getTime())) return { valid: false, reason: "Timestamp could not be parsed" };
  const now = Date.now();
  const oneDayMs = 86_400_000;
  if (date.getTime() > now + oneDayMs) return { valid: false, reason: "Timestamp is in the future" };
  if (date.getFullYear() < 2000) return { valid: false, reason: "Timestamp is implausibly old" };
  return { valid: true };
}

export function isPlausibleSleepSession(startedAt: Date, endedAt: Date): ValidationResult {
  if (endedAt <= startedAt) return { valid: false, reason: "Sleep session end time is not after its start time" };
  const durationHours = (endedAt.getTime() - startedAt.getTime()) / 3_600_000;
  if (durationHours > 24) return { valid: false, reason: "Sleep session is longer than 24 hours" };
  return { valid: true };
}
