import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { startExtraction, confirmExtraction, toUiExtractedValues } from "@/lib/services/extraction.service";
import { getLabDocumentExtractor } from "@/lib/extraction";
import { setDemoMode } from "@/lib/services/settings.service";

// P0 regression suite: a hormone-report upload previously produced a
// fabricated lipid panel (ApoB 74, LDL-C 101, ...) because the mock
// extractor was reachable regardless of demo/real mode — see
// lib/extraction/index.ts and docs/DATA_MODEL.md, "Real lab extraction."
describe("lab extraction — real-mode safe failure (P0)", () => {
  afterEach(async () => {
    await setDemoMode(false); // restore the suite default after any test that flips it
  });

  it("never returns the mock extractor in real mode when no AI provider is configured", async () => {
    await setDemoMode(false);
    delete process.env.AI_PROVIDER;
    const extractor = await getLabDocumentExtractor();
    expect(extractor.name).not.toBe("mock-v1");
  });

  it("returns the mock extractor only when demo mode is explicitly on", async () => {
    await setDemoMode(true);
    delete process.env.AI_PROVIDER;
    const extractor = await getLabDocumentExtractor();
    expect(extractor.name).toBe("mock-v1");
  });

  describe("a hormone-only document in real mode", () => {
    let documentId: string;
    let lipidDefId: string;

    beforeAll(async () => {
      await setDemoMode(false);
      delete process.env.AI_PROVIDER;

      // A definition that WOULD match the old fabricated panel, so this test
      // would fail loudly if the mock panel ever leaked through again.
      const lipidDef = await prisma.biomarkerDefinition.create({
        data: { canonicalKey: "test_realmode_apob", displayName: "Test ApoB", category: "Lipids", aliases: ["ApoB"] },
      });
      lipidDefId = lipidDef.id;

      const document = await prisma.healthDocument.create({
        data: {
          type: "LAB_REPORT",
          originalFileName: "hormone-panel.pdf",
          mimeType: "application/pdf",
          localFilePath: "hormone-panel.pdf",
        },
      });
      documentId = document.id;
    });

    afterAll(async () => {
      await prisma.biomarkerMeasurement.deleteMany({ where: { biomarkerDefinitionId: lipidDefId } });
      await prisma.labExtractionItem.deleteMany({ where: { extractionSession: { documentId } } });
      await prisma.labExtractionSession.deleteMany({ where: { documentId } });
      await prisma.healthDocument.delete({ where: { id: documentId } });
      await prisma.biomarkerDefinition.delete({ where: { id: lipidDefId } });
    });

    it("produces a FAILED session with a specific, actionable message — not fabricated ApoB/LDL/HDL values", async () => {
      const session = await startExtraction(documentId);
      expect(session).not.toBeNull();
      expect(session!.status).toBe("FAILED");
      expect(session!.items).toHaveLength(0);
      expect(session!.rawExtraction).toContain("no AI extraction provider is configured");
      // The specific regression: none of the old mock panel's markers exist as items.
      expect(session!.items.some((i) => i.rawName === "ApoB")).toBe(false);
    });

    it("creates zero BiomarkerMeasurement rows from the failed attempt", async () => {
      const count = await prisma.biomarkerMeasurement.count({ where: { biomarkerDefinitionId: lipidDefId } });
      expect(count).toBe(0);
    });
  });

  it("existing confirmed historical data is untouched by a later failed extraction attempt", async () => {
    await setDemoMode(false);
    delete process.env.AI_PROVIDER;

    const def = await prisma.biomarkerDefinition.create({
      data: { canonicalKey: "test_realmode_untouched", displayName: "Test Untouched Marker", category: "Test", aliases: [] },
    });
    const historical = await prisma.biomarkerMeasurement.create({
      data: { biomarkerDefinitionId: def.id, value: 55, unit: "u", measuredAt: new Date("2026-01-01"), sourceType: "MANUAL", verified: true },
    });

    const document = await prisma.healthDocument.create({
      data: { type: "LAB_REPORT", originalFileName: "another.pdf", mimeType: "application/pdf", localFilePath: "another.pdf" },
    });
    await startExtraction(document.id);

    const unchanged = await prisma.biomarkerMeasurement.findUnique({ where: { id: historical.id } });
    expect(unchanged?.value).toBe(55);
    expect(unchanged?.updatedAt.getTime()).toBe(historical.updatedAt.getTime());

    await prisma.labExtractionSession.deleteMany({ where: { documentId: document.id } });
    await prisma.healthDocument.delete({ where: { id: document.id } });
    await prisma.biomarkerMeasurement.delete({ where: { id: historical.id } });
    await prisma.biomarkerDefinition.delete({ where: { id: def.id } });
  });

  it("unmapped (unrecognized) markers survive review instead of disappearing", async () => {
    await setDemoMode(true); // use the mock's fixed panel as a fixture; swap one field's mapping off

    const document = await prisma.healthDocument.create({
      data: { type: "LAB_REPORT", originalFileName: "unrecognized-test.pdf", mimeType: "application/pdf", localFilePath: "unrecognized-test.pdf" },
    });
    const session = await startExtraction(document.id);
    expect(session).not.toBeNull();

    // Homocysteine has no seeded BiomarkerDefinition alias in the test DB by
    // default, so it's expected to come back unmapped — exactly the case
    // section 4 requires surviving review rather than being dropped.
    const values = toUiExtractedValues(session!.items);
    const unrecognized = values.filter((v) => v.confidenceTier === "unrecognized");
    expect(unrecognized.length).toBeGreaterThan(0);
    expect(unrecognized.every((v) => v.mapped === false)).toBe(true);
    // It must still be a real row with its real extracted name, not discarded.
    expect(session!.items.length).toBe(values.length);

    const result = await confirmExtraction(session!.id);
    expect(result.skippedUnmappedCount).toBeGreaterThan(0);

    await prisma.labExtractionItem.deleteMany({ where: { extractionSessionId: session!.id } });
    await prisma.labExtractionSession.delete({ where: { id: session!.id } });
    await prisma.healthDocument.delete({ where: { id: document.id } });
    await setDemoMode(false);
  });

  it("no BiomarkerMeasurement is persisted until the user explicitly confirms", async () => {
    await setDemoMode(true);
    const document = await prisma.healthDocument.create({
      data: { type: "LAB_REPORT", originalFileName: "not-confirmed.pdf", mimeType: "application/pdf", localFilePath: "not-confirmed.pdf" },
    });
    const before = await prisma.biomarkerMeasurement.count();
    const session = await startExtraction(document.id);
    const after = await prisma.biomarkerMeasurement.count();
    expect(after).toBe(before); // extraction alone never writes a measurement

    await prisma.labExtractionItem.deleteMany({ where: { extractionSessionId: session!.id } });
    await prisma.labExtractionSession.delete({ where: { id: session!.id } });
    await prisma.healthDocument.delete({ where: { id: document.id } });
    await setDemoMode(false);
  });
});

