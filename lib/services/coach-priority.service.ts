import * as coachPriorityRepo from "@/lib/db/repositories/coach-priority.repository";
import { getInterventionById } from "@/lib/coach/intervention-catalog";
import { computeWeeklyPriorities } from "@/lib/coach/coach-orchestrator.service";
import { parseStringArray } from "@/lib/services/enum-maps";
import type { CoachPriority as DbCoachPriority, CoachPriorityStatus as DbStatus } from "@/lib/generated/prisma/client";
import type { FocusItem, PersistedCoachPriority, PersistedCoachPriorityStatus, PriorityCardData, PriorityTier } from "@/lib/coach/types";
import type { BodySystemId } from "@/types/health";

const statusToUi: Record<DbStatus, PersistedCoachPriorityStatus> = {
  SUGGESTED: "suggested",
  ACCEPTED: "accepted",
  ACTIVE: "active",
  COMPLETED: "completed",
  DISMISSED: "dismissed",
};

function tierFromRank(rank: number): PriorityTier {
  return rank === 0 ? "primary" : rank === 1 ? "secondary" : "optional";
}

interface StoredMetadata {
  confidence?: PersistedCoachPriority["confidence"];
  burden?: PersistedCoachPriority["burden"];
  requiresMedicalReview?: boolean;
}

function toUi(row: DbCoachPriority): PersistedCoachPriority {
  const metadata = (row.metadata ?? {}) as StoredMetadata;
  return {
    id: row.id,
    interventionId: row.interventionDefinitionId,
    title: row.title,
    status: statusToUi[row.status],
    tier: tierFromRank(row.rank),
    score: row.score,
    reason: row.reason,
    linkedGoalIds: parseStringArray(row.linkedGoalIds),
    linkedInsightIds: parseStringArray(row.linkedInsightIds),
    linkedMetricKeys: getInterventionById(row.interventionDefinitionId)?.measurementOptions ?? [],
    startedAt: row.startedAt.toISOString(),
    confidence: metadata.confidence ?? "moderate",
    burden: metadata.burden ?? "MEDIUM",
    requiresMedicalReview: metadata.requiresMedicalReview ?? false,
  };
}

/** Only active/accepted priorities, in rank order, capped like everywhere else in the Coach — never a long list. */
export async function listActivePriorities(): Promise<PersistedCoachPriority[]> {
  const rows = await coachPriorityRepo.listActiveCoachPriorities();
  return rows.map(toUi);
}

export async function listAllPriorities(): Promise<PersistedCoachPriority[]> {
  const rows = await coachPriorityRepo.listCoachPriorities();
  return rows.map(toUi);
}

const tierToRank: Record<PriorityTier, number> = { primary: 0, secondary: 1, optional: 2 };

/**
 * Persists a suggested priority as ACCEPTED — the only way a `CoachPriority`
 * row is ever created. Re-accepting an intervention that's already
 * active/accepted just returns the existing row rather than duplicating it.
 */
export async function acceptPriority(view: PriorityCardData): Promise<PersistedCoachPriority> {
  const existing = await coachPriorityRepo.findActiveByIntervention(view.interventionId);
  if (existing) return toUi(existing);

  const created = await coachPriorityRepo.createCoachPriority({
    interventionDefinitionId: view.interventionId,
    title: view.title,
    status: "ACCEPTED",
    score: view.score,
    rank: tierToRank[view.tier],
    reason: view.why,
    linkedGoalIds: view.linkedGoalIds,
    linkedInsightIds: view.linkedInsightIds,
    metadata: { confidence: view.confidence, burden: view.burden, requiresMedicalReview: view.requiresMedicalReview },
  });
  return toUi(created);
}

export async function dismissPriority(id: string): Promise<void> {
  await coachPriorityRepo.updateCoachPriority(id, { status: "DISMISSED", endedAt: new Date() });
}

export async function completePriority(id: string): Promise<void> {
  await coachPriorityRepo.updateCoachPriority(id, { status: "COMPLETED", endedAt: new Date() });
}

export interface CoachExperimentPrefillData {
  title: string;
  hypothesis: string;
  protocol: string;
  durationDays: number;
  outcomes: { label: string; metricType: "BIOMARKER" | "SUBJECTIVE_RATING"; metricReference?: string }[];
}

/**
 * "Current focus" for Home/Body/plan: prefers the user's own accepted
 * priorities; only falls back to a freshly-computed suggestion when nothing
 * has been accepted yet. Never mixes the two — an accepted list is the
 * user's own decision and takes full precedence.
 */
export async function getCurrentFocus(limit = 3): Promise<FocusItem[]> {
  const accepted = await listActivePriorities();
  if (accepted.length > 0) {
    return accepted.slice(0, limit).map((p) => ({
      persistedId: p.id,
      interventionId: p.interventionId,
      title: p.title,
      tier: p.tier,
      why: p.reason,
      linkedGoalIds: p.linkedGoalIds,
      linkedInsightIds: p.linkedInsightIds,
    }));
  }

  const computed = await computeWeeklyPriorities();
  return computed.slice(0, limit).map((p) => ({
    interventionId: p.interventionId,
    title: p.title,
    tier: p.tier,
    why: p.why,
    linkedGoalIds: p.linkedGoalIds,
    linkedInsightIds: p.linkedInsightIds,
  }));
}

/**
 * Prefills (but never saves) an experiment draft for "Test this" on a
 * priority — same review-and-confirm pattern as the Insight -> Experiment
 * bridge (see lib/services/insight.service.ts#buildExperimentPrefill).
 */
/** Body-page variant of getCurrentFocus — filtered to interventions that target the given body system, capped at 2 so the anatomical interface doesn't get cluttered (see docs/COACH_ARCHITECTURE.md, "Body integration"). */
export async function getCurrentFocusForSystem(system: BodySystemId, limit = 2): Promise<FocusItem[]> {
  const all = await getCurrentFocus(10);
  return all.filter((item) => getInterventionById(item.interventionId)?.targetSystems.includes(system)).slice(0, limit);
}

export function buildExperimentPrefillFromPriority(view: PriorityCardData): CoachExperimentPrefillData {
  return {
    title: `Test: ${view.title}`,
    hypothesis: `${view.title} may help, based on: ${view.why} (personal confidence: ${view.confidence}).`,
    protocol: `For 14 days, apply "${view.title.toLowerCase()}" and keep logging your usual metrics.`,
    durationDays: 14,
    outcomes: view.linkedMetricKeys.slice(0, 4).map((key) => ({ label: key.replace(/_/g, " "), metricType: "BIOMARKER" as const, metricReference: key })),
  };
}
