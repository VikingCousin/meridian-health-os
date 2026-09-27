import * as biomarkerRepo from "@/lib/db/repositories/biomarker.repository";
import * as journalRepo from "@/lib/db/repositories/journal.repository";
import * as goalRepo from "@/lib/db/repositories/goal.repository";
import * as experimentRepo from "@/lib/db/repositories/experiment.repository";
import { timelineEvents as mockTimelineEvents } from "@/lib/mock-data/timeline";
import { getAppSettings } from "@/lib/services/settings.service";
import type { HealthEvent } from "@/types/health";
import { format } from "date-fns";

// Event types below are not backed by a dedicated model yet (workouts,
// illness episodes, supplement start dates, weigh-ins as a standalone log) —
// see docs/DATA_MODEL.md "What's still mock" for the migration plan. Everything
// else (labs, journal, goals, experiments) is aggregated live from the database.
const STILL_MOCK_TYPES: HealthEvent["type"][] = ["training", "illness", "weight", "supplement", "wearable"];

async function buildLabEvents(): Promise<HealthEvent[]> {
  const measurements = await biomarkerRepo.listRecentMeasurements(500);
  const labSourced = measurements.filter((m) => m.sourceType === "LAB_REPORT" || m.sourceType === "AI_EXTRACTED");

  const groups = new Map<string, typeof labSourced>();
  for (const m of labSourced) {
    const key = m.measuredAt.toISOString().slice(0, 10);
    const group = groups.get(key) ?? [];
    group.push(m);
    groups.set(key, group);
  }

  return Array.from(groups.entries()).map(([dateKey, group]) => {
    const providerName = group.find((m) => m.sourceDocument?.providerName)?.sourceDocument?.providerName;
    return {
      id: `lab-${dateKey}`,
      type: "lab",
      date: group[0].measuredAt.toISOString(),
      title: providerName ? `Laboratory panel · ${providerName}` : "Laboratory panel",
      metrics: group.slice(0, 4).map((m) => ({
        label: m.biomarkerDefinition.shortName ?? m.biomarkerDefinition.displayName,
        value: `${m.value} ${m.unit}`,
      })),
      tags: ["Labs"],
      source: {
        type: group[0].sourceType === "AI_EXTRACTED" ? ("ai_extracted" as const) : ("lab" as const),
        label: providerName ?? "Lab report",
        date: group[0].measuredAt.toISOString(),
      },
    };
  });
}

async function buildJournalEvents(): Promise<HealthEvent[]> {
  const entries = await journalRepo.listJournalEntries();
  return entries.map((entry) => {
    const categories = Array.from(new Set(entry.observations.map((o) => o.type)));
    return {
      id: `journal-${entry.id}`,
      type: "journal",
      date: entry.entryDate.toISOString(),
      title: "Journal entry",
      detail: `"${entry.text}"`,
      tags: ["Journal", ...categories.slice(0, 2).map((c) => c.charAt(0) + c.slice(1).toLowerCase())],
      source: { type: "journal", label: "Journal", subjective: true },
    };
  });
}

async function buildGoalEvents(): Promise<HealthEvent[]> {
  const goals = await goalRepo.listGoals();
  return goals
    .filter((g) => g.kind === "PROJECT")
    .map((goal) => ({
      id: `goal-${goal.id}`,
      type: "goal",
      date: goal.createdAt.toISOString(),
      title: `Goal set: ${goal.title}`,
      detail: goal.targetDate ? `Target date ${format(goal.targetDate, "d MMMM yyyy")}.` : goal.description ?? undefined,
      tags: ["Goals"],
      source: { type: "manual", label: "Manual entry" },
    }));
}

async function buildExperimentEvents(): Promise<HealthEvent[]> {
  const experiments = await experimentRepo.listExperiments();
  return experiments.map((experiment) => ({
    id: `experiment-${experiment.id}`,
    type: "experiment",
    date: experiment.startDate.toISOString(),
    title: "Health experiment started",
    detail: experiment.title,
    tags: ["Experiments"],
    source: { type: "manual", label: "Manual entry" },
  }));
}

export async function buildTimeline(): Promise<HealthEvent[]> {
  const [labEvents, journalEvents, goalEvents, experimentEvents, settings] = await Promise.all([
    buildLabEvents(),
    buildJournalEvents(),
    buildGoalEvents(),
    buildExperimentEvents(),
    getAppSettings(),
  ]);

  // These event types (training/illness/weight/supplement/wearable) have no
  // dedicated model yet (see docs/DATA_MODEL.md, "What's still mock") — they
  // must never appear in real-user mode, since they'd be indistinguishable
  // from genuine events with no labeling. Demo mode is the only place they
  // belong, illustrating what a fuller timeline looks like.
  const legacyMockEvents = settings.demoMode ? mockTimelineEvents.filter((e) => STILL_MOCK_TYPES.includes(e.type)) : [];

  return [...labEvents, ...journalEvents, ...goalEvents, ...experimentEvents, ...legacyMockEvents].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}
