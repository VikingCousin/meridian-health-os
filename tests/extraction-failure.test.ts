import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db/prisma";

vi.mock("@/lib/extraction", () => ({
  getLabDocumentExtractor: () => ({
    name: "fake-failing-extractor",
    extract: async () => {
      throw new Error("Simulated provider outage");
    },
  }),
}));

// Imported AFTER the mock so extraction.service.ts picks up the fake extractor.
const { startExtraction } = await import("@/lib/services/extraction.service");

describe("lab extraction failure handling", () => {
  let documentId: string;

  beforeAll(async () => {
    const document = await prisma.healthDocument.create({
      data: {
        type: "LAB_REPORT",
        originalFileName: "will-fail.pdf",
        mimeType: "application/pdf",
        localFilePath: "will-fail.pdf",
      },
    });
    documentId = document.id;
  });

  afterAll(async () => {
    await prisma.labExtractionSession.deleteMany({ where: { documentId } });
    await prisma.healthDocument.delete({ where: { id: documentId } });
  });

  it("marks the session FAILED instead of throwing past the caller", async () => {
    const session = await startExtraction(documentId);

    expect(session).not.toBeNull();
    expect(session!.status).toBe("FAILED");
    expect(session!.items.length).toBe(0);
    expect(session!.rawExtraction).toContain("Simulated provider outage");
  });

  it("creates no biomarker measurements from a failed extraction", async () => {
    const measurementCount = await prisma.biomarkerMeasurement.count({
      where: { sourceDocumentId: documentId },
    });
    expect(measurementCount).toBe(0);
  });
});
