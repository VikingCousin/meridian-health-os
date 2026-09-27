import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";

export async function listMedicalHistory(profileId: string) {
  return prisma.medicalHistory.findMany({
    where: { profileId },
    orderBy: [{ diagnosisDate: "desc" }, { createdAt: "desc" }],
  });
}

export async function createMedicalHistory(data: Prisma.MedicalHistoryCreateInput) {
  return prisma.medicalHistory.create({ data });
}

export async function updateMedicalHistory(id: string, data: Prisma.MedicalHistoryUpdateInput) {
  return prisma.medicalHistory.update({ where: { id }, data });
}

export async function deleteMedicalHistory(id: string) {
  return prisma.medicalHistory.delete({ where: { id } });
}

export async function listMedications(profileId: string) {
  return prisma.medication.findMany({
    where: { profileId },
    orderBy: [{ active: "desc" }, { startedAt: "desc" }],
  });
}

export async function createMedication(data: Prisma.MedicationCreateInput) {
  return prisma.medication.create({ data });
}

export async function updateMedication(id: string, data: Prisma.MedicationUpdateInput) {
  return prisma.medication.update({ where: { id }, data });
}

export async function deleteMedication(id: string) {
  return prisma.medication.delete({ where: { id } });
}

export async function listSupplements(profileId: string) {
  return prisma.supplement.findMany({
    where: { profileId },
    orderBy: [{ active: "desc" }, { startedAt: "desc" }],
  });
}

export async function createSupplement(data: Prisma.SupplementCreateInput) {
  return prisma.supplement.create({ data });
}

export async function updateSupplement(id: string, data: Prisma.SupplementUpdateInput) {
  return prisma.supplement.update({ where: { id }, data });
}

export async function deleteSupplement(id: string) {
  return prisma.supplement.delete({ where: { id } });
}
