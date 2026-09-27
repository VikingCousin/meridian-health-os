import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";

export async function listDataSources() {
  return prisma.healthDataSource.findMany({ orderBy: { createdAt: "asc" } });
}

export async function findDataSource(id: string) {
  return prisma.healthDataSource.findUnique({ where: { id } });
}

export async function findDataSourceByProvider(provider: Prisma.HealthDataSourceCreateInput["provider"]) {
  return prisma.healthDataSource.findFirst({ where: { provider } });
}

export async function createDataSource(data: Prisma.HealthDataSourceCreateInput) {
  return prisma.healthDataSource.create({ data });
}

export async function updateDataSource(id: string, data: Prisma.HealthDataSourceUpdateInput) {
  return prisma.healthDataSource.update({ where: { id }, data });
}

export async function createImportSession(data: Prisma.WearableImportSessionCreateInput) {
  return prisma.wearableImportSession.create({ data });
}

export async function updateImportSession(id: string, data: Prisma.WearableImportSessionUpdateInput) {
  return prisma.wearableImportSession.update({ where: { id }, data });
}

export async function listImportSessions(dataSourceId?: string) {
  return prisma.wearableImportSession.findMany({
    where: dataSourceId ? { dataSourceId } : undefined,
    orderBy: { startedAt: "desc" },
  });
}

export async function findImportSession(id: string) {
  return prisma.wearableImportSession.findUnique({ where: { id } });
}

export interface WearableMeasurementInput {
  biomarkerDefinitionId: string;
  value: number;
  unit: string;
  measuredAt: Date;
  sourceType: "WEARABLE";
  dataSourceId: string;
  externalId: string;
}

/** Idempotent by the (dataSourceId, externalId) unique constraint — a repeat import updates nothing new, just reports a hit. */
export async function upsertMeasurement(data: WearableMeasurementInput) {
  return prisma.biomarkerMeasurement.upsert({
    where: { dataSourceId_externalId: { dataSourceId: data.dataSourceId, externalId: data.externalId } },
    create: {
      biomarkerDefinition: { connect: { id: data.biomarkerDefinitionId } },
      value: data.value,
      unit: data.unit,
      measuredAt: data.measuredAt,
      sourceType: data.sourceType,
      dataSource: { connect: { id: data.dataSourceId } },
      externalId: data.externalId,
      verified: true,
    },
    update: {},
  });
}

export async function countExistingMeasurements(dataSourceId: string, externalIds: string[]): Promise<Set<string>> {
  if (externalIds.length === 0) return new Set();
  const rows = await prisma.biomarkerMeasurement.findMany({
    where: { dataSourceId, externalId: { in: externalIds } },
    select: { externalId: true },
  });
  return new Set(rows.map((r) => r.externalId!));
}

export async function deleteDemoMeasurementsForDefinition(biomarkerDefinitionId: string) {
  return prisma.biomarkerMeasurement.deleteMany({
    where: { biomarkerDefinitionId, sourceType: "WEARABLE", dataSourceId: null },
  });
}

export interface WearableSleepSessionInput {
  dataSourceId: string;
  externalId: string;
  sleepDay: Date;
  startedAt: Date;
  endedAt: Date;
  durationMinutes: number;
  deepMinutes?: number;
  remMinutes?: number;
  lightMinutes?: number;
  awakeMinutes?: number;
  sleepScore?: number;
  averageHeartRate?: number;
  averageHrv?: number;
  averageSpo2?: number;
  respiratoryRate?: number;
  sourceMetadata: Prisma.InputJsonValue;
}

export async function upsertSleepSession(data: WearableSleepSessionInput) {
  const { dataSourceId, externalId, ...rest } = data;
  return prisma.sleepSession.upsert({
    where: { dataSourceId_externalId: { dataSourceId, externalId } },
    create: { dataSource: { connect: { id: dataSourceId } }, externalId, ...rest },
    update: {},
  });
}

export async function existingSleepExternalIds(dataSourceId: string, externalIds: string[]): Promise<Set<string>> {
  if (externalIds.length === 0) return new Set();
  const rows = await prisma.sleepSession.findMany({ where: { dataSourceId, externalId: { in: externalIds } }, select: { externalId: true } });
  return new Set(rows.map((r) => r.externalId!));
}

export interface WearableWorkoutSessionInput {
  dataSourceId: string;
  externalId: string;
  type: string;
  startedAt: Date;
  endedAt: Date;
  durationMinutes: number;
  averageHeartRate?: number;
  maxHeartRate?: number;
  trainingLoad?: number;
  distanceKm?: number;
  calories?: number;
  sourceMetadata: Prisma.InputJsonValue;
}

export async function upsertWorkoutSession(data: WearableWorkoutSessionInput) {
  const { dataSourceId, externalId, ...rest } = data;
  return prisma.workoutSession.upsert({
    where: { dataSourceId_externalId: { dataSourceId, externalId } },
    create: { dataSource: { connect: { id: dataSourceId } }, externalId, ...rest },
    update: {},
  });
}

export async function existingWorkoutExternalIds(dataSourceId: string, externalIds: string[]): Promise<Set<string>> {
  if (externalIds.length === 0) return new Set();
  const rows = await prisma.workoutSession.findMany({ where: { dataSourceId, externalId: { in: externalIds } }, select: { externalId: true } });
  return new Set(rows.map((r) => r.externalId!));
}

export async function listSleepSessions(dataSourceId?: string, limit?: number) {
  return prisma.sleepSession.findMany({
    where: dataSourceId ? { dataSourceId } : undefined,
    orderBy: { sleepDay: "desc" },
    take: limit,
  });
}

export async function findLatestSleepSession() {
  return prisma.sleepSession.findFirst({ orderBy: { sleepDay: "desc" } });
}

export async function summarizeDataSource(dataSourceId: string) {
  const [measurements, sleepSessionCount, workoutCount] = await Promise.all([
    prisma.biomarkerMeasurement.findMany({
      where: { dataSourceId },
      select: { measuredAt: true, biomarkerDefinition: { select: { canonicalKey: true, displayName: true } } },
    }),
    prisma.sleepSession.count({ where: { dataSourceId } }),
    prisma.workoutSession.count({ where: { dataSourceId } }),
  ]);

  const metricKeys = [...new Set(measurements.map((m) => m.biomarkerDefinition.canonicalKey))];
  const dates = measurements.map((m) => m.measuredAt.getTime());
  return {
    totalMeasurements: measurements.length,
    metricKeys,
    dateRangeStart: dates.length > 0 ? new Date(Math.min(...dates)) : undefined,
    dateRangeEnd: dates.length > 0 ? new Date(Math.max(...dates)) : undefined,
    sleepSessionCount,
    workoutCount,
  };
}
