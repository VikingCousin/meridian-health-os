import type { BodySystem, DataSourceType } from "@/lib/generated/prisma/client";
import type { BodySystemId, DataSourceType as UiDataSourceType } from "@/types/health";

// Prisma enums are SCREAMING_CASE; the existing (Phase 1) UI types use
// lower_snake_case strings. These map between the two so the DB layer can
// stay idiomatic Prisma while every existing component keeps working unchanged.

const bodySystemToUi: Record<BodySystem, BodySystemId> = {
  BRAIN: "brain",
  CARDIOVASCULAR: "cardiovascular",
  LUNGS: "lungs",
  LIVER: "liver",
  GUT: "gut",
  KIDNEYS: "kidneys",
  METABOLIC: "metabolic",
  MUSCULOSKELETAL: "musculoskeletal",
  IMMUNE: "immune",
};

const bodySystemFromUi: Record<BodySystemId, BodySystem> = {
  brain: "BRAIN",
  cardiovascular: "CARDIOVASCULAR",
  lungs: "LUNGS",
  liver: "LIVER",
  gut: "GUT",
  kidneys: "KIDNEYS",
  metabolic: "METABOLIC",
  musculoskeletal: "MUSCULOSKELETAL",
  immune: "IMMUNE",
};

export function toUiBodySystem(system: BodySystem): BodySystemId {
  return bodySystemToUi[system];
}

export function fromUiBodySystem(system: BodySystemId): BodySystem {
  return bodySystemFromUi[system];
}

const dataSourceToUi: Record<DataSourceType, UiDataSourceType> = {
  LAB_REPORT: "lab",
  MANUAL: "manual",
  WEARABLE: "wearable",
  IMPORT: "imported_pdf",
  AI_EXTRACTED: "ai_extracted",
  CALCULATED: "calculated",
};

export function toUiDataSourceType(type: DataSourceType): UiDataSourceType {
  return dataSourceToUi[type];
}

// Parses a Prisma `Json` column that we always store as a plain string[].
export function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  return [];
}
