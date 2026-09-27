import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { classifyObservation, normalizePendingObservations } from "@/lib/health-events/normalization.service";

describe("classifyObservation (pure mapping)", () => {
  it("deterministically maps a FOOD/late observation to LATE_MEAL", () => {
    expect(classifyObservation("FOOD", "Late meal")).toBe("LATE_MEAL");
  });

  it("maps ALCOHOL/LIFESTYLE observations to their canonical event types", () => {
    expect(classifyObservation("ALCOHOL", "Alcohol")).toBe("ALCOHOL");
    expect(classifyObservation("LIFESTYLE", "Sauna session")).toBe("SAUNA");
  });

  it("does not normalize an ambiguous observation rather than guessing", () => {
    expect(classifyObservation("SYMPTOM", "Recurring digestive symptom")).toBeNull();
    expect(classifyObservation("FOOD", "Possible dietary trigger")).toBeNull();
  });

  it("never invents a fallback/catch-all event type", () => {
    expect(classifyObservation("OTHER", "Something unrelated")).toBeNull();
  });
});

describe("normalizePendingObservations (DB-wired)", () => {
  const marker = "TEST_NORMALIZE_9f3a";

  afterAll(async () => {
    const entries = await prisma.journalEntry.findMany({ where: { text: { contains: marker } } });
    const observationIds = (await prisma.journalObservation.findMany({ where: { journalEntryId: { in: entries.map((e) => e.id) } } })).map((o) => o.id);
    await prisma.normalizedHealthEvent.deleteMany({ where: { sourceId: { in: observationIds } } });
    await prisma.journalEntry.deleteMany({ where: { id: { in: entries.map((e) => e.id) } } });
  });

  it("creates a NormalizedHealthEvent with provenance back to the JournalObservation, and skips ambiguous ones", async () => {
    const entry = await prisma.journalEntry.create({
      data: {
        text: `${marker}: late dinner again, also some unrelated digestive discomfort`,
        entryDate: new Date("2026-02-01"),
        observations: {
          create: [
            { type: "FOOD", label: "Late large meal", normalizedValue: "Late meal", confidence: 0.7, source: "AI_EXTRACTED" },
            { type: "SYMPTOM", label: "Ambiguous symptom", normalizedValue: "Digestion", confidence: 0.5, source: "AI_EXTRACTED" },
          ],
        },
      },
      include: { observations: true },
    });

    const result = await normalizePendingObservations();
    expect(result.created).toBeGreaterThanOrEqual(1);

    const lateMealObservation = entry.observations.find((o) => o.normalizedValue === "Late meal")!;
    const event = await prisma.normalizedHealthEvent.findFirst({ where: { sourceId: lateMealObservation.id } });
    expect(event).not.toBeNull();
    expect(event!.type).toBe("LATE_MEAL");
    expect(event!.sourceType).toBe("JOURNAL_OBSERVATION");
    expect(event!.occurredAt.toISOString().slice(0, 10)).toBe("2026-02-01");

    const symptomObservation = entry.observations.find((o) => o.normalizedValue === "Digestion")!;
    const symptomEvent = await prisma.normalizedHealthEvent.findFirst({ where: { sourceId: symptomObservation.id } });
    expect(symptomEvent).toBeNull();
  });

  it("is idempotent — re-running does not create duplicate events for the same observation", async () => {
    const before = await prisma.normalizedHealthEvent.count();
    await normalizePendingObservations();
    await normalizePendingObservations();
    const after = await prisma.normalizedHealthEvent.count();
    expect(after).toBe(before);
  });

  it("never mutates the original journal entry's raw text", async () => {
    const entry = await prisma.journalEntry.findFirstOrThrow({ where: { text: { contains: marker } } });
    expect(entry.text).toContain(marker);
    expect(entry.text).toContain("late dinner again");
  });
});
