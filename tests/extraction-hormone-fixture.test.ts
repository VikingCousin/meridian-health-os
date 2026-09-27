import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/db/prisma";
import { getUploadsDir } from "@/lib/services/document.service";

// Section 7 of the real-AI-extraction setup: prove the FULL pipeline
// (provider boundary -> structured extraction -> sanitizer -> biomarker
// mapping -> review-screen representation) end to end using a synthetic
// hormone-panel fixture — never the user's real document, never a live API
// call. Mocking at the completeStructured() boundary (one layer below the
// actual HTTP call) is the most precise place to inject "what a real vision
// model would return" without a real key, while still exercising every
// line of real pipeline code above and below it.
const FIXTURE_RESPONSE = {
  collectionDate: "2026-09-01",
  reportDate: "2026-09-03",
  providerName: "Laborarztpraxis Test",
  fields: [
    // Real, known hormone marker, German name, comma-decimal already
    // normalized to a JSON number by the (simulated) model, textual
    // reference range (age/sex-dependent, common for hormone panels).
    {
      rawName: "Testosteron",
      value: 5.2,
      unit: "ng/mL",
      referenceMin: null,
      referenceMax: null,
      referenceText: "Männer 18-50 Jahre: 2,8-8,0 ng/mL",
      sourcePage: 1,
      sourceSnippet: "Testosteron ... 5,2 ng/mL ... Referenz 2,8-8,0",
      confidence: 0.93,
    },
    // A hormone marker NOT in Meridian's catalog under this exact spelling
    // variant — must survive as "unrecognized", never silently dropped.
    {
      rawName: "Freies Testosteron (berechnet)",
      value: 12.4,
      unit: "pg/mL",
      referenceMin: 8.7,
      referenceMax: 25.1,
      referenceText: null,
      sourcePage: 1,
      sourceSnippet: null,
      confidence: 0.81,
    },
    // Missing unit entirely (model returns empty string per schema) — must
    // be dropped by the sanitizer, never assigned an invented unit.
    { rawName: "Unclear Ratio", value: 1.5, unit: "", referenceMin: null, referenceMax: null, referenceText: null, sourcePage: null, sourceSnippet: null, confidence: 0.4 },
    // No reference range at all — must remain absent, never defaulted.
    { rawName: "SHBG", value: 42, unit: "nmol/L", referenceMin: null, referenceMax: null, referenceText: null, sourcePage: 2, sourceSnippet: null, confidence: 0.9 },
  ],
};

vi.mock("@/lib/ai/structured", () => ({ completeStructured: vi.fn(async () => FIXTURE_RESPONSE) }));

const fakeProvider = { name: "fake-vision-provider", complete: async () => JSON.stringify(FIXTURE_RESPONSE) };
vi.mock("@/lib/ai", () => ({ getAiProvider: async () => fakeProvider }));

const { getLabDocumentExtractor } = await import("@/lib/extraction");
const { startExtraction, confirmExtraction, toUiExtractedValues } = await import("@/lib/services/extraction.service");
const { setDemoMode } = await import("@/lib/services/settings.service");
const { findExtractionSession } = await import("@/lib/db/repositories/extraction.repository");

