import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db/prisma";
import {
  toUiBiomarker,
  resolveDefinitionByRawName,
  getBiomarkerDetail,
} from "@/lib/services/biomarker.service";

describe("biomarker service", () => {
  afterAll(async () => {
    await prisma.biomarkerMeasurement.deleteMany({ where: { biomarkerDefinition: { canonicalKey: { startsWith: "test_" } } } });
    await prisma.biomarkerDefinition.deleteMany({ where: { canonicalKey: { startsWith: "test_" } } });
    await prisma.healthDocument.deleteMany({ where: { originalFileName: "test-panel.pdf" } });
  });

  it("creates a biomarker definition and a measurement", async () => {
    const definition = await prisma.biomarkerDefinition.create({
      data: {
        canonicalKey: "test_apob",
        displayName: "Test ApoB",
        category: "Lipids",
        defaultUnit: "mg/dL",
        aliases: ["Apo B", "ApoB", "Apolipoprotein-B"],
      },
    });

    const measurement = await prisma.biomarkerMeasurement.create({
      data: {
        biomarkerDefinitionId: definition.id,
        value: 74,
        unit: "mg/dL",
        measuredAt: new Date("2026-08-21"),
        sourceType: "LAB_REPORT",
        verified: true,
      },
    });

    expect(measurement.value).toBe(74);
    expect(measurement.biomarkerDefinitionId).toBe(definition.id);
  });

  it("resolves a raw lab field name to its definition via aliases", async () => {
    const resolved = await resolveDefinitionByRawName("Apo B");
    expect(resolved?.canonicalKey).toBe("test_apob");

    const resolvedByCanonical = await resolveDefinitionByRawName("test_apob");
    expect(resolvedByCanonical?.canonicalKey).toBe("test_apob");

    const unresolved = await resolveDefinitionByRawName("Some Unknown Marker XYZ");
    expect(unresolved).toBeNull();
  });

  it("orders biomarker history chronologically regardless of insertion order", async () => {
    const definition = await prisma.biomarkerDefinition.create({
      data: { canonicalKey: "test_hrv", displayName: "Test HRV", category: "Cardiac function", aliases: [] },
    });

    // Insert out of chronological order on purpose.
    await prisma.biomarkerMeasurement.create({
      data: { biomarkerDefinitionId: definition.id, value: 55, unit: "ms", measuredAt: new Date("2026-09-01"), sourceType: "WEARABLE" },
    });
    await prisma.biomarkerMeasurement.create({
      data: { biomarkerDefinitionId: definition.id, value: 48, unit: "ms", measuredAt: new Date("2026-08-01"), sourceType: "WEARABLE" },
    });
    await prisma.biomarkerMeasurement.create({
      data: { biomarkerDefinitionId: definition.id, value: 51, unit: "ms", measuredAt: new Date("2026-09-05"), sourceType: "WEARABLE" },
    });

    const detail = await getBiomarkerDetail("test_hrv");
    expect(detail).not.toBeNull();
    const dates = detail!.history.map((h) => h.date);
    const sorted = [...dates].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    expect(dates).toEqual(sorted);

    // Current value must be the most recent measurement, not the last one inserted.
    expect(detail!.currentValue).toBe(51);
    expect(detail!.previousValue).toBe(55);
  });

  it("preserves provenance through to the mapped biomarker's source", async () => {
    const document = await prisma.healthDocument.create({
      data: {
        type: "LAB_REPORT",
        originalFileName: "test-panel.pdf",
        mimeType: "application/pdf",
        localFilePath: "does-not-exist.pdf",
        providerName: "Test Diagnostics",
      },
    });

    const definition = await prisma.biomarkerDefinition.create({
      data: { canonicalKey: "test_ldl", displayName: "Test LDL", category: "Lipids", aliases: [] },
    });

    await prisma.biomarkerMeasurement.create({
      data: {
        biomarkerDefinitionId: definition.id,
        value: 101,
        unit: "mg/dL",
        measuredAt: new Date("2026-08-21"),
        sourceType: "LAB_REPORT",
        sourceDocumentId: document.id,
      },
    });

    const measurement = await prisma.biomarkerMeasurement.findFirstOrThrow({
      where: { biomarkerDefinitionId: definition.id },
      include: { sourceDocument: true },
    });
    const ui = toUiBiomarker(definition, [measurement]);

    expect(ui?.source.type).toBe("lab");
    expect(ui?.source.label).toBe("Test Diagnostics");
    expect(ui?.source.date).toBe(measurement.measuredAt.toISOString());
  });
});
