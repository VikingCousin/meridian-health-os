// A minimal, provider-agnostic abstraction over "send text + optional
// attachments to a language model, get text back." Both the lab-document
// extractor and the journal-observation extractor are built on top of this,
// so swapping Claude for OpenAI (or adding a third provider later) never
// touches extraction logic — only lib/ai/index.ts changes.

export interface AiAttachment {
  mimeType: "application/pdf" | "image/jpeg" | "image/png";
  /** Raw base64-encoded bytes (no data: URL prefix). */
  base64Data: string;
  /** Original filename, used only for providers that want it (e.g. OpenAI file inputs). */
  filename?: string;
}

export interface AiCompletionRequest {
  /** System-level instructions — the extraction task description and output contract. */
  system: string;
  /** The user-turn text prompt. */
  userText: string;
  /** Optional documents/images to attach to the user turn (e.g. a lab report). */
  attachments?: AiAttachment[];
  maxTokens?: number;
}

export interface AiProvider {
  readonly name: string;
  complete(request: AiCompletionRequest): Promise<string>;
}

export class AiProviderError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "AiProviderError";
  }
}
