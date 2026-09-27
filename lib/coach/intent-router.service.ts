// A small, deterministic intent classifier — NOT an LLM query planner. This
// decides which context the context builder should emphasize; the LLM never
// decides what to fetch. See docs/COACH_ARCHITECTURE.md, "Context builder."

export type CoachIntent =
  | "weekly_focus"
  | "explain_metric"
  | "explain_recovery"
  | "goal_progress"
  | "pattern_question"
  | "experiment_suggestion"
  | "general";

export interface IntentResult {
  intent: CoachIntent;
  /** For explain_metric: the raw phrase to resolve against the biomarker catalog. */
  metricPhrase?: string;
}

const RULES: { intent: CoachIntent; pattern: RegExp }[] = [
  { intent: "weekly_focus", pattern: /focus.*(this week|today|now)|what should i (focus|prioriti[sz]e)|biggest.*priorit|top.*priorit|highest.leverage/i },
  { intent: "explain_recovery", pattern: /recovery|why.*(tired|exhausted|worse)|hrv.*(low|down|worse)/i },
  { intent: "goal_progress", pattern: /progress.*(goal|toward)|how am i (doing|progressing)|goals?\b.*progress/i },
  { intent: "pattern_question", pattern: /pattern|correlat|associat|affecting my (sleep|recovery|energy)/i },
  { intent: "experiment_suggestion", pattern: /what should i test|test next|new experiment|worth testing/i },
];

const METRIC_EXPLAIN_RE = /explain (my )?([a-z0-9 ]+?)( trend| history| levels?)?\??$/i;

export function classifyIntent(question: string): IntentResult {
  const metricMatch = question.match(METRIC_EXPLAIN_RE);
  if (metricMatch) {
    return { intent: "explain_metric", metricPhrase: metricMatch[2].trim().toLowerCase() };
  }

  for (const rule of RULES) {
    if (rule.pattern.test(question)) return { intent: rule.intent };
  }

  return { intent: "general" };
}
