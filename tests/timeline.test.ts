import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { buildTimeline } from "@/lib/services/timeline.service";

describe("timeline aggregation", () => {
  const journalDate = new Date("2026-09-06");
  const experimentStart = new Date("2026-08-10");

  beforeAll(async () => {
    const definition = await prisma.biomarkerDefinition.create({
      data: { canonicalKey: "test_timeline_apob", displayName: "Test Timeline ApoB", category: "Lipids", aliases: [] },
    });
    await prisma.biomarkerMeasurement.create({
      data: {
        biomarkerDefinitionId: definition.id,
        value: 74,
        unit: "mg/dL",
        measuredAt: new Date("2026-08-21"),
        sourceType: "LAB_REPORT",
      },
    });

    await prisma.journalEntry.create({
      data: { text: "TEST_TIMELINE journal entry", entryDate: journalDate },
    });

    await prisma.goal.create({
      data: {
        title: "TEST_TIMELINE Judo Competition",
        category: "PERFORMANCE",
        kind: "PROJECT",
        status: "ON_TRACK",
      },
    });

    await prisma.healthExperiment.create({
      data: {
        title: "TEST_TIMELINE experiment",
        hypothesis: "h",
        protocol: "p",
        startDate: experimentStart,
        endDate: new Date("2026-08-24"),
        status: "COMPLETED",
      },
    });
  });

  afterAll(async () => {
    await prisma.biomarkerMeasurement.deleteMany({ where: { biomarkerDefinition: { canonicalKey: "test_timeline_apob" } } });
    await prisma.biomarkerDefinition.deleteMany({ where: { canonicalKey: "test_timeline_apob" } });
    await prisma.journalEntry.deleteMany({ where: { text: { contains: "TEST_TIMELINE" } } });
    await prisma.goal.deleteMany({ where: { title: { contains: "TEST_TIMELINE" } } });
    await prisma.healthExperiment.deleteMany({ where: { title: { contains: "TEST_TIMELINE" } } });
  });

  it("includes lab, journal, goal, and experiment events from the database", async () => {
    const timeline = await buildTimeline();

    expect(timeline.some((e) => e.type === "lab" && e.metrics?.some((m) => m.value.includes("74")))).toBe(true);
    expect(timeline.some((e) => e.type === "journal" && e.detail?.includes("TEST_TIMELINE journal entry"))).toBe(true);
    expect(timeline.some((e) => e.type === "goal" && e.title.includes("TEST_TIMELINE Judo Competition"))).toBe(true);
    expect(timeline.some((e) => e.type === "experiment" && e.detail === "TEST_TIMELINE experiment")).toBe(true);
  });

  it("sorts events by date, most recent first", async () => {
    const timeline = await buildTimeline();
    const times = timeline.map((e) => new Date(e.date).getTime());
    const sortedDesc = [...times].sort((a, b) => b - a);
    expect(times).toEqual(sortedDesc);
  });

  it("marks journal events as subjective, matching journal provenance in the UI", async () => {
    const timeline = await buildTimeline();
    const journalEvent = timeline.find((e) => e.type === "journal" && e.detail?.includes("TEST_TIMELINE"));
    expect(journalEvent?.source.subjective).toBe(true);
    expect(journalEvent?.source.type).toBe("journal");
  });
});
