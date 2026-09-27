import * as biomarkerRepo from "@/lib/db/repositories/biomarker.repository";
import { toUiBodySystem, toUiDataSourceType, fromUiBodySystem } from "@/lib/services/enum-maps";
import type { Biomarker, BodySystemId, MetricRange, TrendDirection, TrendPoint } from "@/types/health";
import type { BiomarkerDefinition, BiomarkerMeasurement, HealthDataSource, HealthDocument } from "@/lib/generated/prisma/client";
import { format } from "date-fns";

function normalize(name: string): string {
  return name.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

/** Resolves a raw lab-report field name (e.g. "Apo B") to its BiomarkerDefinition, via canonicalKey or aliases. */
export async function resolveDefinitionByRawName(rawName: string): Promise<BiomarkerDefinition | null> {
  const definitions = await biomarkerRepo.listBiomarkerDefinitions();
  const target = normalize(rawName);

  const exact = definitions.find((d) => normalize(d.canonicalKey) === target || normalize(d.displayName) === target);
  if (exact) return exact;

  return (
    definitions.find((d) => {
      const aliases = Array.isArray(d.aliases) ? (d.aliases as unknown[]) : [];
      return aliases.some((alias) => typeof alias === "string" && normalize(alias) === target);
    }) ?? null
  );
}

type MeasurementWithDoc = BiomarkerMeasurement & { sourceDocument?: HealthDocument | null; dataSource?: HealthDataSource | null };

function computeDataCompleteness(count: number): Biomarker["dataCompleteness"] {
  if (count >= 3) return "complete";
  if (count === 2) return "partial";
  return "sparse";
}

function computeTrend(current: number, previous?: number): { direction: TrendDirection; changePct?: number } {
  if (previous === undefined || previous === 0) return { direction: "flat" };
  const changePct = ((current - previous) / Math.abs(previous)) * 100;
  if (Math.abs(changePct) < 0.5) return { direction: "flat", changePct };
  return { direction: changePct > 0 ? "up" : "down", changePct };
}

export function toUiBiomarker(definition: BiomarkerDefinition, measurements: MeasurementWithDoc[]): Biomarker | null {
  if (measurements.length === 0) return null;
  const sorted = [...measurements].sort((a, b) => a.measuredAt.getTime() - b.measuredAt.getTime());
  const latest = sorted[sorted.length - 1];
  const previous = sorted.length > 1 ? sorted[sorted.length - 2] : undefined;
  const { direction, changePct } = computeTrend(latest.value, previous?.value);

  const ranges: MetricRange[] = [];
  if (latest.personalTargetMin !== null || latest.personalTargetMax !== null) {
    ranges.push({
      kind: "personal_target",
      label: "Personal target",
      min: latest.personalTargetMin ?? undefined,
      max: latest.personalTargetMax ?? undefined,
      display: formatRange(latest.personalTargetMin, latest.personalTargetMax, latest.unit),
    });
  }
  if (latest.referenceMin !== null || latest.referenceMax !== null || latest.referenceText) {
    ranges.push({
      kind: "lab_reference",
      label: "Lab reference",
      min: latest.referenceMin ?? undefined,
      max: latest.referenceMax ?? undefined,
      display: latest.referenceText ?? formatRange(latest.referenceMin, latest.referenceMax, latest.unit),
    });
  }

  const history: TrendPoint[] = sorted.map((m) => ({
    date: m.measuredAt.toISOString(),
    label: format(m.measuredAt, "MMM yyyy"),
    value: m.value,
  }));

  return {
    id: definition.canonicalKey,
    name: definition.displayName,
    shortName: definition.shortName ?? definition.displayName,
    category: definition.bodySystem ? toUiBodySystem(definition.bodySystem) : "metabolic",
    unit: latest.unit,
    currentValue: latest.value,
    previousValue: previous?.value,
    changePct,
    trendDirection: direction,
    ranges,
    history,
    lastMeasured: latest.measuredAt.toISOString(),
    source: {
      type: toUiDataSourceType(latest.sourceType),
      label: latest.sourceDocument?.providerName ?? latest.dataSource?.displayName ?? defaultSourceLabel(latest.sourceType),
      date: latest.measuredAt.toISOString(),
    },
    description: definition.description ?? "",
    whyItMatters: definition.whyItMatters ?? "Tracked over time to help spot meaningful personal trends.",
    dataCompleteness: computeDataCompleteness(sorted.length),
  };
}

function defaultSourceLabel(sourceType: BiomarkerMeasurement["sourceType"]): string {
  switch (sourceType) {
    case "LAB_REPORT":
      return "Lab report";
    case "WEARABLE":
      return "Wearable";
    case "MANUAL":
      return "Manual entry";
    case "IMPORT":
      return "Imported document";
    case "AI_EXTRACTED":
      return "AI extracted";
    case "CALCULATED":
      return "Calculated";
    default:
      return "Unknown source";
  }
}

function formatRange(min?: number | null, max?: number | null, unit?: string): string {
  if (min !== null && min !== undefined && max !== null && max !== undefined) return `${min}–${max} ${unit ?? ""}`.trim();
  if (max !== null && max !== undefined) return `<${max} ${unit ?? ""}`.trim();
  if (min !== null && min !== undefined) return `>${min} ${unit ?? ""}`.trim();
  return "—";
}

export async function listBiomarkersForSystem(system: BodySystemId): Promise<Biomarker[]> {
  const definitions = await biomarkerRepo.listBiomarkerDefinitionsBySystem(fromUiBodySystem(system));
  if (definitions.length === 0) return [];

  const measurements = await biomarkerRepo.listAllMeasurementsForDefinitions(definitions.map((d) => d.id));
  const byDefinition = new Map<string, BiomarkerMeasurement[]>();
  for (const m of measurements) {
    const list = byDefinition.get(m.biomarkerDefinitionId) ?? [];
    list.push(m);
    byDefinition.set(m.biomarkerDefinitionId, list);
  }

  return definitions
    .map((d) => toUiBiomarker(d, byDefinition.get(d.id) ?? []))
    .filter((b): b is Biomarker => b !== null);
}

export async function getBiomarkerDetail(canonicalKey: string): Promise<Biomarker | null> {
  const definition = await biomarkerRepo.findBiomarkerDefinitionByKey(canonicalKey);
  if (!definition) return null;
  const measurements = await biomarkerRepo.listMeasurementsForDefinition(definition.id);
  return toUiBiomarker(definition, measurements);
}

export async function getLatestValueForKey(canonicalKey: string): Promise<BiomarkerMeasurement | null> {
  const definition = await biomarkerRepo.findBiomarkerDefinitionByKey(canonicalKey);
  if (!definition) return null;
  return biomarkerRepo.findLatestMeasurement(definition.id);
}

export async function getHistoryForKey(canonicalKey: string): Promise<BiomarkerMeasurement[]> {
  const definition = await biomarkerRepo.findBiomarkerDefinitionByKey(canonicalKey);
  if (!definition) return [];
  return biomarkerRepo.listMeasurementsForDefinition(definition.id);
}

/**
 * The manual-entry fallback for when AI extraction can't run or a document
 * can't be read — a real, deliberate user action, never a substitute for a
 * missing extraction result. Always sourceType MANUAL so it's never
 * confused with something an extractor produced.
 */
export async function createManualMeasurement(input: { biomarkerDefinitionId: string; value: number; unit: string; measuredAt: Date }) {
  return biomarkerRepo.createMeasurement({
    biomarkerDefinition: { connect: { id: input.biomarkerDefinitionId } },
    value: input.value,
    unit: input.unit,
    measuredAt: input.measuredAt,
    sourceType: "MANUAL",
    verified: true,
  });
}

export { biomarkerRepo };
