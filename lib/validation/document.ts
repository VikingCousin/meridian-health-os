import { z } from "zod";

export const documentTypeSchema = z.enum([
  "LAB_REPORT",
  "DOCTOR_LETTER",
  "MICROBIOME_REPORT",
  "BODY_COMPOSITION",
  "OTHER",
]);

export const ACCEPTED_DOCUMENT_MIME_TYPES = ["application/pdf", "image/jpeg", "image/jpg", "image/png"] as const;
export const MAX_DOCUMENT_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

export const uploadDocumentSchema = z.object({
  type: documentTypeSchema.default("LAB_REPORT"),
  providerName: z.string().trim().max(120).optional().or(z.literal("")),
  documentDate: z.coerce.date().optional(),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

export function validateUploadedFile(file: { type: string; size: number; name: string }) {
  const errors: string[] = [];
  if (!ACCEPTED_DOCUMENT_MIME_TYPES.includes(file.type as (typeof ACCEPTED_DOCUMENT_MIME_TYPES)[number])) {
    errors.push(`Unsupported file type "${file.type || "unknown"}". Accepted: PDF, JPG, PNG.`);
  }
  if (file.size <= 0) {
    errors.push("The selected file appears to be empty.");
  }
  if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
    errors.push("File is larger than the 20 MB limit.");
  }
  return errors;
}

export const extractionItemUpdateSchema = z.object({
  value: z.coerce.number().finite("Enter a valid number."),
  unit: z.string().trim().min(1, "Unit is required.").max(30),
  accepted: z.coerce.boolean().default(true),
  finalBiomarkerDefinitionId: z.string().trim().min(1).optional(),
});
