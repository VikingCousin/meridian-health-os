import { analyzeJournalText } from "@/lib/journal-analysis";
import type { JournalObservationExtractor, JournalExtractionResult, ObservationTypeValue } from "@/lib/journal-extraction/types";
import type { JournalTag } from "@/types/health";

const categoryToObservationType: Record<JournalTag["category"], ObservationTypeValue> = {
  nutrition: "FOOD",
  sleep: "SLEEP",
  training: "TRAINING",
  mood: "MOOD",
  symptom: "SYMPTOM",
  other: "OTHER",
};

/**
 * The original Phase 1 keyword-matching pass, wrapped behind the real
 * extractor interface. This is the default when no AI provider is
 * configured — no external call, deterministic, good enough to exercise the
 * full journal -> observations pipeline.
 */
export class MockJournalObservationExtractor implements JournalObservationExtractor {
  readonly name = "mock-v1";

  async extract(text: string): Promise<JournalExtractionResult> {
    const { tags, aiObservations } = analyzeJournalText(text);

    return {
      extractorName: this.name,
      observations: tags.map((tag, index) => ({
        type: categoryToObservationType[tag.category],
        label: aiObservations[index] ?? tag.label,
        normalizedValue: tag.label,
        confidence: 0.6,
      })),
    };
  }
}
