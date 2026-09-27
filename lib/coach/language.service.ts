import { getAiProvider } from "@/lib/ai";
import { completeStructured } from "@/lib/ai/structured";
import { coachLanguageSchema, type CoachLanguageOutput } from "@/lib/validation/coach";
import { buildMinimizedPayload } from "@/lib/coach/data-minimization";
import type { CoachContext, CoachPriorityView, SafetyResult } from "@/lib/coach/types";
import { LOCALE_ENGLISH_NAME, type Locale } from "@/lib/i18n/types";

const SYSTEM_PROMPT = `You are a phrasing layer for a personal health app called Meridian, not a doctor and not an independent decision-maker.

You will be given a small JSON object containing: the user's question, a safety classification, the user's active goals, active personal patterns, journal-category counts, and 1-3 already-decided priorities (each with a tier, title, reason, confidence, and burden).

Your ONLY job is to phrase this into natural, cautious language. You MUST NOT:
- invent any goal, pattern, priority, metric, or number not present in the JSON
- calculate anything (means, percentages, trends, scores)
- add a priority that isn't in the given list
- recommend a medication change, dosage change, or diagnosis
- override or soften the given safety classification
- use absolute or alarming language ("you need to," "this will cure," "you are overtrained")

Use cautious, observational language: "Your recorded X was Y" rather than "X causes Y." When confidence is "low," say so explicitly rather than implying certainty.

Respond with ONLY a JSON object: { "summary": string, "observationNotes": string[] (max 5), "followUpQuestions": string[] (max 4) }.`;

export interface LanguageGenerationResult {
  output: CoachLanguageOutput;
  aiGenerated: boolean;
}

function deterministicFallback(question: string, priorities: CoachPriorityView[], context: CoachContext): CoachLanguageOutput {
  if (priorities.length === 0) {
    return {
      summary:
        context.recentInsights.length === 0
          ? "There isn't enough active personal-pattern or goal data yet to suggest a specific focus — try running \"Analyze my health data\" from Insights, or add an active goal."
          : "No clear high-priority intervention stood out from your current goals and patterns.",
      observationNotes: [],
      followUpQuestions: ["What should I focus on this week?", "How am I progressing toward my goals?"],
    };
  }

  const primary = priorities[0];
  const summary = `Your current highest-priority focus is ${primary.title.toLowerCase()}.`;
  const observationNotes = priorities.map((p) => `${p.tier === "primary" ? "Primary" : p.tier === "secondary" ? "Secondary" : "Optional"}: ${p.title} — ${p.why}`);

  return {
    summary,
    observationNotes,
    followUpQuestions: ["Why these?", "What should I test next?", "How am I progressing toward my goals?"],
  };
}

/**
 * Generates the natural-language summary/observations/follow-ups for a
 * Coach turn. Uses the configured AI provider when available, with a
 * deterministic template fallback otherwise — the Coach's core
 * prioritization never depends on this succeeding (see
 * docs/COACH_ARCHITECTURE.md, "Coach without AI").
 */
export async function generateCoachLanguage(
  question: string,
  context: CoachContext,
  priorities: CoachPriorityView[],
  safety: SafetyResult,
  locale: Locale = "en"
): Promise<LanguageGenerationResult> {
  const provider = await getAiProvider();
  if (!provider) {
    return { output: deterministicFallback(question, priorities, context), aiGenerated: false };
  }

  const payload = buildMinimizedPayload(question, context, priorities, safety);

  // Explicit locale context appended to the fixed system prompt — the model
  // never decides what to say (that's all in the JSON payload above), only
  // what language to say it in. Never duplicates language logic elsewhere.
  const localizedSystemPrompt =
    locale === "en" ? SYSTEM_PROMPT : `${SYSTEM_PROMPT}\n\nRespond in ${LOCALE_ENGLISH_NAME[locale]}, not English.`;

  try {
    const output = await completeStructured(provider, {
      system: localizedSystemPrompt,
      userText: JSON.stringify(payload),
      schema: coachLanguageSchema,
      maxTokens: 700,
    });
    return { output, aiGenerated: true };
  } catch {
    // Never lose the user's question to a provider hiccup or a malformed
    // response — fall back to the deterministic template instead.
    return { output: deterministicFallback(question, priorities, context), aiGenerated: false };
  }
}
