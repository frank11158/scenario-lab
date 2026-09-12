import type { ModelAdapter, ModelRequest, ModelResponse, Usage } from "./types.js";
import { ModelAdapterError } from "./types.js";

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

type OpenAIResponsesAdapterOptions = {
  apiKey: string;
  model: string;
  baseUrl?: string;
  fetch?: FetchLike;
  costCalculator?: (usage: { model: string; inputTokens: number; outputTokens: number }) => number | null;
};

type ResponsesBody = {
  id?: string;
  model?: string;
  status?: string;
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
  error?: { message?: string } | null;
  incomplete_details?: { reason?: string } | null;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  } | null;
};

export class OpenAIResponsesAdapter implements ModelAdapter {
  readonly provider = "openai";
  readonly model: string;
  readonly modelVersion: string | null = null;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetcher: FetchLike;
  private readonly costCalculator?: OpenAIResponsesAdapterOptions["costCalculator"];

  constructor(options: OpenAIResponsesAdapterOptions) {
    if (!options.apiKey.trim()) throw new Error("OpenAI API key is required");
    if (!options.model.trim()) throw new Error("OpenAI model is required");
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.baseUrl = (options.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");
    this.fetcher = options.fetch ?? fetch;
    this.costCalculator = options.costCalculator;
  }

  async generate(request: ModelRequest): Promise<ModelResponse> {
    let response: Response;
    try {
      response = await this.fetcher(`${this.baseUrl}/responses`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          model: this.model,
          instructions: request.instructions,
          input: JSON.stringify({
            stageInput: request.input,
            retryFeedback: request.retryFeedback ?? null
          }),
          text: {
            format: {
              type: "json_schema",
              name: request.outputSchemaName,
              schema: request.outputJsonSchema,
              strict: true
            }
          },
          store: false,
          metadata: {
            run_id: request.runId,
            stage: request.stage,
            prompt_version: request.promptVersion
          }
        }),
        signal: request.signal
      });
    } catch (error) {
      if (request.signal.aborted) throw new ModelAdapterError("Model request cancelled", false);
      throw new ModelAdapterError(error instanceof Error ? error.message : "OpenAI request failed", true);
    }

    let body: ResponsesBody;
    try {
      body = await response.json() as ResponsesBody;
    } catch {
      throw new ModelAdapterError(`OpenAI returned non-JSON response (${response.status})`, response.status >= 500);
    }
    if (!response.ok) {
      const retryable = response.status === 408 || response.status === 409 || response.status === 429 || response.status >= 500;
      throw new ModelAdapterError(body.error?.message ?? `OpenAI request failed (${response.status})`, retryable, body.id ?? null);
    }
    if (body.status && body.status !== "completed") {
      const reason = body.error?.message ?? body.incomplete_details?.reason ?? body.status;
      throw new ModelAdapterError(`OpenAI response did not complete: ${reason}`, body.status === "incomplete", body.id ?? null);
    }
    const outputText = body.output_text ?? body.output
      ?.flatMap((item) => item.content ?? [])
      .find((item) => item.type === "output_text" && item.text)?.text;
    if (!outputText) throw new ModelAdapterError("OpenAI response contained no output text", true, body.id ?? null);

    let data: unknown;
    try {
      data = JSON.parse(outputText);
    } catch {
      throw new ModelAdapterError("OpenAI output text was not valid JSON", true, body.id ?? null);
    }
    const inputTokens = body.usage?.input_tokens ?? 0;
    const outputTokens = body.usage?.output_tokens ?? 0;
    const usage: Usage = {
      inputTokens,
      outputTokens,
      totalTokens: body.usage?.total_tokens ?? inputTokens + outputTokens,
      costUsd: this.costCalculator?.({ model: this.model, inputTokens, outputTokens }) ?? null
    };
    return {
      data,
      responseId: body.id ?? null,
      provider: this.provider,
      model: this.model,
      modelVersion: body.model ?? null,
      usage
    };
  }
}
