import Anthropic from "@anthropic-ai/sdk";
import type { AiAttachment, AiCompletionRequest, AiProvider } from "@/lib/ai/types";
import { AiProviderError } from "@/lib/ai/types";

function toContentBlock(attachment: AiAttachment): Anthropic.ContentBlockParam {
  if (attachment.mimeType === "application/pdf") {
    return {
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: attachment.base64Data },
    };
  }
  return {
    type: "image",
    source: { type: "base64", media_type: attachment.mimeType, data: attachment.base64Data },
  };
}

export class AnthropicProvider implements AiProvider {
  readonly name = "anthropic";
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async complete(request: AiCompletionRequest): Promise<string> {
    try {
      const content: Anthropic.ContentBlockParam[] = [
        ...(request.attachments ?? []).map(toContentBlock),
        { type: "text", text: request.userText },
      ];

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: request.maxTokens ?? 4096,
        system: request.system,
        messages: [{ role: "user", content }],
      });

      const textBlock = response.content.find((block) => block.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        throw new AiProviderError("Anthropic response contained no text content.");
      }
      return textBlock.text;
    } catch (err) {
      if (err instanceof AiProviderError) throw err;
      throw new AiProviderError("Anthropic API call failed.", err);
    }
  }
}
