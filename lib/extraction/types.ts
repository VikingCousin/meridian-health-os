// The interface every future extraction backend (Claude vision, OpenAI,
// local OCR) implements. Application code depends only on this contract —
// never on a specific provider — so swapping MockLabDocumentExtractor for a
// real one later is a one-line change (see lib/extraction/index.ts).

export interface ExtractedLabField {
  rawName: string;
  value: number;
  unit: string;
  referenceMin?: number;
  referenceMax?: number;
  /** A non-numeric reference range as printed (e.g. "Premenopausal: 15-350"), when it can't be reduced to two numbers. */
  referenceText?: string;
  /** 0-1 confidence the extractor has in this specific field. */
  confidence?: number;
  /** Bundled, variably-shaped provenance: collectionDate/reportDate/sourcePage/sourceSnippet — see docs/DATA_MODEL.md. */
  sourceMetadata?: Record<string, unknown>;
}

export interface LabDocumentExtractionResult {
  documentDate?: Date;
  providerName?: string;
  fields: ExtractedLabField[];
  /** Extractor implementation name, stored for debugging/audit. */
  extractorName: string;
  /** Raw provider response, kept only for debugging — never trusted as-is. */
  raw?: unknown;
}

export interface LabDocumentToExtract {
  /** Absolute path to the file on local disk. */
  filePath: string;
  mimeType: string;
  originalFileName: string;
}

export interface LabDocumentExtractor {
  readonly name: string;
  extract(document: LabDocumentToExtract): Promise<LabDocumentExtractionResult>;
}
