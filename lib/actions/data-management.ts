"use server";

import { revalidatePath } from "next/cache";
import { createBackup, exportUserDataZip, getBackupStatus } from "@/lib/services/data-management.service";
import { getAppSettings, setDemoMode, setExternalAiEnabled } from "@/lib/services/settings.service";

export async function createBackupAction() {
  try {
    const result = await createBackup();
    revalidatePath("/profile");
    return { ok: true as const, ...result, createdAt: result.createdAt.toISOString() };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Backup failed." };
  }
}

export async function getBackupStatusAction() {
  const status = await getBackupStatus();
  return { ...status, lastBackupAt: status.lastBackupAt?.toISOString() ?? null };
}

/** Returns the archive as base64 — the client turns it into a downloadable Blob. Nothing is uploaded anywhere. */
export async function exportUserDataAction() {
  try {
    const buffer = await exportUserDataZip();
    return { ok: true as const, base64: buffer.toString("base64"), fileName: `meridian-export-${new Date().toISOString().slice(0, 10)}.zip` };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Export failed." };
  }
}

export async function getAppSettingsAction() {
  const settings = await getAppSettings();
  return { demoMode: settings.demoMode, externalAiEnabled: settings.externalAiEnabled };
}

export async function setDemoModeAction(demoMode: boolean) {
  await setDemoMode(demoMode);
  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function setExternalAiEnabledAction(externalAiEnabled: boolean) {
  await setExternalAiEnabled(externalAiEnabled);
  revalidatePath("/", "layout");
  return { ok: true as const };
}
