import { z } from "zod";

export const WORKFLOW_SCHEMA_VERSION = "2.0.0" as const;

export const StageNameSchema = z.enum([
  "framing",
  "evidence",
  "drivers",
  "scenarios",
  "consequences",
  "strategy_evaluation",
  "synthesis"
]);
export type StageName = z.infer<typeof StageNameSchema>;

export const STAGE_ORDER: readonly StageName[] = StageNameSchema.options;

export const StageStatusSchema = z.enum([
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
  "stale"
]);
export type StageStatus = z.infer<typeof StageStatusSchema>;

export const RunStatusSchema = z.enum([
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
  "stale"
]);
export type RunStatus = z.infer<typeof RunStatusSchema>;

export const UsageSchema = z.object({
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
  costUsd: z.number().nonnegative().nullable()
}).strict();
export type Usage = z.infer<typeof UsageSchema>;

export const StageErrorSchema = z.object({
  code: z.enum(["invalid_output", "model_error", "cancelled", "invalid_stage_input", "apply_error"]),
  message: z.string().min(1),
  retryable: z.boolean(),
  issues: z.array(z.object({ path: z.string(), message: z.string() }).strict()).default([])
}).strict();
export type StageError = z.infer<typeof StageErrorSchema>;

export const PipelineConfigSchema = z.object({
  scenarioCount: z.number().int().min(2).max(6).default(3),
  maxRetries: z.number().int().min(0).max(3).default(2),
  promptSetVersion: z.string().min(1).default("m2.1")
}).strict();
export type PipelineConfig = z.infer<typeof PipelineConfigSchema>;

export const StageRunSchema = z.object({
  id: z.string().uuid(),
  runId: z.string().uuid(),
  stage: StageNameSchema,
  ordinal: z.number().int().min(0),
  status: StageStatusSchema,
  attemptCount: z.number().int().nonnegative(),
  inputJson: z.string().nullable(),
  inputHash: z.string().nullable(),
  outputJson: z.string().nullable(),
  promptVersion: z.string().min(1),
  provider: z.string().nullable(),
  model: z.string().nullable(),
  modelVersion: z.string().nullable(),
  responseId: z.string().nullable(),
  usage: UsageSchema.nullable(),
  error: StageErrorSchema.nullable(),
  startedAt: z.string().datetime({ offset: true }).nullable(),
  completedAt: z.string().datetime({ offset: true }).nullable()
}).strict();
export type StageRun = z.infer<typeof StageRunSchema>;

export const PipelineRunSchema = z.object({
  schemaVersion: z.literal(WORKFLOW_SCHEMA_VERSION),
  id: z.string().uuid(),
  studyId: z.string().uuid(),
  status: RunStatusSchema,
  config: PipelineConfigSchema,
  cancelRequested: z.boolean(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
  completedAt: z.string().datetime({ offset: true }).nullable(),
  totalUsage: UsageSchema,
  stages: z.array(StageRunSchema)
}).strict();
export type PipelineRun = z.infer<typeof PipelineRunSchema>;

export type ModelRequest = {
  runId: string;
  stage: StageName;
  promptVersion: string;
  instructions: string;
  input: unknown;
  outputSchemaName: string;
  outputJsonSchema: Record<string, unknown>;
  retryFeedback?: StageError;
  signal: AbortSignal;
};

export type ModelResponse = {
  data: unknown;
  responseId: string | null;
  provider: string;
  model: string;
  modelVersion: string | null;
  usage: Usage;
};

export interface ModelAdapter {
  readonly provider: string;
  readonly model: string;
  readonly modelVersion: string | null;
  generate(request: ModelRequest): Promise<ModelResponse>;
}

export class ModelAdapterError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly responseId: string | null = null
  ) {
    super(message);
    this.name = "ModelAdapterError";
  }
}
