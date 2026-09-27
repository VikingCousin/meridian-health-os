import type { z } from "zod";
import type { AiAttachment, AiProvider } from "@/lib/ai/types";
import { AiProviderError } from "@/lib/ai/types";

function extractJsonText(raw: string): string {
  const trimmed = raw.trim();
  // Models sometimes wrap JSON in a markdown code fence despite instructions not to.
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenceMatch ? fenceMatch[1] : trimmed;
}

/**
 * Sends a prompt to the given provider and validates its JSON response
 * against a Zod schema before returning it. Never trusts model output —
 * a malformed or off-schema response throws `AiProviderError`, which
 * callers turn into a FAILED extraction session rather than silently
 * accepting bad data.
 */
export async function completeStructured<T>(
  provider: AiProvider,
  opts: {
    system: string;
    userText: string;
    attachments?: AiAttachment[];
    schema: z.ZodType<T>;
    maxTokens?: number;
  }
): Promise<T> {
  const raw = await provider.complete({
    system: `${opts.system}\n\nRespond with ONLY a single valid JSON value matching the described shape. No prose, no markdown code fences, no explanation before or after the JSON.`,
    userText: opts.userText,
    attachments: opts.attachments,
    maxTokens: opts.maxTokens,
  });

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(extractJsonText(raw));
  } catch (err) {
    throw new AiProviderError(`${provider.name} did not return valid JSON.`, err);
  }

  const result = opts.schema.safeParse(parsedJson);
  if (!result.success) {
    throw new AiProviderError(`${provider.name}'s response did not match the expected shape: ${result.error.message}`);
  }
  return result.data;
}
