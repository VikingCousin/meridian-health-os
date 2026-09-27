import { GenericCsvImporter } from "@/lib/wearables/importers/generic-csv.importer";
import { ZeppWearableImporter } from "@/lib/wearables/importers/zepp.importer";
import type { WearableConnector, WearableInputFile, WearableSourceType } from "@/lib/wearables/types";

const CONNECTORS: Record<WearableSourceType, WearableConnector> = {
  ZEPP: new ZeppWearableImporter(),
  GENERIC_CSV: new GenericCsvImporter(),
};

export function getConnector(sourceType: WearableSourceType): WearableConnector {
  return CONNECTORS[sourceType];
}

/** Tries the Zepp connector first (more specific), then falls back to generic CSV. Returns `undefined` if nothing recognizes the files. */
export function detectConnector(files: WearableInputFile[]): WearableConnector | undefined {
  if (CONNECTORS.ZEPP.detect(files)) return CONNECTORS.ZEPP;
  if (CONNECTORS.GENERIC_CSV.detect(files)) return CONNECTORS.GENERIC_CSV;
  return undefined;
}