describe("hormone-panel synthetic fixture — full pipeline (Section 7)", () => {
  const fileName = "TEST_HORMONE_FIXTURE_meridian.pdf";
  let filePath: string;
  let documentId: string;
  let testosteroneDefId: string;
  let shbgDefId: string;

  beforeAll(async () => {
    await setDemoMode(false); // real mode — the case that matters for this validation
    const uploadsDir = getUploadsDir();
    mkdirSync(uploadsDir, { recursive: true });
    filePath = path.join(uploadsDir, fileName);
    writeFileSync(filePath, "synthetic test fixture — not a real document, never read for content");

    // The shared test.db is migrated but never seeded (see
    // tests/global-setup.ts) — create just the two catalog entries this
    // fixture needs to resolve against, scoped to this test file.
    const testosteroneDef = await prisma.biomarkerDefinition.create({
      data: { canonicalKey: "test_hormone_fixture_testosterone", displayName: "Testosterone (Total)", category: "Hormones", aliases: ["Testosteron"] },
    });
    testosteroneDefId = testosteroneDef.id;
    const shbgDef = await prisma.biomarkerDefinition.create({
      data: { canonicalKey: "test_hormone_fixture_shbg", displayName: "SHBG", category: "Hormones", aliases: ["SHBG"] },
    });
    shbgDefId = shbgDef.id;

    // localFilePath is just the filename, exactly like a real upload —
    // resolved via getDocumentAbsolutePath(), same as production.
    const document = await prisma.healthDocument.create({
      data: { type: "LAB_REPORT", originalFileName: "hormone-panel.pdf", mimeType: "application/pdf", localFilePath: fileName },
    });
    documentId = document.id;
  });

  afterAll(async () => {
    await prisma.biomarkerMeasurement.deleteMany({ where: { sourceDocumentId: documentId } });
    await prisma.labExtractionItem.deleteMany({ where: { extractionSession: { documentId } } });
    await prisma.labExtractionSession.deleteMany({ where: { documentId } });
    await prisma.healthDocument.delete({ where: { id: documentId } });
    await prisma.biomarkerDefinition.deleteMany({ where: { id: { in: [testosteroneDefId, shbgDefId] } } });
    if (existsSync(filePath)) rmSync(filePath, { force: true });
    await setDemoMode(false);
  });

  it("resolves the real AI extractor (not mock, not unavailable) when a provider is configured", async () => {
    const extractor = await getLabDocumentExtractor();
    expect(extractor.name).toMatch(/^ai-/);
  });

  it("extracts only the hormone markers actually present — never a lipid/metabolic panel that was never in the fixture", async () => {
    const session = await startExtraction(documentId);
    expect(session!.status).toBe("EXTRACTED");

    const names = session!.items.map((i) => i.rawName);
    for (const fabricatedMarker of ["ApoB", "LDL-C", "HDL-C", "Triglycerides", "HbA1c", "Fasting Glucose", "Total Cholesterol"]) {
      expect(names).not.toContain(fabricatedMarker);
    }
    expect(names).toContain("Testosteron");
    expect(names).toContain("SHBG");
  });

  it("drops the field with a missing unit rather than inventing one", async () => {
    const sessionRow = await prisma.labExtractionSession.findFirstOrThrow({ where: { documentId } });
    const session = await findExtractionSession(sessionRow.id);
    expect(session!.items.some((i) => i.rawName === "Unclear Ratio")).toBe(false);
  });

  it("preserves a textual (non-numeric) reference range verbatim, without inventing numeric bounds", async () => {
    const session = await prisma.labExtractionSession.findFirstOrThrow({ where: { documentId }, include: { items: true } });
    const testosterone = session.items.find((i) => i.rawName === "Testosteron")!;
    expect(testosterone.referenceText).toBe("Männer 18-50 Jahre: 2,8-8,0 ng/mL");
    expect(testosterone.referenceMin).toBeNull();
    expect(testosterone.referenceMax).toBeNull();
  });

  it("leaves a genuinely absent reference range absent — never defaults it to a fabricated number", async () => {
    const session = await prisma.labExtractionSession.findFirstOrThrow({ where: { documentId }, include: { items: true } });
    const shbg = session.items.find((i) => i.rawName === "SHBG")!;
    expect(shbg.referenceMin).toBeNull();
    expect(shbg.referenceMax).toBeNull();
    expect(shbg.referenceText).toBeNull();
  });

  it("retains an unrecognized marker spelling for review instead of discarding it", async () => {
    const sessionRow = await prisma.labExtractionSession.findFirstOrThrow({ where: { documentId } });
    const session = await findExtractionSession(sessionRow.id);
    const values = toUiExtractedValues(session!.items);
    const unrecognized = values.find((v) => v.name === "Freies Testosteron (berechnet)");
    expect(unrecognized).toBeDefined();
    expect(unrecognized!.confidenceTier).toBe("unrecognized");
    expect(unrecognized!.mapped).toBe(false);
  });

  it("preserves per-item source provenance (page, snippet, collection/report dates) through to the stored row", async () => {
    const session = await prisma.labExtractionSession.findFirstOrThrow({ where: { documentId }, include: { items: true } });
    const testosterone = session.items.find((i) => i.rawName === "Testosteron")!;
    const meta = testosterone.sourceMetadata as Record<string, unknown> | null;
    expect(meta?.sourcePage).toBe(1);
    expect(meta?.sourceSnippet).toContain("5,2");
    expect(meta?.collectionDate).toContain("2026-09-01");
    expect(meta?.reportDate).toContain("2026-09-03");
  });

  it("still requires explicit confirmation — nothing is a BiomarkerMeasurement until confirmExtraction() runs", async () => {
    const before = await prisma.biomarkerMeasurement.count({ where: { sourceDocumentId: documentId } });
    expect(before).toBe(0);

    const session = await prisma.labExtractionSession.findFirstOrThrow({ where: { documentId } });
    const result = await confirmExtraction(session.id);
    // Only the mapped ("Testosteron", "SHBG") items import; the unrecognized
    // one and the dropped one do not.
    expect(result.importedCount).toBe(2);
    expect(result.skippedUnmappedCount).toBe(1);

    const after = await prisma.biomarkerMeasurement.count({ where: { sourceDocumentId: documentId } });
    expect(after).toBe(2);
  });
});
