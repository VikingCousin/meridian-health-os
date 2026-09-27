import { readFile } from "node:fs/promises";
import { z } from "zod";
import type { AiProvider } from "@/lib/ai/types";
import { completeStructured } from "@/lib/ai/structured";
import { biomarkerCatalog } from "@/lib/domain/biomarker-catalog";
import type { LabDocumentExtractor, LabDocumentExtractionResult, LabDocumentToExtract } from "@/lib/extraction/types";

const labExtractionSchema = z.object({
  // "Report date" (when the lab verified/issued the report) and "collection
  // date" (when the sample was actually drawn) can differ by a day or more
  // on a real report — kept as two separate optional fields rather than one
  // ambiguous "documentDate", per Section 5/6 of the real-extraction setup.
  collectionDate: z.string().nullable().optional().describe("The date the sample was collected/drawn, as YYYY-MM-DD, if visible."),
  reportDate: z.string().nullable().optional().describe("The date the report was issued/verified, as YYYY-MM-DD, if visible."),
  providerName: z.string().nullable().optional().describe("The laboratory or clinic name, if visible."),
  fields: z.array(
    z.object({
      rawName: z.string().describe("The test name exactly as printed on the document, in its original language — never translated."),
      value: z.number().describe("The numeric result, converted to a standard JSON number (e.g. a European \"5,2\" becomes 5.2). Only include tests with a clear numeric result."),
      unit: z.string().describe("The unit exactly as printed, e.g. mg/dL, mmol/L, %, U/L, pg/mL, mIU/mL."),
      referenceMin: z.number().nullable().optional().describe("The lower bound of a NUMERIC reference range, if printed."),
      referenceMax: z.number().nullable().optional().describe("The upper bound of a NUMERIC reference range, if printed."),
      referenceText: z
        .string()
        .nullable()
        .optional()
        .describe("A non-numeric reference range exactly as printed (e.g. \"Premenopausal: 15-350\", \"Negative\"), when the range can't be reduced to two numbers."),
      sourcePage: z.number().int().nullable().optional().describe("The 1-based page number this value appears on, for a multi-page document, if determinable."),
      sourceSnippet: z
        .string()
        .max(200)
        .nullable()
        .optional()
        .describe("A short verbatim excerpt (under ~200 characters) of the line/row this value was read from, for traceability. Omit if not clearly extractable."),
      confidence: z
        .number()
        .min(0)
        .max(1)
        .describe("0-1: how confident you are this value was read correctly from the document. Lower this for blurry, ambiguous, or partially-obscured text — never default to a high number as a formality."),
    })
  ),
});

const KNOWN_MARKER_NAMES = biomarkerCatalog.map((c) => c.displayName).join(", ");

