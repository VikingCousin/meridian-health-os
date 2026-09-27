import { describe, it, expect, vi, afterAll } from "vitest";
import { prisma } from "@/lib/db/prisma";

// Section 7: "unreadable document -> zero fabricated values." A file that
// can't be read at all (missing/corrupted on disk) must fail the whole
// session cleanly — never fall through to a partially-fabricated result.
const fakeProvider = { name: "fake-vision-provider", complete: async () => JSON.stringify({ fields: [] }) };
vi.mock("@/lib/ai", () => ({ getAiProvider: async () => fakeProvider }));

const { startExtraction } = await import("@/lib/services/extraction.service");
const { setDemoMode } = await import("@/lib/services/settings.service");

describe("unreadable document (Section 7)", () => {
  let documentId: string;

  afterAll(async () => {
    await prisma.labExtractionSession.deleteMany({ where: { documentId } });
    await prisma.healthDocument.delete({ where: { id: documentId } });
    await setDemoMode(false);
  });

  it("a document whose file no longer exists on disk produces a FAILED session with zero items, never fabricated values", async () => {
    await setDemoMode(false);
    const document = await prisma.healthDocument.create({
      data: {
        type: "LAB_REPORT",
        originalFileName: "missing.pdf",
        mimeType: "application/pdf",
        localFilePath: "TEST_DOES_NOT_EXIST_meridian_unreadable.pdf",
      },
    });
    documentId = document.id;

    const session = await startExtraction(document.id);
    expect(session!.status).toBe("FAILED");
    expect(session!.items).toHaveLength(0);

    const measurementCount = await prisma.biomarkerMeasurement.count({ where: { sourceDocumentId: document.id } });
    expect(measurementCount).toBe(0);
  });
});
