import { mean, median, stdDev, relativeChangePct, pooledStdDev, standardizedMeanDifference, classifyDayContext, iqrOutlierCount } from "@/lib/analytics/stats";
import { computeBaseline } from "@/lib/analytics/baseline.service";
import { computeTrend } from "@/lib/analytics/trend.service";
import { resolveLagDayOffset } from "@/lib/analytics/lag";
import type { AssociationCandidate } from "@/lib/analytics/association-registry";
import type { AssociationOccasion, AssociationResult, EventLag, GroupStats, LocalControlStats, MatchingStrategy } from "@/lib/analytics/types";
import type { SeriesPoint } from "@/lib/analytics/baseline.service";
import { loadMetricSeries } from "@/lib/analytics/baseline.service";
import * as normalizedEventRepo from "@/lib/db/repositories/normalized-event.repository";

/** Below this many occasions, a group comparison would be noise, not a pattern. Applies to both the exposure group and the global-control fallback. */
export const MIN_GROUP_SIZE = 3;
/** ±this many days around an exposure occasion when building its local control window — see docs/ANALYTICS_ARCHITECTURE.md. */
export const LOCAL_WINDOW_DAYS = 14;
/** Below this many pooled local-control points, local control is reported as LIMITED_CONTROL_DATA and the primary comparison falls back to global control. */
export const MIN_LOCAL_CONTROL = 5;
/** A trend across the full outcome series beyond this magnitude is flagged as temporal drift. */
export const TEMPORAL_DRIFT_THRESHOLD_PCT = 15;
/** Exposure occasions with a recorded source confidence below this are counted as "low confidence" — an internal analysis weight, not a medical reliability score. */
export const LOW_SOURCE_CONFIDENCE_THRESHOLD = 0.6;

export interface ExposureOccurrence {
  id: string;
  date: Date;
  /** Carried over from the originating NormalizedHealthEvent's confidence, when available. */
  confidence?: number;
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, days: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + days);
  return result;
}

function toGroupStats(values: number[]): GroupStats {
  if (values.length === 0) return { n: 0 };
  return { n: values.length, mean: mean(values), median: median(values), stdDev: stdDev(values) };
}

export interface ComputeAssociationInput {
  exposureType: string;
  outcomeMetricKey: string;
  lag: EventLag;
  /** The exposure occurrences, each traceable back to its source NormalizedHealthEvent. */
  exposures: ExposureOccurrence[];
  /** Full history of the outcome metric. */
  outcomeSeries: SeriesPoint[];
  /** All exposure-day event types (including the exposure itself), keyed by ISO date, for confounding awareness. */
  eventsByDate?: Map<string, string[]>;
  /** Reference date for the personal-baseline comparison; defaults to the latest outcome date used. */
  baselineAsOf?: Date;
  /** Override for LOCAL_WINDOW_DAYS — exposed mainly for tests. */
  localWindowDays?: number;
}

interface LocalControlBuild {
  stats: LocalControlStats;
  values: number[];
}

/**
 * Builds the local control comparison for a candidate: for each exposure
 * occasion, gathers non-exposure days with valid outcome data within
 * ±windowDays, excluding every occurrence date of this same exposure type
 * (not just the ones with matching outcome data). Prefers day-context
 * (weekday/weekend) matched days when there are enough of them; otherwise
 * falls back to the full local window; otherwise reports
 * LIMITED_CONTROL_DATA so the caller can fall back to global control
 * without silently substituting one for the other.
 */
function buildLocalControl(
  pairs: { outcomeDate: Date }[],
  outcomeSeries: SeriesPoint[],
  excludedDateKeys: Set<string>,
  windowDays: number
): LocalControlBuild {
  // Deduplicated by calendar date: a day within ±windowDays of more than one
  // exposure occasion must still only contribute its value once — otherwise
  // overlapping windows would silently over-weight (and inflate the count
  // of) whichever control days happen to sit near several occasions.
  const nearbyByDate = new Map<string, number>();
  const contextMatchedDates = new Set<string>();

  for (const pair of pairs) {
    const windowStart = addDays(pair.outcomeDate, -windowDays).getTime();
    const windowEnd = addDays(pair.outcomeDate, windowDays).getTime();
    const targetContext = classifyDayContext(pair.outcomeDate);
    for (const point of outcomeSeries) {
      const t = point.date.getTime();
      if (t < windowStart || t > windowEnd) continue;
      const key = dateKey(point.date);
      if (excludedDateKeys.has(key)) continue;
      nearbyByDate.set(key, point.value);
      if (classifyDayContext(point.date) === targetContext) contextMatchedDates.add(key);
    }
  }

  const allNearby = [...nearbyByDate.values()];
  const contextMatched = [...contextMatchedDates].map((key) => nearbyByDate.get(key)!);

  let values: number[];
  let matchingStrategy: MatchingStrategy;
  let status: LocalControlStats["status"];

  if (contextMatched.length >= MIN_LOCAL_CONTROL) {
    values = contextMatched;
    matchingStrategy = "DAY_CONTEXT_LOCAL";
    status = "VALID";
  } else if (allNearby.length >= MIN_LOCAL_CONTROL) {
    values = allNearby;
    matchingStrategy = "LOCAL_WINDOW";
    status = "VALID";
  } else {
    values = allNearby;
    matchingStrategy = "INSUFFICIENT";
    status = "LIMITED_CONTROL_DATA";
  }

  const base = toGroupStats(values);
  return { stats: { ...base, windowDays, matchingStrategy, status }, values };
}

