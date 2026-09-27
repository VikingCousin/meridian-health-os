// Cautious-language templates for analytical text. This discipline lives in
// the service layer, not just the UI, per the Phase 4 spec: an insight's
// title/summary must never imply causation, even if a future screen forgets
// to add its own disclaimer.
//
// BAD:  "Late pasta causes poor sleep." / "Alcohol damaged your recovery."
// GOOD: "Your recorded sleep was shorter following late meals." /
//       "HRV was lower on mornings following recorded alcohol consumption."

export const CAUSALITY_DISCLAIMER = "Association observed — not proof of causation.";

export const EVENT_TYPE_LABELS: Record<string, string> = {
  LATE_MEAL: "Late meals",
  LARGE_MEAL: "Large meals",
  ALCOHOL: "Alcohol",
  CAFFEINE_LATE: "Late caffeine",
  SAUNA: "Sauna sessions",
  COLD_EXPOSURE: "Cold exposure",
  BREATHWORK: "Breathwork",
  STRENGTH_TRAINING: "Strength training",
  ZONE2: "Zone 2 training",
  HIGH_INTENSITY: "High-intensity training",
  JUDO: "Judo",
  POOR_SLEEP_SUBJECTIVE: "Poor sleep (subjective)",
  LOW_ENERGY: "Low energy",
  HIGH_ENERGY: "High energy",
  HIGH_STRESS: "High stress",
  LOW_MOOD: "Low mood",
  PAIN: "Pain",
  ILLNESS: "Illness",
  SUPPLEMENT_STARTED: "A supplement change",
  SUPPLEMENT_STOPPED: "A supplement change",
};

export const METRIC_LABELS: Record<string, string> = {
  hrv: "HRV",
  sleep_duration: "sleep duration",
  sleep_score: "sleep score",
  resting_hr: "resting heart rate",
  training_load: "training load",
  subjective_energy: "morning energy",
  stress_level: "stress level",
};

export const LAG_LABELS: Record<string, string> = {
  SAME_DAY: "the same day",
  SAME_NIGHT: "the same night",
  NEXT_MORNING: "the next morning",
  NEXT_NIGHT: "the next night",
  NEXT_DAY: "the next day",
  NEXT_24H: "within 24 hours",
  NEXT_48H: "within 48 hours",
};

function eventLabel(type: string): string {
  return EVENT_TYPE_LABELS[type] ?? type.toLowerCase().replace(/_/g, " ");
}

function metricLabel(key: string): string {
  return METRIC_LABELS[key] ?? key.replace(/_/g, " ");
}

export function associationTitle(exposureType: string, outcomeMetricKey: string): string {
  return `${eventLabel(exposureType)} ↔ ${metricLabel(outcomeMetricKey)}`.toUpperCase();
}

/**
 * A cautious, direction-only summary sentence. Never says "causes,"
 * "damaged," "improved," or attributes intent — only reports what was
 * observed, in the passive/observational voice. Optionally appends one
 * caveat sentence when the underlying comparison has a known weakness —
 * see the Phase 4.1 spec's language-safety examples (weak local control,
 * temporal drift, frequent confounders).
 */
export function associationSummary(params: {
  exposureType: string;
  outcomeMetricKey: string;
  lag: string;
  differenceRelativePct?: number;
  localControlLimited?: boolean;
  temporalDriftDetected?: boolean;
  confoundersFrequent?: boolean;
}): string {
  const exposure = eventLabel(params.exposureType).toLowerCase();
  const metric = metricLabel(params.outcomeMetricKey);
  const lag = LAG_LABELS[params.lag] ?? params.lag.toLowerCase();
  const direction = (params.differenceRelativePct ?? 0) < 0 ? "lower" : "higher";
  const base = `Your recorded ${metric} has been ${direction} on occasions following ${exposure}, measured ${lag}. This association may be worth testing.`;
  const caveat = associationCaveat(params);
  return caveat ? `${base} ${caveat}` : base;
}

/**
 * One cautious caveat sentence, or `undefined` if none applies. Kept
 * separate from associationSummary() so the detail page can also render it
 * on its own next to the relevant section instead of only inline.
 */
export function associationCaveat(params: {
  localControlLimited?: boolean;
  temporalDriftDetected?: boolean;
  confoundersFrequent?: boolean;
}): string | undefined {
  if (params.localControlLimited) return "An early association is visible, but comparable control data is limited.";
  if (params.temporalDriftDetected) return "Your baseline changed during this period, so this comparison is less certain.";
  if (params.confoundersFrequent) return "Other recorded factors often occurred at the same time.";
  return undefined;
}
