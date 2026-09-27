import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { startExtraction, confirmExtraction } from "@/lib/services/extraction.service";
import { setDemoMode } from "@/lib/services/settings.service";

// The mock extractor's fixed panel is only reachable in demo mode (see the
// P0 fix in lib/extraction/index.ts) — these tests exercise the storage /
// confirmation / idempotency mechanics of the pipeline using it as a
// convenient fixture, so demo mode is switched on for the duration and
// restored afterward. tests/extraction-real-mode.test.ts covers the actual
// real-mode safe-failure behavior these tests used to (incorrectly) rely on.
describe("lab extraction pipeline (demo-mode fixture)", () => {
  let documentId: string;

  beforeAll(async () => {
    await setDemoMode(true);
    // The mock extractor always returns a fixed panel that includes "ApoB" —
    // give it a matching definition to resolve against, same as production.
    await prisma.biomarkerDefinition.create({
      data: {
        canonicalKey: "test_extract_apob",
        displayName: "Test Extract ApoB",
        category: "Lipids",
        aliases: ["ApoB"],
      },
    });

    const document = await prisma.healthDocument.create({
      data: {
        type: "LAB_REPORT",
        originalFileName: "extraction-test.pdf",
        mimeType: "application/pdf",
        localFilePath: "extraction-test.pdf", // never actually read by the mock extractor
      },
    });
    documentId = document.id;
  });

  afterAll(async () => {
    await prisma.biomarkerMeasurement.deleteMany({ where: { biomarkerDefinition: { canonicalKey: "test_extract_apob" } } });
    await prisma.labExtractionItem.deleteMany({ where: { extractionSession: { documentId } } });
    await prisma.labExtractionSession.deleteMany({ where: { documentId } });
    await prisma.healthDocument.delete({ where: { id: documentId } });
    await prisma.biomarkerDefinition.deleteMany({ where: { canonicalKey: "test_extract_apob" } });
    await setDemoMode(false);
  });

  it("does not create any verified measurement merely from uploading/extracting", async () => {
    const session = await startExtraction(documentId);
    expect(session).not.toBeNull();
    expect(session!.status).toBe("EXTRACTED");
    expect(session!.items.length).toBeGreaterThan(0);

    const measurementCount = await prisma.biomarkerMeasurement.count({
      where: { biomarkerDefinition: { canonicalKey: "test_extract_apob" } },
    });
    expect(measurementCount).toBe(0);

    const apobItem = session!.items.find((i) => i.rawName === "ApoB");
    expect(apobItem?.suggestedBiomarkerDefinitionId).toBeTruthy();
  });

  it("only turns accepted, resolved items into measurements on confirmation", async () => {
    const session = await startExtraction(documentId);
    const apobItem = session!.items.find((i) => i.rawName === "ApoB")!;

    const result = await confirmExtraction(session!.id);

    expect(result.importedCount).toBeGreaterThan(0);

    const measurement = await prisma.biomarkerMeasurement.findFirst({
      where: { biomarkerDefinitionId: apobItem.suggestedBiomarkerDefinitionId! },
    });
    expect(measurement).not.toBeNull();
    expect(measurement?.sourceType).toBe("AI_EXTRACTED");
    expect(measurement?.verified).toBe(true);
    expect(measurement?.sourceDocumentId).toBe(documentId);
  });

  it("is idempotent — confirming twice never double-imports the same item", async () => {
    const session = await startExtraction(documentId);
    const first = await confirmExtraction(session!.id);
    const second = await confirmExtraction(session!.id);

    expect(first.importedCount).toBeGreaterThan(0);
    expect(second.importedCount).toBe(0); // everything already had a resultingMeasurementId
  });
});
