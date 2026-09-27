import { describe, it, expect, afterEach } from "vitest";
import { MockJournalObservationExtractor } from "@/lib/journal-extraction/mock-extractor";
import { getJournalObservationExtractor } from "@/lib/journal-extraction";

const ORIGINAL_ENV = { ...process.env };

describe("MockJournalObservationExtractor", () => {
  it("derives typed observations without altering the source text", async () => {
    const extractor = new MockJournalObservationExtractor();
    const text = "Felt tired today after a late large dinner and woke up several times.";
    const result = await extractor.extract(text);

    expect(result.extractorName).toBe("mock-v1");
    expect(result.observations.length).toBeGreaterThan(0);
    expect(result.observations.some((o) => o.type === "SLEEP")).toBe(true);
    expect(result.observations.some((o) => o.type === "FOOD")).toBe(true);
    // every observation carries a confidence in [0,1]
    for (const o of result.observations) {
      expect(o.confidence).toBeGreaterThanOrEqual(0);
      expect(o.confidence).toBeLessThanOrEqual(1);
    }
  });

  it("falls back to an OTHER-type reflection when nothing matches known keywords", async () => {
    const extractor = new MockJournalObservationExtractor();
    const result = await extractor.extract("Just a quiet, uneventful day.");
    expect(result.observations.length).toBeGreaterThan(0);
  });
});

describe("getJournalObservationExtractor", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("defaults to the mock extractor with no AI provider configured", async () => {
    delete process.env.AI_PROVIDER;
    const extractor = await getJournalObservationExtractor();
    expect(extractor.name).toBe("mock-v1");
  });

  it("switches to the AI extractor once a provider is configured", async () => {
    process.env.AI_PROVIDER = "anthropic";
    process.env.ANTHROPIC_API_KEY = "test-key-not-real";
    const extractor = await getJournalObservationExtractor();
    expect(extractor.name).toBe("ai-anthropic");
  });
});
