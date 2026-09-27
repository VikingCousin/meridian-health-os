import * as wearableRepo from "@/lib/db/repositories/wearable.repository";
import type { HealthDataSource } from "@/lib/generated/prisma/client";

/**
 * The Amazfit/Zepp connection is a single well-known row, created lazily on
 * first visit to the data-sources UI rather than seeded — so a fresh
 * database starts with "Not configured" instead of a fake "Connected" state.
 */
export async function getOrCreateAmazfitDataSource(): Promise<HealthDataSource> {
  const existing = await wearableRepo.findDataSourceByProvider("AMAZFIT");
  if (existing) return existing;
  return wearableRepo.createDataSource({
    type: "WEARABLE",
    provider: "AMAZFIT",
    displayName: "Amazfit Helio Strap",
    deviceName: "Helio Strap",
    status: "NOT_CONFIGURED",
    metadata: {},
  });
}

export async function listImportHistory(dataSourceId: string) {
  return wearableRepo.listImportSessions(dataSourceId);
}

export async function getImportSessionDetail(id: string) {
  return wearableRepo.findImportSession(id);
}

export async function getAmazfitSummary() {
  const dataSource = await getOrCreateAmazfitDataSource();
  const summary = await wearableRepo.summarizeDataSource(dataSource.id);
  const importHistory = await wearableRepo.listImportSessions(dataSource.id);
  return { dataSource, ...summary, importHistory };
}