/**
 * Pure, deterministic exposure-vs-control comparison. Does not touch the
 * database — see evaluateAssociation() for the DB-wired version — so this is
 * directly unit-testable with hand-built series.
 */
export function computeAssociation(input: ComputeAssociationInput): AssociationResult {
  const offset = resolveLagDayOffset(input.lag);
  const outcomeByDate = new Map(input.outcomeSeries.map((p) => [dateKey(p.date), p.value]));

  const pairs = input.exposures
    .map((exposure) => {
      const outcomeDate = addDays(exposure.date, offset);
      const value = outcomeByDate.get(dateKey(outcomeDate));
      return value === undefined ? null : { exposure, outcomeDate, value };
    })
    .filter((p): p is { exposure: ExposureOccurrence; outcomeDate: Date; value: number } => p !== null);

  const missingOutcomeCount = input.exposures.length - pairs.length;

  // Excluded from BOTH control groups: every occurrence date of this exposure
  // type AND its lag-mapped outcome-equivalent date — not just the ones with
  // matching outcome data (an occasion we couldn't pair is still a real
  // exposure day), and not just the outcome day (the exposure day itself is
  // also not a fair "unexposed" comparison day for a different occasion's window).
  const excludedDateKeys = new Set<string>();
  for (const e of input.exposures) {
    excludedDateKeys.add(dateKey(e.date));
    excludedDateKeys.add(dateKey(addDays(e.date, offset)));
  }

  const globalControlValues = input.outcomeSeries.filter((p) => !excludedDateKeys.has(dateKey(p.date))).map((p) => p.value);
  const exposureValues = pairs.map((p) => p.value);

  const exposureGroup = toGroupStats(exposureValues);
  const globalControl = toGroupStats(globalControlValues);

  const windowDays = input.localWindowDays ?? LOCAL_WINDOW_DAYS;
  const localControlBuild = buildLocalControl(pairs, input.outcomeSeries, excludedDateKeys, windowDays);
  const localControl = localControlBuild.stats;

  const primaryControlSource: "LOCAL" | "GLOBAL" = localControl.status === "VALID" ? "LOCAL" : "GLOBAL";
  const primaryValues = primaryControlSource === "LOCAL" ? localControlBuild.values : globalControlValues;
  const primaryStats = primaryControlSource === "LOCAL" ? localControl : globalControl;

  const confounding = summarizeConfounding(
    input.exposureType,
    pairs.map((p) => p.exposure.date),
    input.eventsByDate
  );

  const drift = computeTrend(input.outcomeSeries);
  const temporalDriftDetected =
    drift.status === "VALID" && drift.direction !== "STABLE" && Math.abs(drift.relativeChangePct ?? 0) >= TEMPORAL_DRIFT_THRESHOLD_PCT;

  const confidenceValues = input.exposures.map((e) => e.confidence).filter((c): c is number => c !== undefined);
  const sourceConfidence = {
    average: confidenceValues.length > 0 ? mean(confidenceValues) : undefined,
    lowConfidenceCount: confidenceValues.filter((c) => c < LOW_SOURCE_CONFIDENCE_THRESHOLD).length,
  };

  const outlierCountExposure = iqrOutlierCount(exposureValues);
  const outlierCountControl = iqrOutlierCount(primaryValues);

  const reasons: string[] = [];
  if (exposureGroup.n < MIN_GROUP_SIZE) reasons.push(`Only ${exposureGroup.n} exposure occasion(s) have matching outcome data`);
  if (globalControl.n < MIN_GROUP_SIZE) reasons.push(`Only ${globalControl.n} non-exposure day(s) available for a control comparison`);

  if (reasons.length > 0) {
    return {
      exposureType: input.exposureType,
      outcomeMetricKey: input.outcomeMetricKey,
      lag: input.lag,
      exposureGroup,
      localControl,
      globalControl,
      primaryControlSource,
      effect: { standardizedDifference: null },
      quality: { missingOutcomeCount, outlierCountExposure, outlierCountControl, temporalDriftDetected, confounding, sourceConfidence },
      supportingCount: 0,
      contradictingCount: 0,
      occasions: [],
      status: "INSUFFICIENT_DATA",
      reasons,
    };
  }

  const exposureMean = exposureGroup.mean!;
  const primaryMean = primaryStats.mean!;
  const meanDifference = exposureMean - primaryMean;
  const medianDifference = exposureGroup.median! - primaryStats.median!;
  const relativeDifferencePct = relativeChangePct(primaryMean, exposureMean);
  const standardizedDifference = standardizedMeanDifference(exposureMean, primaryMean, pooledStdDev(exposureValues, primaryValues));

  const direction = meanDifference < 0 ? "decrease" : meanDifference > 0 ? "increase" : "none";
  const occasions: AssociationOccasion[] = pairs.map((p) => {
    const isSupporting = direction === "decrease" ? p.value < primaryMean : direction === "increase" ? p.value > primaryMean : false;
    return {
      exposureEventId: p.exposure.id,
      exposureDate: p.exposure.date.toISOString(),
      outcomeDate: p.outcomeDate.toISOString(),
      value: p.value,
      role: isSupporting ? "SUPPORTING" : "CONTRADICTING",
      confidence: p.exposure.confidence,
    };
  });
  const supportingCount = occasions.filter((o) => o.role === "SUPPORTING").length;
  const contradictingCount = occasions.filter((o) => o.role === "CONTRADICTING").length;

  const baselineAsOf = input.baselineAsOf ?? pairs[pairs.length - 1].outcomeDate;
  const baseline = computeBaseline(input.outcomeSeries, 30, baselineAsOf);
  const personalBaseline =
    baseline.status === "VALID"
      ? { n: baseline.count, mean: baseline.mean, median: baseline.median, stdDev: baseline.stdDev, windowDays: 30 as const }
      : undefined;

  return {
    exposureType: input.exposureType,
    outcomeMetricKey: input.outcomeMetricKey,
    lag: input.lag,
    exposureGroup,
    localControl,
    globalControl,
    primaryControlSource,
    personalBaseline,
    effect: { meanDifference, medianDifference, relativeDifferencePct, standardizedDifference },
    quality: { missingOutcomeCount, outlierCountExposure, outlierCountControl, temporalDriftDetected, confounding, sourceConfidence },
    supportingCount,
    contradictingCount,
    occasions,
    status: "VALID",
  };
}

