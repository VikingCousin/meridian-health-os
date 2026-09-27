import * as experimentRepo from "@/lib/db/repositories/experiment.repository";
import * as biomarkerRepo from "@/lib/db/repositories/biomarker.repository";
import type { Experiment as UiExperiment, ExperimentMetricSnapshot } from "@/types/health";
import type {
  HealthExperiment,
  ExperimentOutcome,
  ExperimentStatus as DbExperimentStatus,
} from "@/lib/generated/prisma/client";
import type { CreateExperimentInput } from "@/lib/validation/experiment";
import { differenceInCalendarDays, subDays } from "date-fns";

const statusToUi: Record<DbExperimentStatus, UiExperiment["status"]> = {
  PLANNED: "planned",
  ACTIVE: "active",
  COMPLETED: "completed",
  ABANDONED: "abandoned",
};

function average(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

/**
 * Computes a simple before/after snapshot for one biomarker-backed outcome:
 * the average value in the 14 days before the experiment started, versus the
 * average over the last 7 days (or since start, if shorter). This is plain
 * aggregation, not statistical inference — no significance testing is implied.
 */
async function computeSnapshot(
  outcome: ExperimentOutcome,
  experiment: HealthExperiment
): Promise<ExperimentMetricSnapshot | null> {
  if (outcome.metricType !== "BIOMARKER" || !outcome.metricReference) return null;

  const definition = await biomarkerRepo.findBiomarkerDefinitionByKey(outcome.metricReference);
  if (!definition) return null;

  const measurements = await biomarkerRepo.listMeasurementsForDefinition(definition.id);
  if (measurements.length === 0) return null;

  const baselineWindowStart = subDays(experiment.startDate, 14);
  const baselineValues = measurements
    .filter((m) => m.measuredAt >= baselineWindowStart && m.measuredAt < experiment.startDate)
    .map((m) => m.value);

  const now = new Date();
  const windowEnd = experiment.endDate < now ? experiment.endDate : now;
  const currentWindowStart = subDays(windowEnd, 7);
  const currentValues = measurements
    .filter((m) => m.measuredAt >= currentWindowStart && m.measuredAt <= windowEnd)
    .map((m) => m.value);

  const baseline = average(baselineValues);
  const current = average(currentValues);
  if (baseline === undefined || current === undefined) return null;

  return {
    metric: outcome.label,
    baseline,
    current,
    unit: measurements[measurements.length - 1].unit,
  };
}

async function toUiExperiment(
  experiment: HealthExperiment & { outcomes: ExperimentOutcome[] }
): Promise<UiExperiment> {
  const durationDays = Math.max(1, differenceInCalendarDays(experiment.endDate, experiment.startDate));
  const currentDay = Math.min(
    durationDays,
    Math.max(0, differenceInCalendarDays(new Date(), experiment.startDate))
  );

  const snapshots = (
    await Promise.all(experiment.outcomes.map((o) => computeSnapshot(o, experiment)))
  ).filter((s): s is ExperimentMetricSnapshot => s !== null);

  return {
    id: experiment.id,
    title: experiment.title,
    hypothesis: experiment.hypothesis,
    durationDays,
    currentDay,
    status: statusToUi[experiment.status],
    trackedMetrics: experiment.outcomes.map((o) => o.label),
    snapshots,
    startDate: experiment.startDate.toISOString(),
  };
}

export async function listExperiments(): Promise<UiExperiment[]> {
  const experiments = await experimentRepo.listExperiments();
  return Promise.all(experiments.map(toUiExperiment));
}

export async function createExperiment(input: CreateExperimentInput): Promise<UiExperiment> {
  const created = await experimentRepo.createExperiment(
    {
      title: input.title,
      hypothesis: input.hypothesis,
      protocol: input.protocol,
      startDate: input.startDate,
      endDate: input.endDate,
      status: input.status,
      notes: input.notes || undefined,
    },
    input.outcomes.map((o) => ({
      metricType: o.metricType,
      metricReference: o.metricReference,
      label: o.label,
    }))
  );
  return toUiExperiment(created);
}
