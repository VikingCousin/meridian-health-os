import { parseCsv, looksLikeCsv } from "@/lib/wearables/importers/csv-utils";
import { parseTimestamp } from "@/lib/wearables/normalization/timestamp-normalizer";
import { getMetricCatalogEntry, resolveMetricByRawName } from "@/lib/wearables/normalization/metric-map";
import { isPlausibleValue, isPlausibleTimestamp } from "@/lib/wearables/validation";
import type { CanonicalMeasurement, ImportWarning, ParsedWearableData, WearableConnector, WearableInputFile } from "@/lib/wearables/types";

export interface CsvColumnMapping {
  timestampColumn: string;
  /** metricKey -> source column name. Only recognized metricKeys (lib/wearables/normalization/metric-map.ts) are accepted. */
  columns: { column: string; metricKey: string; unit?: string }[];
}

/** Best-effort, zero-config mapping suggestion from a header row — always reviewable/overridable by the user before import, never auto-committed. */
export function autoDetectMapping(headers: string[]): CsvColumnMapping | null {
  const timestampColumn = headers.find((h) => /date|time|timestamp/i.test(h));
  if (!timestampColumn) return null;

  const columns: CsvColumnMapping["columns"] = [];
  for (const header of headers) {
    if (header === timestampColumn) continue;
    const metric = resolveMetricByRawName(header);
    if (metric) columns.push({ column: header, metricKey: metric.metricKey });
  }
  return { timestampColumn, columns };
}

export function previewCsv(content: string, maxRows = 10) {
  const { headers, rows } = parseCsv(content);
  return { headers, rows: rows.slice(0, maxRows), totalRows: rows.length };
}

/**
 * The universal fallback importer: the user (or autoDetectMapping) maps
 * spreadsheet columns to canonical metrics before anything is parsed for
 * real. No AI is used to guess column meaning — an unmapped column is
 * simply left out and reported as an unknown field.
 */
export class GenericCsvImporter implements WearableConnector {
  sourceType = "GENERIC_CSV" as const;

  detect(files: WearableInputFile[]): boolean {
    return files.length >= 1 && files.every((f) => f.name.toLowerCase().endsWith(".csv") && looksLikeCsv(f.content));
  }

  parse(files: WearableInputFile[], mapping?: CsvColumnMapping): ParsedWearableData {
    const measurements: CanonicalMeasurement[] = [];
    const warnings: ImportWarning[] = [];
    const unknownFields = new Set<string>();

    for (const file of files) {
      const { headers, rows } = parseCsv(file.content);
      const effectiveMapping = mapping ?? autoDetectMapping(headers) ?? undefined;

      if (!effectiveMapping) {
        warnings.push({ code: "NO_MAPPING", message: `Could not detect a timestamp column in ${file.name} — provide a manual column mapping.` });
        for (const h of headers) unknownFields.add(h);
        continue;
      }

      const timestampIndex = headers.indexOf(effectiveMapping.timestampColumn);
      const mappedIndices = effectiveMapping.columns.map((c) => ({ ...c, index: headers.indexOf(c.column) }));
      for (const h of headers) {
        const isMapped = h === effectiveMapping.timestampColumn || effectiveMapping.columns.some((c) => c.column === h);
        if (!isMapped) unknownFields.add(h);
      }

      for (const [rowIndex, row] of rows.entries()) {
        const rawTimestamp = row[timestampIndex];
        const parsedTimestamp = rawTimestamp ? parseTimestamp(rawTimestamp) : null;
        if (!parsedTimestamp) {
          warnings.push({ code: "BAD_TIMESTAMP", message: `Row ${rowIndex + 2} in ${file.name}: could not parse timestamp "${rawTimestamp}"` });
          continue;
        }
        const timestampCheck = isPlausibleTimestamp(parsedTimestamp.date);
        if (!timestampCheck.valid) {
          warnings.push({ code: "IMPLAUSIBLE_TIMESTAMP", message: `Row ${rowIndex + 2} in ${file.name}: ${timestampCheck.reason}` });
          continue;
        }

        for (const col of mappedIndices) {
          const rawValue = row[col.index];
          if (rawValue === undefined || rawValue === "") continue;
          const numericValue = Number(rawValue);
          if (Number.isNaN(numericValue)) {
            warnings.push({ code: "NON_NUMERIC_VALUE", message: `Row ${rowIndex + 2} in ${file.name}, column "${col.column}": "${rawValue}" is not numeric` });
            continue;
          }
          const catalogEntry = getMetricCatalogEntry(col.metricKey);
          if (!catalogEntry) {
            warnings.push({ code: "UNKNOWN_METRIC", message: `Column "${col.column}" is mapped to an unrecognized metric "${col.metricKey}"` });
            continue;
          }
          const normalized = catalogEntry.normalize(numericValue, col.unit ?? "");
          if (!normalized) {
            warnings.push({ code: "AMBIGUOUS_UNIT", message: `Row ${rowIndex + 2} in ${file.name}, column "${col.column}": unit is ambiguous or missing — record skipped` });
            continue;
          }
          const plausibility = isPlausibleValue(col.metricKey, normalized.value);
          if (!plausibility.valid) {
            warnings.push({ code: "IMPLAUSIBLE_VALUE", message: `Row ${rowIndex + 2} in ${file.name}, column "${col.column}": ${plausibility.reason}` });
            continue;
          }
          measurements.push({
            metricKey: col.metricKey,
            value: normalized.value,
            unit: normalized.unit,
            measuredAt: parsedTimestamp.date,
            rawMetricName: col.column,
            rawValue,
            rawUnit: col.unit,
          });
        }
      }
    }

    return { measurements, sleepSessions: [], workoutSessions: [], warnings, unknownFields: [...unknownFields] };
  }
}
