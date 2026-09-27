import { listAllChunksWithDocument } from "@/lib/db/repositories/knowledge.repository";
import type { KnowledgeQuery, KnowledgeResult } from "./types";

// Deterministic lexical scoring — no embeddings, no external AI (Phase 7
// spec, section 7). A simple weighted term-overlap score: a heading/topic/
// body-system hit counts far more than a plain content-body occurrence,
// which is enough to rank genuinely relevant sections first without the
// complexity of real BM25.

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z][a-z0-9'-]{2,}/g) ?? []) as string[];
}

function scoreChunk(
  terms: string[],
  chunk: { heading: string; content: string; keywords: unknown; topic: string | null; bodySystem: string | null },
  query: KnowledgeQuery
): number {
  let score = 0;
  const headingTokens = new Set(tokenize(chunk.heading));
  const contentLower = chunk.content.toLowerCase();
  const keywords = new Set(Array.isArray(chunk.keywords) ? (chunk.keywords as string[]) : []);

  for (const term of terms) {
    if (headingTokens.has(term)) score += 5;
    if (keywords.has(term)) score += 3;
    if (chunk.topic && chunk.topic.toLowerCase().includes(term)) score += 4;
    const occurrences = contentLower.split(term).length - 1;
    if (occurrences > 0) score += Math.min(occurrences, 3);
  }

  if (query.topic && chunk.topic && chunk.topic.toLowerCase() === query.topic.toLowerCase()) score += 6;
  if (query.bodySystem && chunk.bodySystem === query.bodySystem) score += 6;

  return score;
}

export async function searchKnowledge(query: KnowledgeQuery): Promise<KnowledgeResult[]> {
  const limit = query.limit ?? 5;
  const chunks = await listAllChunksWithDocument();
  const terms = query.text ? tokenize(query.text) : [];

  const filtered = chunks.filter((c) => {
    if (query.sourceType && c.document.sourceType !== query.sourceType) return false;
    if (query.bodySystem && c.bodySystem !== query.bodySystem && c.document.bodySystem !== query.bodySystem) {
      return false;
    }
    return true;
  });

  const scored = filtered
    .map((c) => ({
      chunk: c,
      score: scoreChunk(terms, { ...c, bodySystem: c.bodySystem ?? c.document.bodySystem }, query),
    }))
    .filter((s) => {
      // With no text/topic/bodySystem filter at all, nothing is "relevant" —
      // avoid returning the whole library for an empty query.
      if (terms.length === 0 && !query.topic && !query.bodySystem) return true;
      return s.score > 0;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map(({ chunk, score }) => ({
    documentId: chunk.documentId,
    documentTitle: chunk.document.title,
    sourceType: chunk.document.sourceType,
    sourceName: chunk.document.sourceName ?? undefined,
    chunkId: chunk.id,
    heading: chunk.heading,
    content: chunk.content,
    topic: chunk.topic ?? chunk.document.topic ?? undefined,
    bodySystem: chunk.bodySystem ?? chunk.document.bodySystem ?? undefined,
    score,
  }));
}
