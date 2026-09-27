import { z } from "zod";

/**
 * The versioned manifest written as `metadata.json` inside every export ZIP
 * (see lib/services/data-management.service.ts, exportUserDataZip()).
 * Versioned deliberately so a future importer can tell which archive shape
 * it's reading — see docs/DATA_PORTABILITY.md, "Export round-trip
 * readiness." No import-from-export UI exists yet; this manifest exists so
 * one can be built later without redesigning the export format.
 */
export const CURRENT_EXPORT_MANIFEST_VERSION = 1;
export const EXPORT_MANIFEST_FORMAT = "meridian-export";

export const exportManifestSchema = z.object({
  format: z.literal(EXPORT_MANIFEST_FORMAT),
  version: z.literal(CURRENT_EXPORT_MANIFEST_VERSION),
  exportedAt: z.string().datetime(),
  files: z.array(z.string()),
  counts: z.object({
    goals: z.number().int().nonnegative(),
    experiments: z.number().int().nonnegative(),
    biomarkerMeasurements: z.number().int().nonnegative(),
    journalEntries: z.number().int().nonnegative(),
    insights: z.number().int().nonnegative(),
    knowledgeDocuments: z.number().int().nonnegative(),
  }),
});

export type ExportManifest = z.infer<typeof exportManifestSchema>;

export function buildExportManifest(counts: ExportManifest["counts"], files: string[]): ExportManifest {
  return {
    format: EXPORT_MANIFEST_FORMAT,
    version: CURRENT_EXPORT_MANIFEST_VERSION,
    exportedAt: new Date().toISOString(),
    files,
    counts,
  };
}

export interface ManifestValidationResult {
  valid: boolean;
  errors: string[];
}

/** Validates a parsed metadata.json against the current manifest shape — the seam a future import feature would use first. */
export function validateExportManifest(candidate: unknown): ManifestValidationResult {
  const result = exportManifestSchema.safeParse(candidate);
  if (result.success) return { valid: true, errors: [] };
  return { valid: false, errors: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
}
