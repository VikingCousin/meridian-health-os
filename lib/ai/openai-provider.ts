import OpenAI from "openai";
import type { AiAttachment, AiCompletionRequest, AiProvider } from "@/lib/ai/types";
import { AiProviderError } from "@/lib/ai/types";

type InputContent =
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string; detail: "auto" }
  | { type: "input_file"; file_data: string; filename: string };

function toContentPart(attachment: AiAttachment): InputContent {
  const dataUrl = `data:${attachment.mimeType};base64,${attachment.base64Data}`;
  if (attachment.mimeType === "application/pdf") {
    return { type: "input_file", file_data: dataUrl, filename: attachment.filename ?? "document.pdf" };
  }
  return { type: "input_image", image_url: dataUrl, detail: "auto" };
}

export class OpenAiProvider implements AiProvider {
  readonly name = "openai";
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async complete(request: AiCompletionRequest): Promise<string> {
    try {
      const content: InputContent[] = [
        { type: "input_text", text: request.userText },
        ...(request.attachments ?? []).map(toContentPart),
      ];

      const response = await this.client.responses.create({
        model: this.model,
        instructions: request.system,
        max_output_tokens: request.maxTokens ?? 4096,
        input: [{ role: "user", content }],
      });

      if (!response.output_text) {
        throw new AiProviderError("OpenAI response contained no output text.");
      }
      return response.output_text;
    } catch (err) {
      if (err instanceof AiProviderError) throw err;
      throw new AiProviderError("OpenAI API call failed.", err);
    }
  }
}
