import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { OpenAIResponsesAdapter } from "../src/workflow/openai-responses-adapter.js";
import { ModelAdapterError, type ModelRequest } from "../src/workflow/types.js";

const request = (): ModelRequest => ({
  runId: "98b5ca2c-aab6-47ce-a135-bf16658bd32a",
  stage: "framing",
  promptVersion: "m2.1.framing.1",
  instructions: "Return structured framing output.",
  input: { decision: "Test" },
  outputSchemaName: "framing_output",
  outputJsonSchema: { type: "object", additionalProperties: false },
  signal: new AbortController().signal
});

describe("OpenAI Responses adapter", () => {
  it("uses Responses structured output and records usage without assuming a price", async () => {
    let sent: Record<string, unknown> | undefined;
    const adapter = new OpenAIResponsesAdapter({
      apiKey: "test-key",
      model: "test-model",
      fetch: async (_url, init) => {
        sent = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return new Response(JSON.stringify({
          id: "resp_123",
          model: "test-model-2026-01-01",
          status: "completed",
          output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ missingFields: [] }) }] }],
          usage: { input_tokens: 12, output_tokens: 8, total_tokens: 20 }
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
    });
    const response = await adapter.generate(request());
    assert.equal((sent?.text as { format: { type: string } }).format.type, "json_schema");
    assert.equal(sent?.store, false);
    assert.deepEqual(JSON.parse(String(sent?.input)), {
      stageInput: { decision: "Test" },
      retryFeedback: null
    });
    assert.deepEqual(response.usage, { inputTokens: 12, outputTokens: 8, totalTokens: 20, costUsd: null });
    assert.equal(response.responseId, "resp_123");
    assert.equal(response.modelVersion, "test-model-2026-01-01");
  });

  it("classifies rate limits as retryable model errors", async () => {
    const adapter = new OpenAIResponsesAdapter({
      apiKey: "test-key",
      model: "test-model",
      fetch: async () => new Response(JSON.stringify({ error: { message: "rate limited" } }), { status: 429 })
    });
    await assert.rejects(() => adapter.generate(request()), (error: unknown) => {
      assert.ok(error instanceof ModelAdapterError);
      assert.equal(error.retryable, true);
      return true;
    });
  });
});
