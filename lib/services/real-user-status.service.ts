import { prisma } from "@/lib/db/prisma";
import { getOrCreateProfile, NEUTRAL_PROFILE_FIRST_NAME } from "@/lib/services/profile.service";

export interface RealUserDataStatus {
  hasProfile: boolean;
  hasGoal: boolean;
  hasJournalEntry: boolean;
  hasLabData: boolean;
  hasWearableData: boolean;
  /** True only when none of the above are true — drives the first-run checklist. */
  isEmpty: boolean;
}

/**
 * A plain data-presence check — never a score, never an inference. Backs the
 * Section 14 first-run checklist and Section 2's decision not to show a fake
 * readiness ring when there's nothing real to compute one from.
 */
export async function getRealUserDataStatus(): Promise<RealUserDataStatus> {
  const profile = await getOrCreateProfile();
  const hasProfile =
    profile.firstName !== NEUTRAL_PROFILE_FIRST_NAME ||
    !!profile.lastName ||
    !!profile.biologicalSex ||
    !!profile.occupation ||
    !!profile.activityLevel ||
    !!profile.generalHealthNotes;

  const [goalCount, journalCount, labMeasurementCount, wearableMeasurementCount] = await Promise.all([
    prisma.goal.count(),
    prisma.journalEntry.count(),
    prisma.biomarkerMeasurement.count({ where: { sourceType: { in: ["LAB_REPORT", "MANUAL", "AI_EXTRACTED"] } } }),
    prisma.biomarkerMeasurement.count({ where: { sourceType: "WEARABLE" } }),
  ]);

  const hasGoal = goalCount > 0;
  const hasJournalEntry = journalCount > 0;
  const hasLabData = labMeasurementCount > 0;
  const hasWearableData = wearableMeasurementCount > 0;

  return {
    hasProfile,
    hasGoal,
    hasJournalEntry,
    hasLabData,
    hasWearableData,
    isEmpty: !hasProfile && !hasGoal && !hasJournalEntry && !hasLabData && !hasWearableData,
  };
}
