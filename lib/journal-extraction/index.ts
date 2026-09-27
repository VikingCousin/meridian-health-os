import type { JournalObservationExtractor } from "@/lib/journal-extraction/types";
import { MockJournalObservationExtractor } from "@/lib/journal-extraction/mock-extractor";
import { AiJournalObservationExtractor } from "@/lib/journal-extraction/ai-extractor";
import { getAiProvider } from "@/lib/ai";

export type { JournalObservationExtractor, JournalExtractionResult, JournalObservationDraft, ObservationTypeValue } from "@/lib/journal-extraction/types";
export { OBSERVATION_TYPES } from "@/lib/journal-extraction/types";

// Same pattern as lib/extraction/index.ts: falls back to the deterministic
// mock extractor unless an AI provider is configured.
export async function getJournalObservationExtractor(): Promise<JournalObservationExtractor> {
  const provider = await getAiProvider();
  if (provider) return new AiJournalObservationExtractor(provider);
  return new MockJournalObservationExtractor();
}
