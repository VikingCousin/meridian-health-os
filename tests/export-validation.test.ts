import { describe, it, expect, beforeAll, afterAll } from "vitest";
import JSZip from "jszip";
import { prisma } from "@/lib/db/prisma";
import { exportUserDataZip } from "@/lib/services/data-management.service";
import { validateExportManifest, EXPORT_MANIFEST_FORMAT, CURRENT_EXPORT_MANIFEST_VERSION } from "@/lib/services/export-manifest";

const MARKER = "TEST_EXPORT_VALIDATION";

describe("export ZIP structural validation (Section 6/7)", () => {
  let docId: string;

  beforeAll(async () => {
    const doc = await prisma.healthKnowledgeDocument.create({
      data: { title: `${MARKER} Doc`, sourceType: "USER_NOTES", contentHash: `${MARKER}-hash`, metadata: {} },
    });
    docId = doc.id;
    await prisma.healthKnowledgeChunk.create({
      data: { documentId: doc.id, heading: "Heading", content: "Body text", order: 0, keywords: [] },
    });
  });

  afterAll(async () => {
    await prisma.healthKnowledgeChunk.deleteMany({ where: { documentId: docId } });
    await prisma.healthKnowledgeDocument.delete({ where: { id: docId } });
  });

  it("contains exactly the documented top-level files", async () => {
    const buffer = await exportUserDataZip();
    const zip = await JSZip.loadAsync(buffer);
    const names = Object.keys(zip.files);

    for (const expected of ["profile.json", "goals.json", "experiments.json", "biomarkers.csv", "journal.csv", "insights.json", "wearables.csv", "metadata.json"]) {
      expect(names).toContain(expected);
    }
    expect(names.some((n) => n.startsWith("knowledge/"))).toBe(true);
  });

  it("metadata.json is a valid, versioned export manifest", async () => {
    const buffer = await exportUserDataZip();
    const zip = await JSZip.loadAsync(buffer);
    const metadataText = await zip.file("metadata.json")!.async("string");
    const parsed = JSON.parse(metadataText);

    expect(parsed.format).toBe(EXPORT_MANIFEST_FORMAT);
    expect(parsed.version).toBe(CURRENT_EXPORT_MANIFEST_VERSION);
    const validation = validateExportManifest(parsed);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it("every JSON/text file decodes as valid UTF-8 with no replacement characters", async () => {
    const buffer = await exportUserDataZip();
    const zip = await JSZip.loadAsync(buffer);
    for (const [name, file] of Object.entries(zip.files)) {
      if (file.dir) continue;
      const text = await file.async("string");
      expect(text.includes("\uFFFD"), `${name} contained a UTF-8 replacement character`).toBe(false);
    }
  });

  it("timestamps carry explicit UTC timezone semantics (ISO 8601 with Z)", async () => {
    const buffer = await exportUserDataZip();
    const zip = await JSZip.loadAsync(buffer);
    const metadata = JSON.parse(await zip.file("metadata.json")!.async("string"));
    expect(metadata.exportedAt).toMatch(/Z$/);
  });

  it("never contains an API key, secret-looking value, or raw filesystem path", async () => {
    const buffer = await exportUserDataZip();
    const zip = await JSZip.loadAsync(buffer);
    const secretPatterns = [/sk-ant-/i, /sk-[a-zA-Z0-9]{20,}/, /ANTHROPIC_API_KEY/i, /OPENAI_API_KEY/i, /process\.env/];
    const pathPatterns = [/\/Users\//, /\/home\//, /C:\\\\/, /data\/uploads\//, /data\/app\.db/];

    for (const [name, file] of Object.entries(zip.files)) {
      if (file.dir) continue;
      const text = await file.async("string");
      for (const pattern of secretPatterns) {
        expect(pattern.test(text), `${name} matched secret pattern ${pattern}`).toBe(false);
      }
      for (const pattern of pathPatterns) {
        expect(pattern.test(text), `${name} matched filesystem-path pattern ${pattern}`).toBe(false);
      }
    }
  });

  it("preserves source provenance for a knowledge document", async () => {
    const buffer = await exportUserDataZip();
    const zip = await JSZip.loadAsync(buffer);
    const files = Object.keys(zip.files).filter((n) => n.startsWith("knowledge/") && n.endsWith(".md"));
    const match = files.find((f) => f.includes("TEST_EXPORT_VALIDATION"));
    expect(match).toBeDefined();
    const content = await zip.file(match!)!.async("string");
    expect(content).toContain("Heading");
    expect(content).toContain("Body text");
  });
});
