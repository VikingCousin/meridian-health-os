// Pure, deterministic statistics used by every analytics service. No LLM
// call ever computes any of these — see docs/ANALYTICS_ARCHITECTURE.md.

export function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** Linear-interpolation percentile (0-100), the common "inclusive" method. */
export function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0];
  const rank = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (rank - lower);
}

/** Sample standard deviation (n-1 denominator); 0 for a single point. */
export function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * Ordinary least-squares regression of value against day-offset-from-first-point.
 * Returns slope (units/day) and R². Used only for trend direction/strength,
 * never presented to the user as a causal model.
 */
export function linearRegression(points: { day: number; value: number }[]): { slope: number; intercept: number; rSquared: number } {
  const n = points.length;
  const xMean = mean(points.map((p) => p.day));
  const yMean = mean(points.map((p) => p.value));
  let ssXY = 0;
  let ssXX = 0;
  let ssYY = 0;
  for (const p of points) {
    const dx = p.day - xMean;
    const dy = p.value - yMean;
    ssXY += dx * dy;
    ssXX += dx * dx;
    ssYY += dy * dy;
  }
  if (ssXX === 0) return { slope: 0, intercept: yMean, rSquared: 0 };
  const slope = ssXY / ssXX;
  const intercept = yMean - slope * xMean;
  const rSquared = ssYY === 0 ? 0 : (ssXY * ssXY) / (ssXX * ssYY);
  return { slope, intercept, rSquared: n < 2 ? 0 : rSquared };
}

/**
 * Pooled standard deviation for two independent groups (the standard formula
 * for a two-sample comparison, not just one group's own spread):
 *
 *   sqrt( ((n1-1)*var1 + (n2-1)*var2) / (n1+n2-2) )
 *
 * Returns `null` when there are fewer than 2 total degrees of freedom
 * (n1+n2 <= 2) — there is no defined pooled spread to compute.
 */
export function pooledStdDev(a: number[], b: number[]): number | null {
  const n1 = a.length;
  const n2 = b.length;
  if (n1 + n2 <= 2) return null;
  const var1 = n1 > 1 ? stdDev(a) ** 2 : 0;
  const var2 = n2 > 1 ? stdDev(b) ** 2 : 0;
  const pooledVariance = ((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2);
  return Math.sqrt(pooledVariance);
}

/**
 * Standardized mean difference between two independent groups using pooled
 * SD as the denominator — this is Cohen's d (assuming roughly equal
 * population variances, the standard assumption for pooled-SD d). Returns
 * `null` (never `Infinity`/`NaN`) when either mean is undefined or the
 * pooled SD is zero or undefined — a genuinely undefined effect size should
 * read as "not available," not as a fabricated number.
 */
export function standardizedMeanDifference(mean1: number | undefined, mean2: number | undefined, pooledSD: number | null): number | null {
  if (mean1 === undefined || mean2 === undefined || pooledSD === null || pooledSD === 0) return null;
  const result = (mean1 - mean2) / pooledSD;
  return Number.isFinite(result) ? result : null;
}

export type DayContext = "WEEKDAY" | "WEEKEND";

/**
 * Classifies a date as WEEKDAY or WEEKEND for context-matched control
 * selection. Friday is grouped with the weekend ("Friday-night" behavior
 * patterns tend to resemble Saturday more than Monday) — this is a
 * deliberate, documented simplification, not a calendar fact.
 */
export function classifyDayContext(date: Date): DayContext {
  const day = date.getUTCDay(); // 0=Sun ... 6=Sat, matches the UTC-midnight dates used throughout this dataset
  return day === 0 || day === 5 || day === 6 ? "WEEKEND" : "WEEKDAY";
}

/**
 * IQR-based extreme-value diagnostic (Tukey fences: outside
 * [Q1 - 1.5*IQR, Q3 + 1.5*IQR]). This is a transparency signal, not a
 * filter — callers must not silently drop these values. Returns 0 when
 * there are too few points (< 4) to define quartiles meaningfully.
 */
export function iqrOutlierCount(values: number[]): number {
  if (values.length < 4) return 0;
  const q1 = percentile(values, 25);
  const q3 = percentile(values, 75);
  const iqr = q3 - q1;
  const lower = q1 - 1.5 * iqr;
  const upper = q3 + 1.5 * iqr;
  return values.filter((v) => v < lower || v > upper).length;
}

export function relativeChangePct(from: number, to: number): number | undefined {
  if (from === 0) return undefined;
  return ((to - from) / Math.abs(from)) * 100;
}

export function daysBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24);
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
