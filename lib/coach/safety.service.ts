import type { SafetyClassification, SafetyResult } from "@/lib/coach/types";

// A deterministic, keyword-based safety classifier — the same pattern as
// lib/journal-analysis.ts's KEYWORD_RULES, applied to the user's own
// question rather than journal text. This runs BEFORE any LLM call, and its
// result is never overridden by the model — see docs/COACH_ARCHITECTURE.md,
// "Safety layer." This does not diagnose; it only routes the response
// toward "recommend professional evaluation" language for higher-risk
// territory.

interface SafetyRule {
  classification: SafetyClassification;
  pattern: RegExp;
  reason: string;
}

const URGENT_MESSAGE =
  "This sounds like it could need urgent attention. Please contact a medical professional or emergency services rather than waiting on an app response.";
const MEDICAL_REVIEW_MESSAGE =
  "This is worth discussing with a doctor or pharmacist rather than deciding here — Meridian can help you track what you observe, but it doesn't make medication or treatment decisions.";

// Ordered most-specific/most-urgent first — the first match wins.
const RULES: SafetyRule[] = [
  {
    classification: "URGENT_MEDICAL_ATTENTION",
    pattern: /chest pain|can'?t breathe|difficulty breathing|severe (bleeding|pain)|stroke|numbness (on |in )?(one side|my (left|right))|slurred speech|suicidal|thoughts of (suicide|self.?harm)|overdose|anaphyla/i,
    reason: "Question mentions symptoms consistent with a possible medical emergency.",
  },
  {
    classification: "URGENT_MEDICAL_ATTENTION",
    pattern: /(injury|fell|fall|hit my head).*(numbness|can'?t feel|can'?t move|tingling)|(numbness|can'?t feel|can'?t move|tingling).*(injury|fell|after (a )?fall)/i,
    reason: "Question describes an injury with possible neurological symptoms.",
  },
  {
    classification: "MEDICAL_REVIEW_RECOMMENDED",
    pattern: /stop (taking|my)|should i stop (my )?(medication|meds|prescription)|increase (my )?dose|decrease (my )?dose|change (my )?dosage|double (my )?dose/i,
    reason: "Question asks about changing or stopping a medication.",
  },
  {
    classification: "MEDICAL_REVIEW_RECOMMENDED",
    pattern: /drug interaction|interact with my (medication|meds|prescription)|safe to take .* with (my )?(medication|meds)/i,
    reason: "Question asks about a supplement-medication interaction.",
  },
  {
    classification: "MEDICAL_REVIEW_RECOMMENDED",
    pattern: /do i have|am i (diagnosed|diabetic|anemic)|diagnos(e|is)|what (disease|condition) (do i have|is this)/i,
    reason: "Question asks for a diagnosis.",
  },
  {
    classification: "MEDICAL_REVIEW_RECOMMENDED",
    pattern: /extreme fast(ing)?|water fast|prolonged fast|\b(3|four|4|five|5|six|6|seven|7)\s*day fast/i,
    reason: "Question involves extended/extreme fasting.",
  },
  {
    classification: "MEDICAL_REVIEW_RECOMMENDED",
    pattern: /severe symptom|worsening symptom|persistent (pain|fever)|fever.*(day|week)/i,
    reason: "Question describes severe or persistent symptoms.",
  },
];

export function classifySafety(question: string): SafetyResult {
  for (const rule of RULES) {
    if (rule.pattern.test(question)) {
      return {
        classification: rule.classification,
        reasons: [rule.reason],
        message: rule.classification === "URGENT_MEDICAL_ATTENTION" ? URGENT_MESSAGE : MEDICAL_REVIEW_MESSAGE,
      };
    }
  }

  const mentionsPersonalHealthData = /\b(my|i'?m|i am|i|me)\b/i.test(question);
  return {
    classification: mentionsPersonalHealthData ? "PERSONAL_HEALTH_CONTEXT" : "GENERAL_WELLNESS",
    reasons: [],
  };
}