function summarizeConfounding(exposureType: string, exposureDates: Date[], eventsByDate?: Map<string, string[]>) {
  const total = exposureDates.length;
  if (!eventsByDate || total === 0) {
    return { totalExposureOccasions: total, overlapOccasions: 0, coOccurringCounts: [], note: "No confounding data available." };
  }
  const counts = new Map<string, number>();
  let overlapOccasions = 0;
  for (const date of exposureDates) {
    const others = (eventsByDate.get(dateKey(date)) ?? []).filter((t) => t !== exposureType);
    if (others.length > 0) overlapOccasions++;
    for (const type of new Set(others)) counts.set(type, (counts.get(type) ?? 0) + 1);
  }
  const coOccurringCounts = [...counts.entries()].map(([eventType, count]) => ({ eventType, count }));
  const note =
    overlapOccasions > 0
      ? `Other recorded factors were present on ${overlapOccasions} of ${total} occasions.`
      : "No other recorded factors overlapped with these occasions.";
  return { totalExposureOccasions: total, overlapOccasions, coOccurringCounts, note };
}

/** DB-wired version of computeAssociation for one registry candidate. */
export async function evaluateAssociation(candidate: AssociationCandidate): Promise<AssociationResult> {
  const [exposureEvents, outcomeSeries, allEvents] = await Promise.all([
    normalizedEventRepo.listEventsByType(candidate.exposureType),
    loadMetricSeries(candidate.outcomeMetricKey),
    normalizedEventRepo.listAllEvents(),
  ]);

  const eventsByDate = new Map<string, string[]>();
  for (const event of allEvents) {
    const key = dateKey(event.occurredAt);
    eventsByDate.set(key, [...(eventsByDate.get(key) ?? []), event.type]);
  }

  return computeAssociation({
    exposureType: candidate.exposureType,
    outcomeMetricKey: candidate.outcomeMetricKey,
    lag: candidate.lag,
    exposures: exposureEvents.map((e) => ({ id: e.id, date: e.occurredAt, confidence: e.confidence ?? undefined })),
    outcomeSeries,
    eventsByDate,
  });
}
