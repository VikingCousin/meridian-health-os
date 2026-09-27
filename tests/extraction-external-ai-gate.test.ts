import { describe, it, expect, afterEach } from "vitest";
import { setDemoMode, setExternalAiEnabled } from "@/lib/services/settings.service";
import { getLabDocumentExtractor } from "@/lib/extraction";

// Section 4: External AI privacy gate. process.env.AI_PROVIDER is
// deliberately set here to prove the app-level kill switch wins even when
// a provider IS configured in .env — "External AI: OFF" must mean zero
// external calls, full stop, not "off unless a key happens to be present."
describe("External AI privacy gate (Section 4)", () => {
  afterEach(async () => {
    delete process.env.AI_PROVIDER;
    delete process.env.ANTHROPIC_API_KEY;
    await setExternalAiEnabled(true);
    await setDemoMode(false);
  });

  it("never resolves a real AI extractor when External AI is OFF, even with a provider configured in .env", async () => {
    process.env.AI_PROVIDER = "anthropic";
    process.env.ANTHROPIC_API_KEY = "test-key-not-real";
    await setExternalAiEnabled(false);
    await setDemoMode(false);

    const extractor = await getLabDocumentExtractor();
    expect(extractor.name).not.toMatch(/^ai-/);
    expect(extractor.name).not.toBe("mock-v1"); // real mode + AI off must still never fabricate
  });

  it("fails safely (no fabricated fields) when External AI is OFF in real mode", async () => {
    process.env.AI_PROVIDER = "anthropic";
    process.env.ANTHROPIC_API_KEY = "test-key-not-real";
    await setExternalAiEnabled(false);
    await setDemoMode(false);

    const extractor = await getLabDocumentExtractor();
    await expect(extractor.extract({ filePath: "/dev/null", mimeType: "application/pdf", originalFileName: "x.pdf" })).rejects.toThrow();
  });

  it("restores real extraction once External AI is turned back on", async () => {
    process.env.AI_PROVIDER = "anthropic";
    process.env.ANTHROPIC_API_KEY = "test-key-not-real";
    await setExternalAiEnabled(true);
    await setDemoMode(false);

    const extractor = await getLabDocumentExtractor();
    expect(extractor.name).toBe("ai-anthropic");
  });
});

describe("Lab extraction prompt content (Section 5/6 spot checks)", () => {
  it("instructs the model to never fabricate a standard panel, unit, or reference range, and to handle European decimal commas and German/Russian marker names", async () => {
    // The system prompt constant is deliberately not exported (not part of
    // the module's public surface) — read the source file directly rather
    // than fighting module-mock timing for what is, at heart, a content
    // check on a fixed string.
    const { readFile } = await import("node:fs/promises");
    const source = await readFile(new URL("../lib/extraction/ai-lab-extractor.ts", import.meta.url), "utf-8");

    expect(source).toMatch(/never invent, guess, estimate/i);
    expect(source).toMatch(/standard panel/i);
    expect(source).toMatch(/comma as the decimal separator/i);
    expect(source).toMatch(/German.*Russian|Russian.*German/i);
    expect(source).toMatch(/empty "fields" array/i);
    expect(source).toMatch(/never diagnose/i);
  });
});
