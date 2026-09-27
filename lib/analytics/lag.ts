import type { EventLag } from "@/lib/analytics/types";

/**
 * Resolves a named lag to a whole-day offset from the exposure date.
 *
 * This dataset's wearable measurements are one value per calendar day, dated
 * by the morning they were recorded (i.e. "last night's sleep" is stored
 * under the wake-up date). At that granularity, SAME_NIGHT, NEXT_MORNING,
 * NEXT_NIGHT, NEXT_DAY and NEXT_24H are all satisfied by "the measurement
 * dated one calendar day after the exposure" — there is no finer-grained
 * timestamp to distinguish them. This is a deliberate, documented
 * simplification (see docs/ANALYTICS_ARCHITECTURE.md), not an
 * inconsistency: only SAME_DAY (0) and NEXT_48H (2) resolve differently.
 */
export function resolveLagDayOffset(lag: EventLag): number {
  switch (lag) {
    case "SAME_DAY":
      return 0;
    case "SAME_NIGHT":
    case "NEXT_MORNING":
    case "NEXT_NIGHT":
    case "NEXT_DAY":
    case "NEXT_24H":
      return 1;
    case "NEXT_48H":
      return 2;
  }
}
