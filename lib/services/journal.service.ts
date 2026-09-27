import * as journalRepo from "@/lib/db/repositories/journal.repository";
import { getJournalObservationExtractor } from "@/lib/journal-extraction";
import type { JournalEntry as UiJournalEntry, JournalTag } from "@/types/health";
import type { JournalEntry, JournalObservation, ObservationType } from "@/lib/generated/prisma/client";

const observationTypeToCategory: Record<ObservationType, JournalTag["category"]> = {
  MOOD: "mood",
  ENERGY: "mood",
  STRESS: "mood",
  SLEEP: "sleep",
  FOOD: "nutrition",
  ALCOHOL: "nutrition",
  CAFFEINE: "nutrition",
  TRAINING: "training",
  PAIN: "symptom",
  SYMPTOM: "symptom",
  MEDICATION: "other",
  SUPPLEMENT: "other",
  LIFESTYLE: "other",
  OTHER: "other",
};

function toUiEntry(entry: JournalEntry & { observations: JournalObservation[] }): UiJournalEntry {
  return {
    id: entry.id,
    date: entry.entryDate.toISOString(),
    text: entry.text,
    aiObservations: entry.observations.map((o) => o.label),
    tags: entry.observations.map((o) => ({
      label: o.normalizedValue ?? o.label,
      category: observationTypeToCategory[o.type],
    })),
  };
}

export async function listJournalEntries(): Promise<UiJournalEntry[]> {
  const entries = await journalRepo.listJournalEntries();
  return entries.map(toUiEntry);
}

/**
 * Creates a journal entry and derives structured observations from it via
 * the configured JournalObservationExtractor (real AI provider if
 * configured, otherwise the deterministic mock) — WITHOUT ever modifying the
 * raw text, which is stored exactly as written. If extraction fails for any
 * reason (provider error, malformed response), the entry is still saved with
 * no observations rather than blocking the user from journaling.
 */
export async function createJournalEntryWithAnalysis(text: string, entryDate?: Date): Promise<UiJournalEntry> {
  const observations: { type: ObservationType; label: string; normalizedValue?: string; confidence: number; source: "AI_EXTRACTED" }[] = [];

  try {
    const extractor = await getJournalObservationExtractor();
    const result = await extractor.extract(text);
    for (const obs of result.observations) {
      observations.push({
        type: obs.type,
        label: obs.label,
        normalizedValue: obs.normalizedValue,
        confidence: obs.confidence,
        source: "AI_EXTRACTED",
      });
    }
  } catch (err) {
    // Log only a short message, never the raw error object — it could carry
    // the request (including the raw journal text) on some AI SDK error
    // shapes. See docs/PRIVACY_ARCHITECTURE.md.
    const message = err instanceof Error ? err.message : "Unknown extraction error.";
    console.error(`Journal observation extraction failed; saving entry without observations: ${message}`);
  }

  const created = await journalRepo.createJournalEntry({ text, entryDate: entryDate ?? new Date() }, observations);
  return toUiEntry(created);
}
