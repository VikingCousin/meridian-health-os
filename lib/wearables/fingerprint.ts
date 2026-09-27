import { createHash } from "node:crypto";

/**
 * Deterministic fallback id for a record that has no native external id.
 * Used only when the source format doesn't supply one — a native id (when
 * available) is always preferred, since it survives a value correction on
 * re-export better than a value-based hash would. Re-importing the exact
 * same file/record must always produce the exact same fingerprint, so
 * re-imports are recognized as duplicates rather than re-inserted.
 */
export function computeFingerprint(parts: (string | number)[]): string {
  const hash = createHash("sha256");
  hash.update(parts.join("|"));
  return `fp_${hash.digest("hex").slice(0, 32)}`;
}

export function measurementFingerprint(params: { provider: string; metricKey: string; measuredAt: Date; value: number; unit: string }): string {
  return computeFingerprint([params.provider, params.metricKey, params.measuredAt.toISOString(), params.value, params.unit]);
}

export function sleepSessionFingerprint(params: { provider: string; startedAt: Date; endedAt: Date }): string {
  return computeFingerprint([params.provider, "sleep", params.startedAt.toISOString(), params.endedAt.toISOString()]);
}

export function workoutFingerprint(params: { provider: string; type: string; startedAt: Date; endedAt: Date }): string {
  return computeFingerprint([params.provider, "workout", params.type, params.startedAt.toISOString(), params.endedAt.toISOString()]);
}
