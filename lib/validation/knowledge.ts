import { z } from "zod";

export const knowledgeSourceTypeSchema = z.enum([
  "CURATED",
  "USER_NOTES",
  "NOTEBOOKLM_EXPORT",
  "GUIDELINE",
  "RESEARCH_SUMMARY",
  "OTHER",
]);

export const ACCEPTED_KNOWLEDGE_EXTENSIONS = [".md", ".markdown", ".txt"] as const;
export const MAX_KNOWLEDGE_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB — text only, generous for any real note set

export function validateUploadedKnowledgeFile(file: { size: number; name: string }) {
  const errors: string[] = [];
  const lower = file.name.toLowerCase();
  if (!ACCEPTED_KNOWLEDGE_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
    errors.push("Unsupported file type. Accepted: .md, .markdown, .txt.");
  }
  if (file.size <= 0) {
    errors.push("The selected file appears to be empty.");
  }
  if (file.size > MAX_KNOWLEDGE_FILE_SIZE_BYTES) {
    errors.push("File is larger than the 2 MB limit.");
  }
  return errors;
}

export const importKnowledgeSchema = z.object({
  sourceType: knowledgeSourceTypeSchema.default("USER_NOTES"),
  sourceNameOverride: z.string().trim().max(120).optional().or(z.literal("")),
});
