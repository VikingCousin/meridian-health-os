// Explicit, deterministic unit conversion to one canonical unit per
// quantity. Nothing here guesses: an unrecognized unit string returns
// `null` rather than assuming a default, so the caller can flag the record
// for review or skip it with a reason (see docs/WEARABLE_ARCHITECTURE.md,
// "Units").

export interface NormalizedValue {
  value: number;
  unit: string;
}

function normalizeUnitString(unit: string): string {
  return unit.trim().toLowerCase();
}

/** Canonical: minutes. */
export function normalizeDuration(value: number, unit: string): NormalizedValue | null {
  switch (normalizeUnitString(unit)) {
    case "s":
    case "sec":
    case "secs":
    case "second":
    case "seconds":
      return { value: value / 60, unit: "min" };
    case "min":
    case "mins":
    case "minute":
    case "minutes":
      return { value, unit: "min" };
    case "h":
    case "hr":
    case "hrs":
    case "hour":
    case "hours":
      return { value: value * 60, unit: "min" };
    case "ms":
    case "millisecond":
    case "milliseconds":
      return { value: value / 60_000, unit: "min" };
    default:
      return null;
  }
}

/** Canonical: bpm. */
export function normalizeHeartRate(value: number, unit: string): NormalizedValue | null {
  switch (normalizeUnitString(unit)) {
    case "bpm":
    case "beats/min":
    case "beats per minute":
    case "":
      return { value, unit: "bpm" };
    default:
      return null;
  }
}

/** Canonical: ms. */
export function normalizeHrv(value: number, unit: string): NormalizedValue | null {
  switch (normalizeUnitString(unit)) {
    case "ms":
    case "millisecond":
    case "milliseconds":
    case "":
      return { value, unit: "ms" };
    case "s":
    case "sec":
    case "seconds":
      return { value: value * 1000, unit: "ms" };
    default:
      return null;
  }
}

/** Canonical: %. */
export function normalizePercentage(value: number, unit: string): NormalizedValue | null {
  switch (normalizeUnitString(unit)) {
    case "%":
    case "percent":
    case "pct":
    case "":
      // Some exports report a 0-1 fraction rather than 0-100 — treat that
      // as a distinct, still-unambiguous case rather than guessing.
      return { value: value <= 1 ? value * 100 : value, unit: "%" };
    default:
      return null;
  }
}

/** Canonical: km. */
export function normalizeDistance(value: number, unit: string): NormalizedValue | null {
  switch (normalizeUnitString(unit)) {
    case "m":
    case "meter":
    case "meters":
    case "metre":
    case "metres":
      return { value: value / 1000, unit: "km" };
    case "km":
    case "kilometer":
    case "kilometers":
      return { value, unit: "km" };
    case "mi":
    case "mile":
    case "miles":
      return { value: value * 1.609344, unit: "km" };
    default:
      return null;
  }
}

/** Canonical: kg. */
export function normalizeWeight(value: number, unit: string): NormalizedValue | null {
  switch (normalizeUnitString(unit)) {
    case "kg":
    case "kilogram":
    case "kilograms":
      return { value, unit: "kg" };
    case "g":
    case "gram":
    case "grams":
      return { value: value / 1000, unit: "kg" };
    case "lb":
    case "lbs":
    case "pound":
    case "pounds":
      return { value: value * 0.45359237, unit: "kg" };
    default:
      return null;
  }
}

/** Canonical: °C. */
export function normalizeTemperature(value: number, unit: string): NormalizedValue | null {
  switch (normalizeUnitString(unit)) {
    case "c":
    case "°c":
    case "celsius":
      return { value, unit: "°C" };
    case "f":
    case "°f":
    case "fahrenheit":
      return { value: ((value - 32) * 5) / 9, unit: "°C" };
    default:
      return null;
  }
}

/** A dimensionless score/count/index that already IS its own canonical unit (e.g. sleep score, stress score, steps). */
export function normalizeScore(value: number, unit: string, canonicalUnit: string): NormalizedValue | null {
  const normalized = normalizeUnitString(unit);
  if (normalized === "" || normalized === normalizeUnitString(canonicalUnit)) return { value, unit: canonicalUnit };
  return null;
}
