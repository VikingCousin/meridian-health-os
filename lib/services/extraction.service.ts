import * as extractionRepo from "@/lib/db/repositories/extraction.repository";
import * as documentRepo from "@/lib/db/repositories/document.repository";
import * as biomarkerRepo from "@/lib/db/repositories/biomarker.repository";
import { getLabDocumentExtractor } from "@/lib/extraction";
import type { Prisma } from "@/lib/generated/prisma/client";
import { getDocumentAbsolutePath } from "@/lib/services/document.service";
import { resolveDefinitionByRawName } from "@/lib/services/biomarker.service";
import { getAppSettings } from "@/lib/services/settings.service";
import type { ExtractedLabField } from "@/lib/extraction/types";
import type { ExtractedLabValue, ConfidenceTier } from "@/types/health";

const LOW_CONFIDENCE_THRESHOLD = 0.7;
const HIGH_CONFIDENCE_THRESHOLD = 0.85;

/**
 * Deterministic sanity checks on raw extractor output before any of it
 * becomes a LabExtractionItem — data-integrity validation, not medical
 * interpretation (Section 5 of the P0 fix). Silently-invalid entries (not a
 * finite number, empty name, blank unit) are dropped rather than persisted
 * as a broken row; exact duplicates (same name+value+unit) are collapsed to
 * one so a flaky extractor can't double-count a single real result.
 */
