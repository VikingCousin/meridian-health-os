// Timestamp handling is where wearable imports most often go silently
// wrong. Every function here is explicit about what it assumes and never
// strips timezone information without recording what it did — see
// docs/WEARABLE_ARCHITECTURE.md, "Time / timezone."

export interface ParsedTimestamp {
  /** The instant in UTC. */
  date: Date;
  /** Minutes east of UTC, when the source told us (e.g. an explicit "+02:00" offset). Undefined when we had to assume UTC. */
  timezoneOffsetMinutes?: number;
  /** True when no explicit offset was present in the source value and UTC was assumed. */
  assumedUtc: boolean;
}

const ISO_OFFSET_RE = /([+-]\d{2}):?(\d{2})$/;

/**
 * Parses a timestamp string in one of: full ISO-8601 (with or without an
 * explicit offset/`Z`), `YYYY-MM-DD HH:mm:ss`, `YYYY-MM-DD`, or a raw epoch
 * (seconds or milliseconds, as a numeric string). Returns `null` — never a
 * guessed date — for anything else, including strings with an ambiguous or
 * missing date component.
 *
 * When `explicitOffsetMinutes` is supplied (e.g. from a separate column in
 * the export), it is used to correctly place a timestamp that was written
 * in local time without its own offset — this is preferred over assuming UTC.
 */
export function parseTimestamp(raw: string, explicitOffsetMinutes?: number): ParsedTimestamp | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Raw epoch: 10 digits = seconds, 13 digits = milliseconds.
  if (/^\d{10}$/.test(trimmed)) return { date: new Date(Number(trimmed) * 1000), assumedUtc: true };
  if (/^\d{13}$/.test(trimmed)) return { date: new Date(Number(trimmed)), assumedUtc: true };

  const offsetMatch = trimmed.match(ISO_OFFSET_RE);
  const hasZ = /z$/i.test(trimmed);

  if (offsetMatch || hasZ) {
    const date = new Date(trimmed.replace(" ", "T"));
    if (Number.isNaN(date.getTime())) return null;
    const offsetMinutes = hasZ ? 0 : Number(offsetMatch![1]) * 60 + Math.sign(Number(offsetMatch![1])) * Number(offsetMatch![2]);
    return { date, timezoneOffsetMinutes: offsetMinutes, assumedUtc: false };
  }

  // No explicit offset in the string itself.
  const isoLike = /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?$/.test(trimmed);
  if (!isoLike) return null;

  const normalized = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T");
  const withTime = /T\d{2}:\d{2}/.test(normalized) ? normalized : `${normalized}T00:00:00`;

  if (explicitOffsetMinutes !== undefined) {
    // Interpret the wall-clock time as local at the given offset, then
    // convert to the equivalent UTC instant.
    const utcMs = Date.parse(`${withTime}Z`) - explicitOffsetMinutes * 60_000;
    return { date: new Date(utcMs), timezoneOffsetMinutes: explicitOffsetMinutes, assumedUtc: false };
  }

  const date = new Date(`${withTime}Z`);
  if (Number.isNaN(date.getTime())) return null;
  return { date, assumedUtc: true };
}

/**
 * Assigns a sleep session to a calendar "sleep day": the calendar date of
 * the session's END time (when the person woke up), evaluated in the
 * session's own local time when a timezone offset is known, otherwise in
 * UTC. This matches the convention the rest of Meridian's wearable data
 * already uses (a night's sleep is dated by the wake-up morning) — see
 * docs/WEARABLE_ARCHITECTURE.md.
 *
 * Example: sleep starting 2026-09-06 23:18 and ending 2026-09-07 06:42 is
 * assigned sleep day 2026-09-07, regardless of which calendar day it started on.
 */
export function resolveSleepDay(endedAt: Date, timezoneOffsetMinutes?: number): Date {
  const local = timezoneOffsetMinutes !== undefined ? new Date(endedAt.getTime() + timezoneOffsetMinutes * 60_000) : endedAt;
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
}
