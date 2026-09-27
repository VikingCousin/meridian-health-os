"use server";

import { revalidatePath } from "next/cache";
import { getOrCreateProfile, updateProfileDetails, medicalRepo } from "@/lib/services/profile.service";
import {
  profileFormSchema,
  medicalHistoryFormSchema,
  medicationFormSchema,
  supplementFormSchema,
} from "@/lib/validation/profile";

export async function updateProfileAction(input: unknown) {
  const parsed = profileFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid profile." };
  }
  const profile = await getOrCreateProfile();
  const updated = await updateProfileDetails(profile.id, parsed.data);
  revalidatePath("/profile");
  return { ok: true as const, profile: updated };
}

export async function addMedicalHistoryAction(input: unknown) {
  const parsed = medicalHistoryFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid entry." };

  const profile = await getOrCreateProfile();
  await medicalRepo.createMedicalHistory({
    profile: { connect: { id: profile.id } },
    condition: parsed.data.condition,
    diagnosisDate: parsed.data.diagnosisDate,
    status: parsed.data.status,
    notes: parsed.data.notes || undefined,
    source: parsed.data.source,
  });
  revalidatePath("/profile");
  return { ok: true as const };
}

export async function addMedicationAction(input: unknown) {
  const parsed = medicationFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid entry." };

  const profile = await getOrCreateProfile();
  await medicalRepo.createMedication({
    profile: { connect: { id: profile.id } },
    name: parsed.data.name,
    dose: parsed.data.dose,
    unit: parsed.data.unit || undefined,
    frequency: parsed.data.frequency || undefined,
    startedAt: parsed.data.startedAt,
    stoppedAt: parsed.data.stoppedAt,
    active: parsed.data.active,
    notes: parsed.data.notes || undefined,
  });
  revalidatePath("/profile");
  return { ok: true as const };
}

export async function addSupplementAction(input: unknown) {
  const parsed = supplementFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid entry." };

  const profile = await getOrCreateProfile();
  await medicalRepo.createSupplement({
    profile: { connect: { id: profile.id } },
    name: parsed.data.name,
    productName: parsed.data.productName || undefined,
    dose: parsed.data.dose,
    unit: parsed.data.unit || undefined,
    frequency: parsed.data.frequency || undefined,
    startedAt: parsed.data.startedAt,
    stoppedAt: parsed.data.stoppedAt,
    active: parsed.data.active,
    notes: parsed.data.notes || undefined,
  });
  revalidatePath("/profile");
  return { ok: true as const };
}
