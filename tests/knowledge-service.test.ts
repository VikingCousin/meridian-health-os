import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { importMarkdown, getKnowledgeDocument, inspectMarkdown } from "@/lib/knowledge/knowledge.service";
import { searchKnowledge } from "@/lib/knowledge/search.service";

const MARKER = "TEST_KNOWLEDGE_SVC";

const SLEEP_DOC = [
  "---",
  "topic: sleep",
  "bodySystem: brain",
  "---",
  `# ${MARKER} Sleep Notes`,
  "",
  "## Why sleep matters",
  "Sleep is commonly associated with memory consolidation and recovery.",
  "",
  "## HRV and sleep",
  "Heart rate variability can be influenced by sleep quality.",
].join("\n");

describe("knowledge.service (DB-wired)", () => {
  const createdDocIds: string[] = [];

  afterAll(async () => {
    await prisma.healthKnowledgeDocument.deleteMany({ where: { id: { in: createdDocIds } } });
  });

  it("inspects a document without writing anything to the DB", async () => {
    const before = await prisma.healthKnowledgeDocument.count();
    const result = await inspectMarkdown(SLEEP_DOC, "fallback");
    const after = await prisma.healthKnowledgeDocument.count();
    expect(after).toBe(before);
    expect(result.alreadyImported).toBe(false);
    expect(result.parsed.sections).toHaveLength(2);
  });

  it("imports a document, creating one document and one chunk per section", async () => {
    const result = await importMarkdown({ raw: SLEEP_DOC, fallbackTitle: "fallback", sourceType: "USER_NOTES" });
    createdDocIds.push(result.documentId);
    expect(result.created).toBe(true);
    expect(result.sectionCount).toBe(2);

    const doc = await getKnowledgeDocument(result.documentId);
    expect(doc?.sourceType).toBe("USER_NOTES");
    expect(doc?.sections).toHaveLength(2);
  });

  it("is idempotent — re-importing byte-identical content does not create a duplicate document or chunks", async () => {
    const before = await prisma.healthKnowledgeDocument.count();
    const beforeChunks = await prisma.healthKnowledgeChunk.count();

    const again = await importMarkdown({ raw: SLEEP_DOC, fallbackTitle: "fallback", sourceType: "USER_NOTES" });
    expect(again.created).toBe(false);

    const after = await prisma.healthKnowledgeDocument.count();
    const afterChunks = await prisma.healthKnowledgeChunk.count();
    expect(after).toBe(before);
    expect(afterChunks).toBe(beforeChunks);
  });

  it("preserves the declared source type — a user note is never labeled as a guideline", async () => {
    const doc = await getKnowledgeDocument(createdDocIds[0]);
    expect(doc?.sourceType).toBe("USER_NOTES");
  });

  it("finds relevant sections via lexical search on heading/content/topic", async () => {
    const results = await searchKnowledge({ text: "HRV sleep quality" });
    const match = results.find((r) => r.documentId === createdDocIds[0]);
    expect(match).toBeDefined();
    expect(match!.heading).toBe("HRV and sleep");
  });

  it("returns multiple results rather than merging them when several sections match", async () => {
    const results = await searchKnowledge({ topic: "sleep" });
    const fromThisDoc = results.filter((r) => r.documentId === createdDocIds[0]);
    expect(fromThisDoc.length).toBeGreaterThanOrEqual(1);
    // Each result stays a distinct, individually-cited section — never concatenated into one blob.
    for (const r of results) {
      expect(typeof r.heading).toBe("string");
      expect(typeof r.documentTitle).toBe("string");
    }
  });

  it("a bodySystem filter is a hard constraint even when a text query is also given — no cross-system leakage", async () => {
    const other = await importMarkdown({
      raw: `## Overview\nsleep quality and HRV context for a different system`,
      fallbackTitle: `${MARKER} Other System`,
      sourceType: "USER_NOTES",
    });
    createdDocIds.push(other.documentId);
    await prisma.healthKnowledgeDocument.update({ where: { id: other.documentId }, data: { bodySystem: "METABOLIC" } });
    await prisma.healthKnowledgeChunk.updateMany({ where: { documentId: other.documentId }, data: { bodySystem: "METABOLIC" } });

    const results = await searchKnowledge({ text: "HRV sleep quality", bodySystem: "BRAIN" });
    expect(results.every((r) => r.bodySystem === "BRAIN")).toBe(true);
    expect(results.some((r) => r.documentId === other.documentId)).toBe(false);
  });

  it("every result retains document/source provenance for a citation", async () => {
    const results = await searchKnowledge({ text: "memory consolidation" });
    const match = results.find((r) => r.documentId === createdDocIds[0]);
    expect(match?.sourceType).toBe("USER_NOTES");
    expect(match?.documentTitle).toContain(MARKER);
  });
});
