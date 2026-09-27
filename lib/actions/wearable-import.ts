"use server";

import { revalidatePath } from "next/cache";
import { extractSupportedFiles, isZipFile, ZipSecurityError } from "@/lib/wearables/importers/zip-utils";
import { inspectWearableFiles, importWearableFiles } from "@/lib/wearables/services/wearable-import.service";
import { computeFingerprint } from "@/lib/wearables/fingerprint";
import { getOrCreateAmazfitDataSource } from "@/lib/services/wearable-data-source.service";
import type { WearableInputFile, WearableSourceType } from "@/lib/wearables/types";

/** Untrusted files only ever get read as text/extracted in memory here — nothing is written to disk. */
async function filesFromFormData(formData: FormData): Promise<WearableInputFile[]> {
  const files: WearableInputFile[] = [];
  for (const entry of formData.getAll("files")) {
    if (!(entry instanceof File)) continue;
    const bytes = new Uint8Array(await entry.arrayBuffer());
    if (isZipFile(entry.name)) {
      files.push(...(await extractSupportedFiles(bytes)));
    } else {
      files.push({ name: entry.name, content: Buffer.from(bytes).toString("utf8") });
    }
  }
  return files;
}

function errorMessage(err: unknown): string {
  if (err instanceof ZipSecurityError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong reading the selected file(s).";
}

export async function inspectWearableImportAction(formData: FormData) {
  const sourceType = formData.get("sourceType") as WearableSourceType | null;
  if (!sourceType) return { ok: false as const, error: "No source selected." };

  try {
    const files = await filesFromFormData(formData);
    if (files.length === 0) return { ok: false as const, error: "No readable files were found in your selection." };
    const result = inspectWearableFiles(files, sourceType);
    if (!result.ok) return { ok: false as const, error: result.error };
    return { ok: true as const, inspection: result.inspection };
  } catch (err) {
    return { ok: false as const, error: errorMessage(err) };
  }
}

export async function importWearableFilesAction(formData: FormData) {
  const sourceType = formData.get("sourceType") as WearableSourceType | null;
  if (!sourceType) return { ok: false as const, error: "No source selected." };

  try {
    const files = await filesFromFormData(formData);
    if (files.length === 0) return { ok: false as const, error: "No readable files were found in your selection." };

    const dataSource = await getOrCreateAmazfitDataSource();
    const fileHash = computeFingerprint(files.map((f) => `${f.name}:${f.content.length}`).sort());
    const uploadedNames = formData
      .getAll("files")
      .filter((f): f is File => f instanceof File)
      .map((f) => f.name)
      .join(", ");

    const result = await importWearableFiles({
      dataSourceId: dataSource.id,
      provider: sourceType,
      files,
      forcedSourceType: sourceType,
      originalFileName: uploadedNames,
      fileHash,
    });

    revalidatePath("/profile");
    revalidatePath("/profile/data-sources");
    revalidatePath("/");
    revalidatePath("/body", "layout");

    return { ok: true as const, result };
  } catch (err) {
    return { ok: false as const, error: errorMessage(err) };
  }
}
