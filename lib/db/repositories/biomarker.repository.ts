import { prisma } from "@/lib/db/prisma";
import type { Prisma, BodySystem } from "@/lib/generated/prisma/client";

export async function listBiomarkerDefinitions() {
  return prisma.biomarkerDefinition.findMany({ orderBy: { displayName: "asc" } });
}

export async function findBiomarkerDefinitionByKey(canonicalKey: string) {
  return prisma.biomarkerDefinition.findUnique({ where: { canonicalKey } });
}

export async function findBiomarkerDefinitionById(id: string) {
  return prisma.biomarkerDefinition.findUnique({ where: { id } });
}

export async function listBiomarkerDefinitionsBySystem(bodySystem: BodySystem) {
  return prisma.biomarkerDefinition.findMany({
    where: { bodySystem },
    orderBy: { displayName: "asc" },
  });
}

export async function createBiomarkerDefinition(data: Prisma.BiomarkerDefinitionCreateInput) {
  return prisma.biomarkerDefinition.create({ data });
}

export async function listMeasurementsForDefinition(biomarkerDefinitionId: string) {
  return prisma.biomarkerMeasurement.findMany({
    where: { biomarkerDefinitionId },
    orderBy: { measuredAt: "asc" },
    include: { sourceDocument: true, dataSource: true },
  });
}

export async function findLatestMeasurement(biomarkerDefinitionId: string) {
  return prisma.biomarkerMeasurement.findFirst({
    where: { biomarkerDefinitionId },
    orderBy: { measuredAt: "desc" },
    include: { sourceDocument: true, dataSource: true },
  });
}

export async function listLatestMeasurementsForDefinitions(biomarkerDefinitionIds: string[]) {
  // SQLite/Prisma has no native "distinct on" with ordering guarantee across
  // relations, so fetch all and reduce in memory — fine at this data scale.
  const rows = await prisma.biomarkerMeasurement.findMany({
    where: { biomarkerDefinitionId: { in: biomarkerDefinitionIds } },
    orderBy: { measuredAt: "asc" },
    include: { sourceDocument: true, dataSource: true },
  });
  const latestByDefinition = new Map<string, (typeof rows)[number]>();
  for (const row of rows) latestByDefinition.set(row.biomarkerDefinitionId, row);
  return latestByDefinition;
}

export async function listAllMeasurementsForDefinitions(biomarkerDefinitionIds: string[]) {
  return prisma.biomarkerMeasurement.findMany({
    where: { biomarkerDefinitionId: { in: biomarkerDefinitionIds } },
    orderBy: { measuredAt: "asc" },
    include: { sourceDocument: true, dataSource: true },
  });
}

export async function createMeasurement(data: Prisma.BiomarkerMeasurementCreateInput) {
  return prisma.biomarkerMeasurement.create({ data });
}

export async function listRecentMeasurements(limit: number) {
  return prisma.biomarkerMeasurement.findMany({
    orderBy: { measuredAt: "desc" },
    take: limit,
    include: { biomarkerDefinition: true, sourceDocument: true, dataSource: true },
  });
}
