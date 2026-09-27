import { describe, it, expect, afterEach } from "vitest";
import { buildTimeline } from "@/lib/services/timeline.service";
import { getRealBodySystemStatus } from "@/lib/services/body-system-status.service";
import { setDemoMode } from "@/lib/services/settings.service";
import { prisma } from "@/lib/db/prisma";

describe("real vs. demo data isolation (Section 1/2)", () => {
  afterEach(async () => {
    await setDemoMode(true); // restore the suite's default so other test files aren't affected
  });

  it("excludes legacy mock timeline events (training/illness/weight/supplement/wearable) in real mode", async () => {
    await setDemoMode(false);
    const timeline = await buildTimeline();
    const legacyTypes = new Set(["training", "illness", "weight", "supplement", "wearable"]);
    expect(timeline.some((e) => legacyTypes.has(e.type))).toBe(false);
  });

  it("includes the illustrative legacy mock timeline events in demo mode", async () => {
    await setDemoMode(true);
    const timeline = await buildTimeline();
    const legacyTypes = new Set(["training", "illness", "weight", "supplement", "wearable"]);
    expect(timeline.some((e) => legacyTypes.has(e.type))).toBe(true);
  });

  it("body-system status is a plain data-presence fact in real mode, never a fabricated health judgment", async () => {
    const def = await prisma.biomarkerDefinition.create({
      data: { canonicalKey: "test_isolation_marker", displayName: "Test Marker", category: "Test", bodySystem: "CARDIOVASCULAR", aliases: [] },
    });
    try {
      const withoutData = await getRealBodySystemStatus("gut");
      expect(withoutData.status).toBe("needs_data");

      await prisma.biomarkerMeasurement.create({
        data: { biomarkerDefinitionId: def.id, value: 1, unit: "u", measuredAt: new Date(), sourceType: "MANUAL" },
      });
      const withData = await getRealBodySystemStatus("cardiovascular");
      expect(withData.status).toBe("has_data");
      // Never one of the health-judgment statuses the demo dataset uses.
      expect(["good", "stable", "improving", "attention"]).not.toContain(withData.status);
    } finally {
      await prisma.biomarkerMeasurement.deleteMany({ where: { biomarkerDefinitionId: def.id } });
      await prisma.biomarkerDefinition.delete({ where: { id: def.id } });
    }
  });
});
