"use server";

import { revalidatePath } from "next/cache";
import { importMarkdown, inspectMarkdown } from "@/lib/knowledge/knowledge.service";
import { importKnowledgeSchema, validateUploadedKnowledgeFile } from "@/lib/validation/knowledge";

async function readTextFile(formData: FormData): Promise<{ ok: true; text: string; fallbackTitle: string } | { ok: false; error: string }> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Please choose a file to import." };
  }
  const fileErrors = validateUploadedKnowledgeFile({ size: file.size, name: file.name });
  if (fileErrors.length > 0) {
    return { ok: false, error: fileErrors.join(" ") };
  }
  const text = await file.text();
  const fallbackTitle = file.name.replace(/\.(md|markdown|txt)$/i, "");
  return { ok: true, text, fallbackTitle };
}

/** Pure preview — parses the file and reports what would be imported, without writing anything. */
export async function inspectKnowledgeImportAction(formData: FormData) {
  const read = await readTextFile(formData);
  if (!read.ok) return { ok: false as const, error: read.error };

  const result = await inspectMarkdown(read.text, read.fallbackTitle);
  return {
    ok: true as const,
    title: result.parsed.title,
    topic: result.parsed.topic,
    bodySystem: result.parsed.bodySystem,
    sourceName: result.parsed.sourceName,
    sections: result.parsed.sections.map((s) => ({ heading: s.heading, preview: s.content.slice(0, 200) })),
    warnings: result.parsed.warnings,
    alreadyImported: result.alreadyImported,
  };
}

export async function importKnowledgeAction(formData: FormData) {
  const read = await readTextFile(formData);
  if (!read.ok) return { ok: false as const, error: read.error };

  const parsed = importKnowledgeSchema.safeParse({
    sourceType: formData.get("sourceType") || undefined,
    sourceNameOverride: formData.get("sourceNameOverride") || undefined,
  });
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid import details." };
  }

  const result = await importMarkdown({
    raw: read.text,
    fallbackTitle: read.fallbackTitle,
    sourceType: parsed.data.sourceType,
    sourceNameOverride: parsed.data.sourceNameOverride || undefined,
  });

  revalidatePath("/knowledge");
  revalidatePath("/body");

  return { ok: true as const, ...result };
}
