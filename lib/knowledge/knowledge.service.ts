import {
  createDocumentWithChunks,
  findDocumentByHash,
  findDocumentWithChunks,
  listDocuments,
} from "@/lib/db/repositories/knowledge.repository";
import { KnowledgeSourceType } from "@/lib/generated/prisma/client";
import { keywordsForSection, parseMarkdownDocument } from "./markdown-parser";
import type { KnowledgeDocumentDetail, KnowledgeLibraryDocument, ParsedKnowledgeDocument } from "./types";

export interface InspectResult {
  parsed: ParsedKnowledgeDocument;
  alreadyImported: boolean;
  existingDocumentId?: string;
}

/** Pure parse preview — no DB writes. Backs the import wizard's "inspect" step. */
export async function inspectMarkdown(raw: string, fallbackTitle: string): Promise<InspectResult> {
  const parsed = parseMarkdownDocument(raw, fallbackTitle);
  const existing = await findDocumentByHash(parsed.contentHash);
  return { parsed, alreadyImported: !!existing, existingDocumentId: existing?.id };
}

export interface ImportKnowledgeInput {
  raw: string;
  fallbackTitle: string;
  sourceType: KnowledgeSourceType;
  sourceNameOverride?: string;
}

export interface ImportKnowledgeResult {
  documentId: string;
  created: boolean;
  sectionCount: number;
  warnings: string[];
}

/** Idempotent: importing byte-identical content twice never creates a duplicate document or chunks. */
export async function importMarkdown(input: ImportKnowledgeInput): Promise<ImportKnowledgeResult> {
  const parsed = parseMarkdownDocument(input.raw, input.fallbackTitle);
  const existing = await findDocumentByHash(parsed.contentHash);
  if (existing) {
    return { documentId: existing.id, created: false, sectionCount: parsed.sections.length, warnings: parsed.warnings };
  }

  const doc = await createDocumentWithChunks(
    {
      title: parsed.title,
      sourceType: input.sourceType,
      sourceName: input.sourceNameOverride ?? parsed.sourceName,
      topic: parsed.topic,
      bodySystem: parsed.bodySystem,
      contentHash: parsed.contentHash,
      metadata: { importedVia: "markdown", warningCount: parsed.warnings.length },
    },
    parsed.sections.map((s) => ({
      heading: s.heading,
      content: s.content,
      order: s.order,
      keywords: keywordsForSection(s.heading, s.content),
      bodySystem: parsed.bodySystem,
      topic: parsed.topic,
    }))
  );

  return { documentId: doc.id, created: true, sectionCount: parsed.sections.length, warnings: parsed.warnings };
}

export async function getKnowledgeLibrary(): Promise<KnowledgeLibraryDocument[]> {
  const docs = await listDocuments();
  return docs.map((d) => ({
    id: d.id,
    title: d.title,
    sourceType: d.sourceType,
    sourceName: d.sourceName ?? undefined,
    topic: d.topic ?? undefined,
    bodySystem: d.bodySystem ?? undefined,
    chunkCount: d._count.chunks,
    createdAt: d.createdAt,
  }));
}

export async function getKnowledgeDocument(id: string): Promise<KnowledgeDocumentDetail | null> {
  const doc = await findDocumentWithChunks(id);
  if (!doc) return null;
  return {
    id: doc.id,
    title: doc.title,
    sourceType: doc.sourceType,
    sourceName: doc.sourceName ?? undefined,
    topic: doc.topic ?? undefined,
    bodySystem: doc.bodySystem ?? undefined,
    chunkCount: doc.chunks.length,
    createdAt: doc.createdAt,
    sections: doc.chunks.map((c) => ({ id: c.id, heading: c.heading, content: c.content, order: c.order })),
  };
}

export { KnowledgeSourceType };
