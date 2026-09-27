import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { analyzeHealthData } from "@/lib/analytics/health-analysis.service";
import { dismissInsight } from "@/lib/services/insight.service";

const FINGERPRINT = "association:LATE_MEAL:sleep_duration:NEXT_NIGHT";
const LATE_MEAL_DATES = ["2030-01-05", "2030-01-10", "2030-01-15", "2030-01-20", "2030-01-25"];

function addDays(date: string, days: number): Date {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setDate(d.getDate() + days);
  return d;
}

describe("insight lifecycle (DB-wired orchestrator)", () => {
  beforeAll(async () => {
    const definition = await prisma.biomarkerDefinition.create({
      data: { canonicalKey: "sleep_duration", displayName: "Sleep duration", category: "Sleep", defaultUnit: "hours", aliases: [] },
    });

    // 60 days of a flat, plentiful baseline...
    const start = new Date("2029-12-15T00:00:00.000Z");
    for (let i = 0; i < 60; i++) {
      const date = new Date(start.getTime() + i * 86_400_000);
      const key = date.toISOString().slice(0, 10);
      // ...except the morning after each late meal, where sleep is deliberately
      // shorter for 3 of the 5 occasions (the other 2 stay normal — contradicting evidence).
      const isDepressedMorning = LATE_MEAL_DATES.slice(0, 3).some((d) => addDays(d, 1).toISOString().slice(0, 10) === key);
      await prisma.biomarkerMeasurement.create({
        data: {
          biomarkerDefinitionId: definition.id,
          value: isDepressedMorning ? 6.0 : 7.0,
          unit: "hours",
          measuredAt: date,
          sourceType: "WEARABLE",
        },
      });
    }

    for (const date of LATE_MEAL_DATES) {
      await prisma.journalEntry.create({
        data: {
          text: `TEST_INSIGHTS_lifecycle: late dinner on ${date}`,
          entryDate: new Date(`${date}T00:00:00.000Z`),
          observations: { create: [{ type: "FOOD", label: "Late large meal", normalizedValue: "Late meal", confidence: 0.7, source: "AI_EXTRACTED" }] },
        },
      });
    }
  });

  afterAll(async () => {
    const entries = await prisma.journalEntry.findMany({ where: { text: { contains: "TEST_INSIGHTS_lifecycle" } } });
    const observationIds = (await prisma.journalObservation.findMany({ where: { journalEntryId: { in: entries.map((e) => e.id) } } })).map((o) => o.id);
    await prisma.normalizedHealthEvent.deleteMany({ where: { sourceId: { in: observationIds } } });
    await prisma.insightEvidence.deleteMany({ where: { insight: { fingerprint: FINGERPRINT } } });
    await prisma.healthInsight.deleteMany({ where: { fingerprint: FINGERPRINT } });
    await prisma.journalEntry.deleteMany({ where: { id: { in: entries.map((e) => e.id) } } });
    await prisma.biomarkerMeasurement.deleteMany({ where: { biomarkerDefinition: { canonicalKey: "sleep_duration" } } });
    await prisma.biomarkerDefinition.deleteMany({ where: { canonicalKey: "sleep_duration" } });
  });

  it("creates a HealthInsight with supporting and contradicting evidence from real longitudinal data", async () => {
    const summary = await analyzeHealthData();
    expect(summary.insightsCreated).toBeGreaterThanOrEqual(1);

    const insight = await prisma.healthInsight.findUnique({ where: { fingerprint: FINGERPRINT }, include: { evidence: true } });
    expect(insight).not.toBeNull();
    expect(insight!.status).not.toBe("DISMISSED");

    const metadata = insight!.metadata as unknown as { association: { supportingCount: number; contradictingCount: number } };
    expect(metadata.association.supportingCount).toBe(3);
    expect(metadata.association.contradictingCount).toBe(2);
  });

  it("deduplicates by fingerprint on rerun instead of creating a second insight", async () => {
    await analyzeHealthData();
    await analyzeHealthData();
    const matches = await prisma.healthInsight.findMany({ where: { fingerprint: FINGERPRINT } });
    expect(matches).toHaveLength(1);
  });

  it("traces every piece of evidence back to a NormalizedHealthEvent with real provenance", async () => {
    const insight = await prisma.healthInsight.findUniqueOrThrow({ where: { fingerprint: FINGERPRINT }, include: { evidence: true } });
    const occasionEvidence = insight.evidence.filter((e) => e.role === "SUPPORTING" || e.role === "CONTRADICTING");
    expect(occasionEvidence.length).toBe(5);

    for (const evidence of occasionEvidence) {
      const event = await prisma.normalizedHealthEvent.findUnique({ where: { id: evidence.sourceId } });
      expect(event).not.toBeNull();
      expect(event!.type).toBe("LATE_MEAL");
      const observation = await prisma.journalObservation.findUnique({ where: { id: event!.sourceId } });
      expect(observation).not.toBeNull();
    }
  });

  it("keeps a dismissed insight dismissed across reruns", async () => {
    const insight = await prisma.healthInsight.findUniqueOrThrow({ where: { fingerprint: FINGERPRINT } });
    await dismissInsight(insight.id);

    const summary = await analyzeHealthData();
    expect(summary.insightsSkippedDismissed).toBeGreaterThanOrEqual(1);

    const stillDismissed = await prisma.healthInsight.findUniqueOrThrow({ where: { fingerprint: FINGERPRINT } });
    expect(stillDismissed.status).toBe("DISMISSED");
    expect(stillDismissed.dismissedAt).not.toBeNull();
  });
});
