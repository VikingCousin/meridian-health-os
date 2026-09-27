import { JournalTag } from "@/types/health";

// Naive keyword-based mock of an AI tagging pass. In the real product this
// would be a model call; here it exists purely to demonstrate the UX of
// deriving structured tags from free text without ever altering the original entry.
const KEYWORD_RULES: { pattern: RegExp; tag: JournalTag; observation: string }[] = [
  { pattern: /tired|fatigue|exhaust/i, tag: { label: "Fatigue", category: "mood" }, observation: "Morning fatigue" },
  { pattern: /late.*(dinner|meal|pasta|eat)|large (dinner|meal)/i, tag: { label: "Late meal", category: "nutrition" }, observation: "Late large meal" },
  { pattern: /woke|wake|interrupt|restless/i, tag: { label: "Poor sleep", category: "sleep" }, observation: "Multiple sleep interruptions" },
  { pattern: /good sleep|slept great|slept well/i, tag: { label: "Good sleep", category: "sleep" }, observation: "Good sleep quality" },
  { pattern: /motivat/i, tag: { label: "Low motivation", category: "mood" }, observation: "Lower motivation" },
  { pattern: /train|gym|run|judo|lift|workout/i, tag: { label: "Training", category: "training" }, observation: "Training session logged" },
  { pattern: /sore|pain|ache|injur/i, tag: { label: "Soreness", category: "symptom" }, observation: "Minor soreness or discomfort" },
  { pattern: /bloat|digest|stomach|gut/i, tag: { label: "Digestion", category: "symptom" }, observation: "Digestive symptom" },
  { pattern: /stress|anxious|overwhelm/i, tag: { label: "Stress", category: "mood" }, observation: "Elevated stress" },
  { pattern: /energy|energetic/i, tag: { label: "Energy", category: "mood" }, observation: "Energy level noted" },
];

export function analyzeJournalText(text: string): { tags: JournalTag[]; aiObservations: string[] } {
  const tags: JournalTag[] = [];
  const observations: string[] = [];

  for (const rule of KEYWORD_RULES) {
    if (rule.pattern.test(text)) {
      tags.push(rule.tag);
      observations.push(rule.observation);
    }
  }

  if (tags.length === 0) {
    tags.push({ label: "Reflection", category: "other" });
  }

  return { tags, aiObservations: observations };
}
