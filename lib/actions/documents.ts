"use server";

import { revalidatePath } from "next/cache";
import { uploadHealthDocument } from "@/lib/services/document.service";
import {
  startExtraction,
  confirmExtraction,
  updateExtractionItemValue,
  toUiExtractedValues,
  getExtractionFailureReason,
} from "@/lib/services/extraction.service";
import { biomarkerRepo } from "@/lib/services/biomarker.service";
import { uploadDocumentSchema, validateUploadedFile, extractionItemUpdateSchema } from "@/lib/validation/document";
import { format } from "date-fns";

export async function uploadDocumentAction(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false as const, error: "Please choose a file to upload." };
  }

  const fileErrors = validateUploadedFile({ type: file.type, size: file.size, name: file.name });
  if (fileErrors.length > 0) {
    return { ok: false as const, error: fileErrors.join(" ") };
  }

  const parsed = uploadDocumentSchema.safeParse({
    type: formData.get("type") || undefined,
    providerName: formData.get("providerName") || undefined,
    documentDate: formData.get("documentDate") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid document details." };
  }

  const document = await uploadHealthDocument({
    file,
    type: parsed.data.type,
    providerName: parsed.data.providerName || undefined,
    documentDate: parsed.data.documentDate,
    notes: parsed.data.notes || undefined,
  });

  const session = await startExtraction(document.id);
  if (!session) {
    return { ok: false as const, error: "Extraction failed to start. Please try again." };
  }
  if (session.status === "FAILED") {
    revalidatePath("/profile");
    return {
      ok: false as const,
      error: getExtractionFailureReason(session.rawExtraction),
    };
  }

  revalidatePath("/profile");

  return {
    ok: true as const,
    documentId: document.id,
    sessionId: session.id,
    documentDate: session.document.documentDate ? format(session.document.documentDate, "d MMM yyyy") : null,
    values: toUiExtractedValues(session.items),
  };
}

export async function updateExtractionItemAction(itemId: string, input: unknown) {
  const parsed = extractionItemUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid value." };
  }
  await updateExtractionItemValue(itemId, parsed.data);
  return { ok: true as const };
}

/** Populates the "map this marker to a known biomarker" dropdown for unrecognized extraction items. */
export async function listBiomarkerDefinitionsForMappingAction() {
  const definitions = await biomarkerRepo.listBiomarkerDefinitions();
  return definitions.map((d) => ({ id: d.id, displayName: d.displayName, category: d.category }));
}

export async function confirmExtractionAction(sessionId: string) {
  const result = await confirmExtraction(sessionId);
  revalidatePath("/profile");
  revalidatePath("/timeline");
  revalidatePath("/body");
  revalidatePath("/");
  return { ok: true as const, ...result };
}
