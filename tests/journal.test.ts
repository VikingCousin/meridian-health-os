import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createJournalEntryWithAnalysis, listJournalEntries } from "@/lib/services/journal.service";

const MARKER_TEXT = "TEST_JOURNAL: felt tired today after a late large dinner and woke up several times overnight.";

describe("journal service", () => {
  afterAll(async () => {
    await prisma.journalEntry.deleteMany({ where: { text: { contains: "TEST_JOURNAL" } } });
  });

  it("persists a journal entry with its raw text unchanged", async () => {
    const created = await createJournalEntryWithAnalysis(MARKER_TEXT, new Date("2026-09-06"));
    expect(created.text).toBe(MARKER_TEXT);
    expect(created.id).toBeTruthy();
  });

  it("derives structured observations without mutating the raw text", async () => {
    const created = await createJournalEntryWithAnalysis(MARKER_TEXT, new Date("2026-09-06"));

    // Raw text is untouched...
    expect(created.text).toBe(MARKER_TEXT);
    // ...while structured tags were derived alongside it.
    expect(created.tags.length).toBeGreaterThan(0);
    expect(created.aiObservations.length).toBeGreaterThan(0);
    expect(created.tags.some((t) => t.category === "sleep")).toBe(true);
  });

  it("survives a fresh read (simulating a page refresh)", async () => {
    const created = await createJournalEntryWithAnalysis(MARKER_TEXT, new Date("2026-09-06"));

    const entries = await listJournalEntries();
    const found = entries.find((e) => e.id === created.id);

    expect(found).toBeDefined();
    expect(found?.text).toBe(MARKER_TEXT);
    expect(found?.tags).toEqual(created.tags);
  });
});