const SYSTEM_PROMPT = `You are a careful, conservative medical lab report reader for a personal health app called Meridian. You extract structured data from a single laboratory report document (a PDF or a photo). A human reviews every single value you extract before anything is saved to their health record — nothing you output is ever trusted or stored automatically. Because of this review step, it is always better to extract nothing than to extract something wrong or invented.

ABSOLUTE RULES — violating any of these is a critical failure, not a minor inaccuracy:
- Extract ONLY values that are actually visibly printed on THIS specific document. Never extract a value because it is commonly part of a standard panel — if a test isn't visibly present on the page, it does not go in your output, even if related tests around it are.
- Never invent, guess, estimate, or "fill in" a missing marker, value, unit, or reference range. If a field isn't legible or isn't printed, omit that field (or that whole test) rather than supplying a plausible-looking placeholder.
- Never substitute an example, typical, or textbook value for what you can't clearly read.
- Never diagnose, interpret, or comment on whether a value is normal, abnormal, or concerning — you are a transcriber, not a clinician.
- If the document is unreadable, is not a laboratory report, or contains no laboratory measurements you can confidently transcribe, return an empty "fields" array. An empty result is a correct, successful result — not a failure to try harder.

WHAT TO EXTRACT (only when actually visible):
- Skip purely qualitative results (e.g. "Negative", "Not Detected", "Trace") entirely — do not invent a number for them. If a reference range is qualitative/textual rather than two numbers, put it in "referenceText" verbatim instead of guessing numeric bounds.
- Use the exact test name as printed for "rawName" — do NOT translate it, normalize it, or convert it to English. Matching a raw name to Meridian's internal biomarker catalog happens as a separate, later step, so the original printed name (in whatever language/spelling it appears) must be preserved exactly.
- This document may be in English, German, or Russian (or occasionally show a mix, e.g. a German report with English abbreviations). Recognize markers regardless of language — for example "Testosteron"/"Testosterone"/"Тестостерон", "freies Testosteron"/"Free Testosterone", "Östradiol"/"Estradiol"/"Эстрадиол", "SHBG", "LH", "FSH", "Prolaktin"/"Prolactin", "DHEA-S", "Cortisol"/"Kortisol", "TSH", "fT3", "fT4" are all the same kinds of tests in different languages — extract each using its own printed name, never translating between them.
- European number formatting: a European lab report commonly uses a comma as the decimal separator and a period (or space) as a thousands separator — e.g. "5,2" means 5.2, and "1.234,56" means 1234.56. Convert these correctly to a standard JSON number; never mix them up.
- Reference ranges: extract referenceMin/referenceMax exactly as printed when they are two numbers. If only one bound is printed (e.g. "<100" or ">40"), set only that bound. If the range is textual/conditional (e.g. depends on sex, cycle phase, or age — very common for hormone panels), put the exact printed text in "referenceText" instead.
- Extract collectionDate and reportDate only if actually visible — they are commonly two different dates on a real report, and either may be absent.
- Extract the laboratory/provider name only if actually visible.
- For sourcePage and sourceSnippet, only fill them in when you can genuinely point to a specific page/line — never fabricate a page number or invent a paraphrased snippet.
- Set "confidence" honestly and independently per field.

Reference markers you may encounter (this list exists only to help you recognize what a lab value looks like — it does not mean these are present on this document, and you must never add one merely because it's on this list): ${KNOWN_MARKER_NAMES}.`;

function toIsoDate(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export class AiLabDocumentExtractor implements LabDocumentExtractor {
  readonly name: string;

  constructor(private readonly provider: AiProvider) {
    this.name = `ai-${provider.name}`;
  }

  async extract(document: LabDocumentToExtract): Promise<LabDocumentExtractionResult> {
    const buffer = await readFile(document.filePath);
    const base64Data = buffer.toString("base64");

    const mimeType = document.mimeType as "application/pdf" | "image/jpeg" | "image/png";

    const result = await completeStructured(this.provider, {
      system: SYSTEM_PROMPT,
      userText: "Extract every laboratory test result actually visible on the attached document. If none are clearly legible, return an empty fields array.",
      attachments: [{ mimeType, base64Data, filename: document.originalFileName }],
      schema: labExtractionSchema,
      maxTokens: 4096,
    });

    // Report date is the closer analogue of the old single "documentDate"
    // field the rest of the app already understands (HealthDocument.documentDate);
    // collection date — when present and different — is preserved per-item
    // below rather than silently discarded.
    const reportDate = toIsoDate(result.reportDate);
    const collectionDate = toIsoDate(result.collectionDate);

    return {
      documentDate: reportDate ?? collectionDate,
      providerName: result.providerName ?? undefined,
      extractorName: this.name,
      fields: result.fields.map((field) => ({
        rawName: field.rawName,
        value: field.value,
        unit: field.unit,
        confidence: field.confidence,
        referenceMin: field.referenceMin ?? undefined,
        referenceMax: field.referenceMax ?? undefined,
        referenceText: field.referenceText ?? undefined,
        sourceMetadata: {
          ...(collectionDate ? { collectionDate: collectionDate.toISOString() } : {}),
          ...(reportDate ? { reportDate: reportDate.toISOString() } : {}),
          ...(field.sourcePage ? { sourcePage: field.sourcePage } : {}),
          ...(field.sourceSnippet ? { sourceSnippet: field.sourceSnippet } : {}),
        },
      })),
      raw: result,
    };
  }
}
