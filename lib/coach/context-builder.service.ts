import { getProfileBundle } from "@/lib/services/profile.service";
import { listGoals } from "@/lib/services/goal.service";
import { listExperiments } from "@/lib/services/experiment.service";
import { listJournalEntries } from "@/lib/services/journal.service";
import { listActiveInsightSummaries } from "@/lib/services/insight.service";
import { getBiomarkerDetail, resolveDefinitionByRawName } from "@/lib/services/biomarker.service";
import { listActiveHealthModes } from "@/lib/services/health-mode.service";
import type { IntentResult } from "@/lib/coach/intent-router.service";
import type { CoachContext, CoachBiomarkerContext, CoachGoalContext, CoachJournalObservationContext } from "@/lib/coach/types";

/** Journal observations older than this are out of the "recent" window — see docs/COACH_ARCHITECTURE.md. */
const JOURNAL_WINDOW_DAYS = 14;
const MAX_JOURNAL_OBSERVATIONS = 20;
const MAX_ACTIVE_GOALS = 8;
const MAX_RECENT_INSIGHTS = 5;
const MAX_BIOMARKERS = 6;

/** The default curated set of metrics considered "relevant" absent a more specific signal from intent or active goals/insights. */
const DEFAULT_METRIC_KEYS = ["hrv", "sleep_duration", "sleep_score", "resting_hr", "training_load", "stress_level"];

function goalIsActive(status: string): boolean {
  return status !== "completed" && status !== "abandoned";
}

async function resolveBiomarkerKeys(intent: IntentResult, goals: CoachGoalContext[], insightMetricKeys: string[]): Promise<string[]> {
  if (intent.intent === "explain_metric" && intent.metricPhrase) {
    const definition = await resolveDefinitionByRawName(intent.metricPhrase);
    if (definition) return [definition.canonicalKey];
  }

  const keys = new Set<string>();
  for (const key of insightMetricKeys) keys.add(key);
  // A rough goal-category -> metric mapping — enough to bias the default set, not a full mapping table.
  const categoryMetrics: Record<string, string[]> = {
    CARDIOVASCULAR: ["hrv", "resting_hr", "vo2max"],
    AEROBIC: ["vo2max", "training_load"],
    SLEEP: ["sleep_duration", "sleep_score"],
    STRENGTH: ["training_load"],
    METABOLIC: ["stress_level"],
  };
  for (const goal of goals) {
    for (const key of categoryMetrics[goal.category] ?? []) keys.add(key);
  }
  for (const key of DEFAULT_METRIC_KEYS) keys.add(key);
  return [...keys].slice(0, MAX_BIOMARKERS);
}

/**
 * Builds the ONLY structured context the deterministic pipeline (and,
 * later, the LLM) reasons over. Bounded windows and relevance filtering are
 * enforced here — nothing downstream queries the database on its own.
 */
export async function buildCoachContext(intent: IntentResult): Promise<CoachContext> {
  const [{ profile, medicalHistory, medications, supplements }, allGoals, allExperiments, allInsights, allJournalEntries, activeModes] = await Promise.all([
    getProfileBundle(),
    listGoals(),
    listExperiments(),
    listActiveInsightSummaries(),
    listJournalEntries(),
    listActiveHealthModes(),
  ]);

  const activeGoals: CoachGoalContext[] = allGoals
    .filter((g) => goalIsActive(g.status))
    .slice(0, MAX_ACTIVE_GOALS)
    .map((g) => ({
      id: g.id,
      title: g.title,
      kind: g.kind,
      category: g.category,
      status: g.status,
      priority: "MEDIUM",
      progress: g.progress,
      rationale: g.rationale ?? g.description ?? undefined,
    }));

  const activeExperiments = allExperiments
    .filter((e) => e.status === "active" || e.status === "planned")
    .map((e) => ({ id: e.id, title: e.title, status: e.status, trackedMetrics: e.trackedMetrics }));

  const recentInsights = [...allInsights]
    .filter((i) => i.status === "active" || i.status === "watching" || i.status === "confirmed")
    .sort((a, b) => (a.lastObservedAt < b.lastObservedAt ? 1 : -1))
    .slice(0, MAX_RECENT_INSIGHTS);

  const insightMetricKeys = recentInsights.map((i) => i.primaryMetricKey).filter((k): k is string => !!k);

  const biomarkerKeys = await resolveBiomarkerKeys(intent, activeGoals, insightMetricKeys);
  const biomarkerDetails = await Promise.all(biomarkerKeys.map((key) => getBiomarkerDetail(key)));
  const relevantBiomarkers: CoachBiomarkerContext[] = biomarkerDetails
    .filter((b): b is NonNullable<typeof b> => b !== null)
    .map((b) => ({ key: b.id, name: b.name, currentValue: b.currentValue, unit: b.unit, trendDirection: b.trendDirection, changePct: b.changePct }));

  const journalWindowStart = new Date(Date.now() - JOURNAL_WINDOW_DAYS * 86_400_000);
  const recentJournalObservations: CoachJournalObservationContext[] = allJournalEntries
    .filter((e) => new Date(e.date) >= journalWindowStart)
    .flatMap((e) => e.tags.map((t) => ({ date: e.date, label: t.label, category: t.category })))
    .slice(0, MAX_JOURNAL_OBSERVATIONS);

  const dataQualityNotes = recentInsights.length === 0 ? ["No active personal patterns yet — run \"Analyze my health data\" from Insights."] : [];

  return {
    profileFirstName: profile.firstName,
    activeGoals,
    activeExperiments,
    recentInsights,
    relevantBiomarkers,
    recentJournalObservations,
    currentModes: activeModes,
    dataQuality: { overallStatus: recentInsights.length > 0 ? "good" : "limited", notes: dataQualityNotes },
    safetyContext: {
      medications: medications.filter((m) => m.active).map((m) => m.name),
      supplements: supplements.filter((s) => s.active).map((s) => s.name),
      medicalConditions: medicalHistory.map((h) => h.condition),
    },
  };
}
