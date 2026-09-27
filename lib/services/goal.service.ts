import * as goalRepo from "@/lib/db/repositories/goal.repository";
import { fromUiBodySystem, parseStringArray } from "@/lib/services/enum-maps";
import type { Goal as UiGoal, GoalKind, GoalStatus, BodySystemId } from "@/types/health";
import type { Goal, GoalKind as DbGoalKind, GoalStatus as DbGoalStatus, GoalCategory, GoalPriority } from "@/lib/generated/prisma/client";
import type { CreateGoalInput } from "@/lib/validation/goal";

const kindToUi: Record<DbGoalKind, GoalKind> = {
  LONG_TERM: "long_term",
  SUPPORTING: "supporting",
  PROJECT: "project",
};
const kindFromUi: Record<GoalKind, DbGoalKind> = {
  long_term: "LONG_TERM",
  supporting: "SUPPORTING",
  project: "PROJECT",
};

const statusToUi: Record<DbGoalStatus, GoalStatus> = {
  ON_TRACK: "on_track",
  ATTENTION: "attention",
  PREPARATION: "preparation",
  COMPLETED: "completed",
  ABANDONED: "abandoned",
};
const statusFromUi: Record<GoalStatus, DbGoalStatus> = {
  on_track: "ON_TRACK",
  attention: "ATTENTION",
  preparation: "PREPARATION",
  completed: "COMPLETED",
  abandoned: "ABANDONED",
};

const timeHorizonToUi: Record<string, UiGoal["timeHorizon"]> = {
  LONG_TERM: "long_term",
  QUARTER: "quarter",
  MONTH: "month",
  TEMPORARY: "temporary",
};

function toUiGoal(goal: Goal): UiGoal {
  const bodySystems = parseStringArray(goal.bodySystems) as Uppercase<BodySystemId>[];
  return {
    id: goal.id,
    kind: kindToUi[goal.kind],
    title: goal.title,
    description: goal.description ?? "",
    status: statusToUi[goal.status],
    progress: goal.progress ?? undefined,
    targetDate: goal.targetDate?.toISOString(),
    relatedSystems: bodySystems
      .map((s) => s.toLowerCase())
      .filter((s): s is BodySystemId =>
        ["brain", "cardiovascular", "lungs", "liver", "gut", "kidneys", "metabolic", "musculoskeletal", "immune"].includes(s)
      ),
    category: goal.category,
    parentGoalId: goal.parentGoalId ?? undefined,
    timeHorizon: goal.timeHorizon ? timeHorizonToUi[goal.timeHorizon] : undefined,
    rationale: goal.rationale ?? undefined,
    successCriteria: goal.successCriteria ?? undefined,
  };
}

export async function listGoals(): Promise<UiGoal[]> {
  const goals = await goalRepo.listGoals();
  return goals.map(toUiGoal);
}

export async function createGoal(input: CreateGoalInput): Promise<UiGoal> {
  const created = await goalRepo.createGoal({
    title: input.title,
    description: input.description || undefined,
    category: input.category as GoalCategory,
    kind: kindFromUi[input.kind],
    priority: input.priority as GoalPriority,
    status: statusFromUi[input.status],
    progress: input.progress,
    startDate: input.startDate,
    targetDate: input.targetDate,
    bodySystems: input.bodySystems.map((s) => fromUiBodySystem(s)),
  });
  return toUiGoal(created);
}
