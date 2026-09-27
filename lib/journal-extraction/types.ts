// Mirrors lib/extraction/types.ts for journal text instead of lab documents.
// Kept deliberately independent of Prisma — this interface describes plain
// data, and lib/services/journal.service.ts maps it onto the DB schema.

export const OBSERVATION_TYPES = [
  "MOOD",
  "ENERGY",
  "STRESS",
  "SLEEP",
  "FOOD",
  "ALCOHOL",
  "CAFFEINE",
  "TRAINING",
  "PAIN",
  "SYMPTOM",
  "MEDICATION",
  "SUPPLEMENT",
  "LIFESTYLE",
  "OTHER",
] as const;

export type ObservationTypeValue = (typeof OBSERVATION_TYPES)[number];

export interface JournalObservationDraft {
  type: ObservationTypeValue;
  /** A short, human-readable description, e.g. "Late large meal". */
  label: string;
  /** A short chip-style value for the tag itself, e.g. "Late meal". */
  normalizedValue?: string;
  /** 0-1: how confident the extractor is that this observation is actually present in the text. */
  confidence: number;
}

export interface JournalExtractionResult {
  observations: JournalObservationDraft[];
  extractorName: string;
}

export interface JournalObservationExtractor {
  readonly name: string;
  extract(text: string): Promise<JournalExtractionResult>;
}
