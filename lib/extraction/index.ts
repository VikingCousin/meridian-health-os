import type { LabDocumentExtractor } from "@/lib/extraction/types";
import { MockLabDocumentExtractor } from "@/lib/extraction/mock-extractor";
import { AiLabDocumentExtractor } from "@/lib/extraction/ai-lab-extractor";
import { UnavailableLabDocumentExtractor } from "@/lib/extraction/unavailable-extractor";
import { getAiProvider } from "@/lib/ai";
import { getAppSettings } from "@/lib/services/settings.service";

export type { LabDocumentExtractor, LabDocumentExtractionResult, ExtractedLabField, LabDocumentToExtract } from "@/lib/extraction/types";

/**
 * The single place that decides which extractor implementation is active.
 *
 * With a real provider configured, real multimodal extraction runs behind
 * the exact same LabDocumentExtractor interface, so nothing downstream
 * (lib/services/extraction.service.ts, the review UI) changes.
 *
 * With NO provider configured, the fixed illustrative panel
 * (MockLabDocumentExtractor) is only ever reachable in demo mode, where it
 * exists purely to exercise the upload -> review -> confirm pipeline against
 * synthetic data. A real user's document must never be able to reach it —
 * see the P0 fix in docs/DATA_MODEL.md, "Real lab extraction": a hormone
 * panel upload was previously returning a fabricated lipid panel because
 * this function didn't check demoMode at all, only whether a provider was
 * configured. In real mode with no provider, extraction now fails safely
 * with a specific, actionable message instead.
 */
export async function getLabDocumentExtractor(): Promise<LabDocumentExtractor> {
  const provider = await getAiProvider();
  if (provider) return new AiLabDocumentExtractor(provider);

  const settings = await getAppSettings();
  if (settings.demoMode) return new MockLabDocumentExtractor();

  return new UnavailableLabDocumentExtractor();
}
