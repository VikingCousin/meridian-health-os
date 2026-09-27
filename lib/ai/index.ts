import { AnthropicProvider } from "@/lib/ai/anthropic-provider";
import { OpenAiProvider } from "@/lib/ai/openai-provider";
import type { AiProvider } from "@/lib/ai/types";
import { getAppSettings } from "@/lib/services/settings.service";

export type { AiProvider, AiAttachment, AiCompletionRequest } from "@/lib/ai/types";
export { AiProviderError } from "@/lib/ai/types";

const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-5";
const DEFAULT_OPENAI_MODEL = "gpt-4o";

/**
 * Returns the configured AI provider, or `null` if none is configured (no
 * `AI_PROVIDER` set, the matching API key is missing, or the user has turned
 * off external AI in Profile > Privacy & AI). Callers — the lab/journal
 * extractors and the Coach's language step — are expected to fall back to
 * their deterministic/mock implementation when this returns `null`, so the
 * app keeps working fully with zero configuration and stays fully local
 * whenever the user asks it to, regardless of what's in `.env`.
 */
export async function getAiProvider(): Promise<AiProvider | null> {
  const settings = await getAppSettings();
  if (!settings.externalAiEnabled) return null;

  const configured = process.env.AI_PROVIDER?.trim().toLowerCase();

  if (configured === "anthropic") {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return null;
    return new AnthropicProvider(apiKey, process.env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL);
  }

  if (configured === "openai") {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return null;
    return new OpenAiProvider(apiKey, process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL);
  }

  return null;
}
