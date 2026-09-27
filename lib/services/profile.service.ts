import * as profileRepo from "@/lib/db/repositories/profile.repository";
import * as medicalRepo from "@/lib/db/repositories/medical.repository";
import type { ProfileFormInput } from "@/lib/validation/profile";

// Deliberately NOT "Alex" (the demo persona's name) — a fresh, never-seeded
// real-user database must never silently look like the demo dataset. See
// docs/DATA_MODEL.md, "Real-user mode."
export const NEUTRAL_PROFILE_FIRST_NAME = "You";

const FALLBACK_PROFILE = {
  firstName: NEUTRAL_PROFILE_FIRST_NAME,
  dateOfBirth: new Date("1990-01-01"),
  heightCm: 178,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC",
};

/** Single-user app: returns the one profile, creating a minimal default if none exists yet (e.g. before seeding). */
export async function getOrCreateProfile() {
  const existing = await profileRepo.findProfile();
  if (existing) return existing;
  return profileRepo.createProfile(FALLBACK_PROFILE);
}

export async function updateProfileDetails(id: string, input: ProfileFormInput) {
  return profileRepo.updateProfile(id, {
    firstName: input.firstName,
    lastName: input.lastName || null,
    dateOfBirth: input.dateOfBirth,
    biologicalSex: input.biologicalSex,
    heightCm: input.heightCm,
    currentWeightKg: input.currentWeightKg,
    timezone: input.timezone,
    occupation: input.occupation || null,
    activityLevel: input.activityLevel,
    generalHealthNotes: input.generalHealthNotes || null,
  });
}

export async function getProfileBundle() {
  const profile = await getOrCreateProfile();
  const [medicalHistory, medications, supplements] = await Promise.all([
    medicalRepo.listMedicalHistory(profile.id),
    medicalRepo.listMedications(profile.id),
    medicalRepo.listSupplements(profile.id),
  ]);
  return { profile, medicalHistory, medications, supplements };
}

export { medicalRepo };
