import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db/prisma";

vi.mock("@/lib/extraction", () => ({
  getLabDocumentExtractor: async () => ({
    name: "fake-malformed-extractor",
    extract: async () => ({
      extractorName: "fake-malformed-extractor",
      fields: [
        { rawName: "Good Marker", value: 42, unit: "mg/dL", confidence: 0.9 },
        { rawName: "NaN Value", value: Number.NaN, unit: "mg/dL", confidence: 0.9 },
        { rawName: "Infinite Value", value: Number.POSITIVE_INFINITY, unit: "mg/dL", confidence: 0.9 },
        { rawName: "", value: 10, unit: "mg/dL", confidence: 0.9 }, // blank name
        { rawName: "Blank Unit", value: 10, unit: "  ", confidence: 0.9 },
        { rawName: "Bad Confidence", value: 10, unit: "mg/dL", confidence: 1.5 }, // out of [0,1]
        { rawName: "Good Marker", value: 42, unit: "mg/dL", confidence: 0.91 }, // exact duplicate of the first
      ],
    }),
  }),
}));

// Imported AFTER the mock so extraction.service.ts picks up the fake extractor.
const { startExtraction } = await import("@/lib/services/extraction.service");
const { setDemoMode } = await import("@/lib/services/settings.service");

describe("extraction field sanitization (Section 5 — data integrity, not medical interpretation)", () => {
  let documentId: string;

  beforeAll(async () => {
    await setDemoMode(false);
    const document = await prisma.healthDocument.create({
      data: { type: "LAB_REPORT", originalFileName: "malformed.pdf", mimeType: "application/pdf", localFilePath: "malformed.pdf" },
    });
    documentId = document.id;
  });

  afterAll(async () => {
    await prisma.labExtractionItem.deleteMany({ where: { extractionSession: { documentId } } });
    await prisma.labExtractionSession.deleteMany({ where: { documentId } });
    await prisma.healthDocument.delete({ where: { id: documentId } });
  });

  it("drops non-finite values, blank names/units, out-of-range confidence, and exact duplicates", async () => {
    const session = await startExtraction(documentId);
    expect(session).not.toBeNull();
    expect(session!.status).toBe("EXTRACTED");

    const names = session!.items.map((i) => i.rawName);
    expect(names).toEqual(["Good Marker"]); // only the one valid, non-duplicate field survives
    expect(session!.items).toHaveLength(1);
  });
});
