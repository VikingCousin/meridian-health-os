import type { LabDocumentExtractor, LabDocumentExtractionResult, LabDocumentToExtract } from "@/lib/extraction/types";

/**
 * Used in real-user mode when no AI extraction provider is configured.
 * Never fabricates a substitute panel — throws a specific, actionable error
 * that lib/services/extraction.service.ts turns into a FAILED session with
 * that exact message, so the review UI can tell the user precisely what to
 * do (configure a provider, or try a different file) instead of silently
 * showing invented lab values. See docs/DATA_MODEL.md, "Real lab extraction."
 */
export class UnavailableLabDocumentExtractor implements LabDocumentExtractor {
  readonly name = "unavailable-no-provider";

  async extract(_document: LabDocumentToExtract): Promise<LabDocumentExtractionResult> {
    throw new Error(
      "Could not reliably extract laboratory values from this document — no AI extraction provider is configured. " +
        "Set one up in Profile → Privacy & AI, or ask an administrator to configure AI_PROVIDER, then try again."
    );
  }
}
