import type { BodySystem, KnowledgeSourceType } from "@/lib/generated/prisma/client";

// The result of parsing a raw Markdown file, before anything is written to
// the DB — used both by the "inspect" preview step and by the real import.
export interface ParsedKnowledgeSection {
  heading: string;
  content: string;
  order: number;
}

export interface ParsedKnowledgeDocument {
  title: string;
  topic?: string;
  bodySystem?: BodySystem;
  sourceName?: string;
  sections: ParsedKnowledgeSection[];
  contentHash: string;
  warnings: string[];
}

export interface KnowledgeLibraryDocument {
  id: string;
  title: string;
  sourceType: KnowledgeSourceType;
  sourceName?: string;
  topic?: string;
  bodySystem?: BodySystem;
  chunkCount: number;
  createdAt: Date;
}

export interface KnowledgeDocumentDetail extends KnowledgeLibraryDocument {
  sections: { id: string; heading: string; content: string; order: number }[];
}

// What the search layer, Body/Biomarker pages, and the Coach all consume.
// Always carries full provenance so a "[Source]" citation is never fabricated.
export interface KnowledgeResult {
  documentId: string;
  documentTitle: string;
  sourceType: KnowledgeSourceType;
  sourceName?: string;
  chunkId: string;
  heading: string;
  content: string;
  topic?: string;
  bodySystem?: BodySystem;
  score: number;
}

export interface KnowledgeQuery {
  text?: string;
  topic?: string;
  bodySystem?: BodySystem;
  sourceType?: KnowledgeSourceType;
  limit?: number;
}

export interface HealthKnowledgeProvider {
  /** Deterministic lexical search over the local knowledge library. Never calls an LLM. */
  search(query: KnowledgeQuery): Promise<KnowledgeResult[]>;
  /** Phase 6 compatibility: a single static one-liner for an intervention, when no richer match exists. */
  getNote(interventionId: string): string | undefined;
}
