import type { LabDocumentExtractor, LabDocumentExtractionResult, LabDocumentToExtract } from "@/lib/extraction/types";

// Stands in for a real vision/OCR extraction backend. It ignores the actual
// file content and returns a fixed, realistic panel — good enough to exercise
// the full upload -> review -> confirm pipeline end to end without wiring up
// a real AI provider yet. Swap this out in lib/extraction/index.ts once a
// real extractor (e.g. ClaudeVisionLabExtractor) exists.
export class MockLabDocumentExtractor implements LabDocumentExtractor {
  readonly name = "mock-v1";

  async extract(_document: LabDocumentToExtract): Promise<LabDocumentExtractionResult> {
    // Simulate the latency of a real extraction call.
    await new Promise((resolve) => setTimeout(resolve, 600));

    return {
      documentDate: new Date(),
      providerName: "Quest Diagnostics",
      extractorName: this.name,
      fields: [
        { rawName: "ApoB", value: 74, unit: "mg/dL", referenceMax: 100, confidence: 0.97 },
        { rawName: "LDL-C", value: 101, unit: "mg/dL", referenceMax: 130, confidence: 0.98 },
        { rawName: "HDL-C", value: 61, unit: "mg/dL", referenceMin: 40, confidence: 0.98 },
        { rawName: "Triglycerides", value: 72, unit: "mg/dL", referenceMax: 150, confidence: 0.97 },
        { rawName: "HbA1c", value: 5.2, unit: "%", referenceMax: 5.7, confidence: 0.96 },
        { rawName: "Fasting Glucose", value: 88, unit: "mg/dL", referenceMax: 99, confidence: 0.96 },
        { rawName: "Total Cholesterol", value: 184, unit: "mg/dL", referenceMax: 200, confidence: 0.95 },
        { rawName: "hs-CRP", value: 0.6, unit: "mg/L", referenceMax: 3, confidence: 0.9 },
        { rawName: "Ferritin", value: 112, unit: "ng/mL", referenceMin: 20, referenceMax: 250, confidence: 0.92 },
        { rawName: "Vitamin D", value: 41, unit: "ng/mL", referenceMin: 30, referenceMax: 100, confidence: 0.93 },
        { rawName: "TSH", value: 1.8, unit: "uIU/mL", referenceMin: 0.4, referenceMax: 4, confidence: 0.94 },
        { rawName: "ALT", value: 22, unit: "U/L", referenceMax: 44, confidence: 0.9 },
        { rawName: "AST", value: 19, unit: "U/L", referenceMax: 40, confidence: 0.9 },
        // Deliberately low confidence so the review UI can demonstrate a flagged field.
        { rawName: "Homocysteine", value: 12.4, unit: "umol/L", referenceMax: 15, confidence: 0.42 },
      ],
      raw: { note: "mock extraction — no real OCR or model call was made" },
    };
  }
}
