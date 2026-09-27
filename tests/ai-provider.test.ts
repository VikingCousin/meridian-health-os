import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { z } from "zod";
import { getAiProvider } from "@/lib/ai";
import { completeStructured } from "@/lib/ai/structured";
import { AiProviderError, type AiCompletionRequest, type AiProvider } from "@/lib/ai/types";

const ORIGINAL_ENV = { ...process.env };

describe("getAiProvider (configuration)", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("returns null when AI_PROVIDER is unset — the safe, zero-config default", async () => {
    delete process.env.AI_PROVIDER;
    expect(await getAiProvider()).toBeNull();
  });

  it("returns null when a provider is named but its API key is missing", async () => {
    process.env.AI_PROVIDER = "anthropic";
    delete process.env.ANTHROPIC_API_KEY;
    expect(await getAiProvider()).toBeNull();
  });

  it("returns an AnthropicProvider when anthropic is configured with a key", async () => {
    process.env.AI_PROVIDER = "anthropic";
    process.env.ANTHROPIC_API_KEY = "test-key-not-real";
    const provider = await getAiProvider();
    expect(provider?.name).toBe("anthropic");
  });

  it("returns an OpenAiProvider when openai is configured with a key", async () => {
    process.env.AI_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "test-key-not-real";
    const provider = await getAiProvider();
    expect(provider?.name).toBe("openai");
  });
});

class FakeProvider implements AiProvider {
  readonly name = "fake";
  constructor(private response: string) {}
  async complete(_request: AiCompletionRequest): Promise<string> {
    return this.response;
  }
}

const schema = z.object({ fields: z.array(z.object({ rawName: z.string(), value: z.number() })) });

describe("completeStructured (never trusts raw model output)", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("parses and validates a clean JSON response", async () => {
    const provider = new FakeProvider(JSON.stringify({ fields: [{ rawName: "ApoB", value: 74 }] }));
    const result = await completeStructured(provider, { system: "s", userText: "u", schema });
    expect(result.fields[0].rawName).toBe("ApoB");
  });

  it("strips a markdown code fence if the model added one anyway", async () => {
    const provider = new FakeProvider('```json\n{"fields": [{"rawName": "HRV", "value": 51}]}\n```');
    const result = await completeStructured(provider, { system: "s", userText: "u", schema });
    expect(result.fields[0].rawName).toBe("HRV");
  });

  it("throws AiProviderError on invalid JSON rather than crashing the caller", async () => {
    const provider = new FakeProvider("this is not json at all");
    await expect(completeStructured(provider, { system: "s", userText: "u", schema })).rejects.toThrow(AiProviderError);
  });

  it("throws AiProviderError when the JSON doesn't match the schema", async () => {
    const provider = new FakeProvider(JSON.stringify({ wrongShape: true }));
    await expect(completeStructured(provider, { system: "s", userText: "u", schema })).rejects.toThrow(AiProviderError);
  });
});