function sanitizeExtractedFields(fields: ExtractedLabField[]): ExtractedLabField[] {
  const seen = new Set<string>();
  const sane: ExtractedLabField[] = [];

  for (const field of fields) {
    if (!field.rawName?.trim()) continue;
    if (!Number.isFinite(field.value)) continue;
    if (!field.unit?.trim()) continue;
    if (field.confidence !== undefined && (field.confidence < 0 || field.confidence > 1)) continue;
    // referenceText/sourceMetadata are optional provenance — malformed shapes
    // are dropped rather than rejecting the whole (otherwise valid) field.
    const referenceText = typeof field.referenceText === "string" ? field.referenceText.trim().slice(0, 300) || undefined : undefined;
    const sourceMetadata =
      field.sourceMetadata && typeof field.sourceMetadata === "object" && !Array.isArray(field.sourceMetadata) ? field.sourceMetadata : undefined;

    const dedupeKey = `${field.rawName.trim().toLowerCase()}|${field.value}|${field.unit.trim().toLowerCase()}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    sane.push({ ...field, referenceText, sourceMetadata });
  }

  return sane;
}

function confidenceTierFor(confidence: number | null | undefined, mapped: boolean): ConfidenceTier {
  if (!mapped) return "unrecognized";
  if (confidence === null || confidence === undefined) return "low";
  if (confidence >= HIGH_CONFIDENCE_THRESHOLD) return "high";
  if (confidence >= LOW_CONFIDENCE_THRESHOLD) return "medium";
  return "low";
}

/**
 * Runs the configured extractor against a just-uploaded document. Real
 * extractors call an external API and can genuinely fail (bad key, network
 * error, malformed/off-schema model output, unreadable file) — any of that
 * lands the session in FAILED with the error message kept for debugging,
 * rather than throwing past the caller or silently producing an empty review
 * screen.
 */
export async function startExtraction(documentId: string) {
  const document = await documentRepo.findDocumentById(documentId);
  if (!document) throw new Error(`Document ${documentId} not found`);

  const session = await extractionRepo.createExtractionSession({
    document: { connect: { id: documentId } },
    status: "EXTRACTING",
  });

  const extractor = await getLabDocumentExtractor();

  try {
    // Defense in depth: even if a future refactor of getLabDocumentExtractor()
    // ever mis-wired the factory, a fabricated panel must never be able to
    // reach a real user's session. This check is independent of that factory,
    // and — like any other extraction failure — lands the session in FAILED
    // rather than throwing past the caller.
    const settings = await getAppSettings();
    if (!settings.demoMode && extractor.name === "mock-v1") {
      throw new Error("Refusing to run mock lab extraction in real-user mode — this should be unreachable.");
    }

    const result = await extractor.extract({
      filePath: getDocumentAbsolutePath(document.localFilePath),
      mimeType: document.mimeType,
      originalFileName: document.originalFileName,
    });

    const sanitizedFields = sanitizeExtractedFields(result.fields);

    const itemsToCreate = await Promise.all(
      sanitizedFields.map(async (field) => {
        const suggested = await resolveDefinitionByRawName(field.rawName);
        return {
          extractionSessionId: session.id,
          rawName: field.rawName,
          value: field.value,
          unit: field.unit,
          referenceMin: field.referenceMin,
          referenceMax: field.referenceMax,
          referenceText: field.referenceText,
          confidence: field.confidence,
          sourceMetadata: field.sourceMetadata as Prisma.InputJsonValue | undefined,
          // Unmapped markers are never auto-accepted — they need an explicit
          // biomarker mapping from the user before they can mean anything.
          accepted: !!suggested && (field.confidence ?? 1) >= LOW_CONFIDENCE_THRESHOLD,
          suggestedBiomarkerDefinitionId: suggested?.id,
          finalBiomarkerDefinitionId: suggested?.id,
        };
      })
    );

    await extractionRepo.createExtractionItems(itemsToCreate);
    await extractionRepo.updateExtractionSession(session.id, {
      status: "EXTRACTED",
      extractorName: result.extractorName,
    });

    if (result.documentDate || result.providerName) {
      await documentRepo.updateDocument(documentId, {
        documentDate: document.documentDate ?? result.documentDate,
        providerName: document.providerName ?? result.providerName,
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown extraction error.";
    // Log only the short message, never the raw error object — some AI SDK
    // error shapes attach the original request (which would include the
    // document bytes) as an extra property. See docs/PRIVACY_ARCHITECTURE.md.
    console.error(`Lab extraction failed for document ${documentId}: ${message}`);
    await extractionRepo.updateExtractionSession(session.id, {
      status: "FAILED",
      extractorName: extractor.name,
      rawExtraction: JSON.stringify({ error: message }),
    });
  }

  return extractionRepo.findExtractionSession(session.id);
}

export async function getExtractionSession(sessionId: string) {
  return extractionRepo.findExtractionSession(sessionId);
}

/** The specific, actionable reason a session failed — never a generic string — see documents.ts. */
export function getExtractionFailureReason(rawExtraction: string | null): string {
  if (!rawExtraction) return "We couldn't extract values from this document. You can try again, or a different file.";
  try {
    const parsed = JSON.parse(rawExtraction) as { error?: string };
    return parsed.error ?? "We couldn't extract values from this document. You can try again, or a different file.";
  } catch {
    return "We couldn't extract values from this document. You can try again, or a different file.";
  }
}

export function toUiExtractedValues(
  items: NonNullable<Awaited<ReturnType<typeof extractionRepo.findExtractionSession>>>["items"]
): ExtractedLabValue[] {
  return items.map((item) => {
    const mapped = !!(item.finalBiomarkerDefinitionId ?? item.suggestedBiomarkerDefinitionId);
    return {
      id: item.id,
      name: item.rawName,
      value: String(item.value),
      unit: item.unit,
      confirmed: item.accepted,
      flagged: item.confidence !== null && item.confidence !== undefined && item.confidence < LOW_CONFIDENCE_THRESHOLD,
      confidenceTier: confidenceTierFor(item.confidence, mapped),
      mapped,
      biomarkerDefinitionId: item.finalBiomarkerDefinitionId ?? item.suggestedBiomarkerDefinitionId ?? undefined,
      referenceMin: item.referenceMin ?? undefined,
      referenceMax: item.referenceMax ?? undefined,
      referenceText: item.referenceText ?? undefined,
    };
  });
}

export async function updateExtractionItemValue(
  itemId: string,
  patch: { value?: number; unit?: string; accepted?: boolean; finalBiomarkerDefinitionId?: string }
) {
  return extractionRepo.updateExtractionItem(itemId, {
    ...patch,
    editedByUser: true,
  });
}

export interface ConfirmExtractionResult {
  importedCount: number;
  /** Accepted items skipped for a reason other than "not mapped" (currently unused, kept for a future case). */
  skippedCount: number;
  /** Accepted items that still have no biomarker mapping — never imported until the user maps or unchecks them. */
  skippedUnmappedCount: number;
}

/**
 * Turns accepted, resolved extraction items into real BiomarkerMeasurement
 * rows. Nothing here was "verified" health data until this step — this is
 * the one place an extraction session graduates into permanent history.
 * Idempotent: an item that already produced a measurement is never imported twice.
 */
export async function confirmExtraction(sessionId: string): Promise<ConfirmExtractionResult> {
  const session = await extractionRepo.findExtractionSession(sessionId);
  if (!session) throw new Error(`Extraction session ${sessionId} not found`);

  let importedCount = 0;
  const skippedCount = 0;
  // Counted across ALL items, not just accepted ones — the review UI
  // disables acceptance until a marker is mapped, so an unmapped item is
  // never "accepted" in practice; this still needs to be a truthful count
  // of "how many extracted values were not saved because they're unmapped."
  const skippedUnmappedCount = session.items.filter(
    (item) => !item.resultingMeasurementId && !(item.finalBiomarkerDefinitionId ?? item.suggestedBiomarkerDefinitionId)
  ).length;

  for (const item of session.items) {
    if (!item.accepted || item.resultingMeasurementId) continue;

    const biomarkerDefinitionId = item.finalBiomarkerDefinitionId ?? item.suggestedBiomarkerDefinitionId;
    if (!biomarkerDefinitionId) continue; // already counted above

    const measurement = await biomarkerRepo.createMeasurement({
      biomarkerDefinition: { connect: { id: biomarkerDefinitionId } },
      value: item.value,
      unit: item.unit,
      measuredAt: session.document.documentDate ?? session.createdAt,
      referenceMin: item.referenceMin,
      referenceMax: item.referenceMax,
      referenceText: item.referenceText,
      sourceType: "AI_EXTRACTED",
      sourceDocument: { connect: { id: session.documentId } },
      verified: true,
      notes: `Imported from extraction session ${session.id}`,
    });

    await extractionRepo.updateExtractionItem(item.id, { resultingMeasurementId: measurement.id });
    importedCount += 1;
  }

  await extractionRepo.updateExtractionSessionStatus(sessionId, "CONFIRMED");

  return { importedCount, skippedCount, skippedUnmappedCount };
}
