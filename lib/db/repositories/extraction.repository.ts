import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";

export async function createExtractionSession(data: Prisma.LabExtractionSessionCreateInput) {
  return prisma.labExtractionSession.create({ data, include: { items: true, document: true } });
}

export async function findExtractionSession(id: string) {
  return prisma.labExtractionSession.findUnique({
    where: { id },
    include: {
      document: true,
      items: {
        include: { suggestedBiomarkerDefinition: true, finalBiomarkerDefinition: true },
      },
    },
  });
}

export async function updateExtractionSessionStatus(
  id: string,
  status: Prisma.LabExtractionSessionUpdateInput["status"]
) {
  return prisma.labExtractionSession.update({ where: { id }, data: { status } });
}

export async function updateExtractionSession(id: string, data: Prisma.LabExtractionSessionUpdateInput) {
  return prisma.labExtractionSession.update({ where: { id }, data });
}

export async function createExtractionItems(items: Prisma.LabExtractionItemCreateManyInput[]) {
  return prisma.labExtractionItem.createMany({ data: items });
}

export async function updateExtractionItem(id: string, data: Prisma.LabExtractionItemUpdateInput) {
  return prisma.labExtractionItem.update({ where: { id }, data });
}

export async function findExtractionItem(id: string) {
  return prisma.labExtractionItem.findUnique({ where: { id } });
}
