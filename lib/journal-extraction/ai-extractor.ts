import { z } from "zod";
import type { AiProvider } from "@/lib/ai/types";
import { completeStructured } from "@/lib/ai/structured";
import { OBSERVATION_TYPES } from "@/lib/journal-extraction/types";
import type { JournalObservationExtractor, JournalExtractionResult } from "@/lib/journal-extraction/types";

const journalExtractionSchema = z.object({
  observations: z.array(
    z.object({
      type: z.enum(OBSERVATION_TYPES),
      label: z.string().describe("A short, human-readable description of what was noticed, e.g. 'Late large meal'."),
      normalizedValue: z.string().optional().describe("A short tag-style label, e.g. 'Late meal'."),
      confidence: z.number().min(0).max(1),
    })
  ),
});

const SYSTEM_PROMPT = `You are a careful assistant that finds structured, factual observations in a personal health journal entry. You never modify or quote back the original text as if it were your own words — you only extract short, separate observations that summarize what the entry actually says.

Rules:
- Every observation must be clearly supported by the text. Do not infer things the person didn't say (e.g. don't assume "tired" implies "poor sleep" unless sleep is actually mentioned).
- Use one of these fixed types for each observation: ${OBSERVATION_TYPES.join(", ")}.
- "label" should be a short factual description (3-6 words). "normalizedValue" should be an even shorter tag (1-3 words) suitable for a UI chip.
- Set "confidence" honestly: high (0.8+) for something stated plainly, lower for something only implied.
- If the entry contains no clear observations, return an empty array. Do not force an observation to exist.
- Never rewrite, summarize, or reproduce the entry's own sentences as an observation — extract discrete facts, not paraphrases.`;

export class AiJournalObservationExtractor implements JournalObservationExtractor {
  readonly name: string;

  constructor(private readonly provider: AiProvider) {
    this.name = `ai-${provider.name}`;
  }

  async extract(text: string): Promise<JournalExtractionResult> {
    const result = await completeStructured(this.provider, {
      system: SYSTEM_PROMPT,
      userText: `Journal entry:\n"""\n${text}\n"""`,
      schema: journalExtractionSchema,
      maxTokens: 1024,
    });

    return { extractorName: this.name, observations: result.observations };
  }
}
