import { createHash } from "node:crypto";
import { createFixtureId, createId } from "../domain/ids.js";
import { validateStudy, validateStudyDraft, type Study } from "../domain/index.js";
import { StudyNotFoundError } from "../application/errors.js";
import type { StudyRepository } from "../persistence/repository.js";
import type { WorkflowRepository } from "../persistence/workflow-repository.js";
import { invalidateRun, type StudyChange } from "./dependencies.js";
import { buildStageInput, promptVersion, stageInstructions, stageOutputJsonSchema } from "./prompts.js";
import { applyStageOutput, StageOutputValidationError, validateStageOutput } from "./stage-processing.js";
import { ModelAdapterError, PipelineConfigSchema, PipelineRunSchema, STAGE_ORDER, WORKFLOW_SCHEMA_VERSION, type ModelAdapter, type PipelineConfig, type PipelineRun, type StageError, type StageRun, type Usage } from "./types.js";

export class PipelineRunNotFoundError extends Error {
  constructor(runId: string) {
    super(`Pipeline run not found: ${runId}`);
    this.name = "PipelineRunNotFoundError";
  }
}

const emptyUsage = (): Usage => ({ inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: null });

function totalUsage(stages: StageRun[]): Usage {
  const usages = stages.map((stage) => stage.usage).filter((usage): usage is Usage => usage !== null);
  return {
    inputTokens: usages.reduce((sum, usage) => sum + usage.inputTokens, 0),
    outputTokens: usages.reduce((sum, usage) => sum + usage.outputTokens, 0),
    totalTokens: usages.reduce((sum, usage) => sum + usage.totalTokens, 0),
    costUsd: usages.length === 0 || usages.some((usage) => usage.costUsd === null)
      ? null
      : usages.reduce((sum, usage) => sum + usage.costUsd!, 0)
  };
}

function addUsage(current: Usage | null, next: Usage): Usage {
  return {
    inputTokens: (current?.inputTokens ?? 0) + next.inputTokens,
    outputTokens: (current?.outputTokens ?? 0) + next.outputTokens,
    totalTokens: (current?.totalTokens ?? 0) + next.totalTokens,
    costUsd: current?.costUsd === null || next.costUsd === null
      ? null
      : (current?.costUsd ?? 0) + next.costUsd
  };
}

function errorFrom(error: unknown): StageError {
  if (error instanceof StageOutputValidationError) {
    return { code: "invalid_output", message: error.message, retryable: true, issues: error.issues };
  }
  if (error instanceof ModelAdapterError) {
    return { code: "model_error", message: error.message, retryable: error.retryable, issues: [] };
  }
  return {
    code: "apply_error",
    message: error instanceof Error ? error.message : "Unknown stage error",
    retryable: false,
    issues: []
  };
}

export type PipelineClock = () => string;

export class PlanningPipeline {
  private readonly active = new Map<string, AbortController>();

  constructor(
    private readonly studies: StudyRepository,
    private readonly workflows: WorkflowRepository,
    private readonly adapter: ModelAdapter,
    private readonly clock: PipelineClock = () => new Date().toISOString()
  ) {}

  createRun(studyId: string, inputConfig: Partial<PipelineConfig> = {}): PipelineRun {
    if (!this.studies.loadDraft(studyId)) throw new StudyNotFoundError(studyId);
    const config = PipelineConfigSchema.parse(inputConfig);
    const id = createId();
    const now = this.clock();
    const run = PipelineRunSchema.parse({
      schemaVersion: WORKFLOW_SCHEMA_VERSION,
      id,
      studyId,
      status: "pending",
      config,
      cancelRequested: false,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      totalUsage: emptyUsage(),
      stages: STAGE_ORDER.map((stage, ordinal) => ({
        id: createFixtureId(id, "stage", stage),
        runId: id,
        stage,
        ordinal,
        status: "pending",
        attemptCount: 0,
        inputJson: null,
        inputHash: null,
        outputJson: null,
        promptVersion: promptVersion(config, stage),
        provider: null,
        model: null,
        modelVersion: null,
        responseId: null,
        usage: null,
        error: null,
        startedAt: null,
        completedAt: null
      }))
    });
    this.workflows.saveRun(run);
    return run;
  }

  getRun(runId: string): PipelineRun {
    const run = this.workflows.loadRun(runId);
    if (!run) throw new PipelineRunNotFoundError(runId);
    return run;
  }

  cancelRun(runId: string): PipelineRun {
    this.getRun(runId);
    this.workflows.requestCancellation(runId, this.clock());
    this.active.get(runId)?.abort();
    return this.getRun(runId);
  }

  applyStudyEdit(input: unknown, changes: StudyChange[]): { study: Study; run: PipelineRun | null } {
    const study = validateStudyDraft({ ...validateStudyDraft(input), updatedAt: this.clock() });
    this.studies.saveDraft(study);
    const latest = this.workflows.listRuns(study.id).at(-1);
    if (!latest || changes.length === 0) return { study, run: latest ?? null };
    const stale = invalidateRun(latest, changes, this.clock());
    this.workflows.saveRun(stale);
    return { study, run: stale };
  }

  async executeRun(runId: string): Promise<PipelineRun> {
    let run = this.getRun(runId);
    let study = this.studies.loadDraft(run.studyId);
    if (!study) throw new StudyNotFoundError(run.studyId);
    if (run.status === "completed") return run;
    const now = this.clock();
    this.workflows.clearCancellation(runId, now);
    run = {
      ...run,
      status: "running",
      cancelRequested: false,
      updatedAt: now,
      completedAt: null,
      stages: run.stages.map((stage) => stage.status === "running" || stage.status === "failed" || stage.status === "cancelled"
        ? { ...stage, status: "pending", error: null, startedAt: null, completedAt: null }
        : stage)
    };
    this.workflows.saveRun(run);

    for (const stageSnapshot of run.stages) {
      if (stageSnapshot.status === "completed") continue;
      if (this.workflows.isCancellationRequested(runId)) return this.finishCancelled(run, stageSnapshot.stage);
      run = this.getRun(runId);
      study = this.studies.loadDraft(run.studyId)!;
      const index = run.stages.findIndex((item) => item.stage === stageSnapshot.stage);
      let stage = run.stages[index]!;
      const previousOutput = stage.outputJson ? JSON.parse(stage.outputJson) as unknown : null;
      const input = buildStageInput(stage.stage, study, run.config, run.stages);
      const inputJson = JSON.stringify(input);
      stage = {
        ...stage,
        status: "running",
        inputJson,
        inputHash: createHash("sha256").update(inputJson).digest("hex"),
        outputJson: stage.status === "stale" ? stage.outputJson : null,
        error: null,
        provider: this.adapter.provider,
        model: this.adapter.model,
        modelVersion: this.adapter.modelVersion,
        startedAt: this.clock(),
        completedAt: null
      };
      run = this.replaceStage(run, index, stage, "running");
      this.workflows.saveRun(run);

      const controller = new AbortController();
      this.active.set(runId, controller);
      let feedback: StageError | undefined;
      let succeeded = false;
      for (let localAttempt = 0; localAttempt <= run.config.maxRetries; localAttempt += 1) {
        stage = { ...stage, attemptCount: stage.attemptCount + 1, error: feedback ?? null };
        run = this.replaceStage(run, index, stage, "running");
        this.workflows.saveRun(run);
        try {
          const response = await this.adapter.generate({
            runId,
            stage: stage.stage,
            promptVersion: stage.promptVersion,
            instructions: stageInstructions(stage.stage),
            input,
            outputSchemaName: `${stage.stage}_output`,
            outputJsonSchema: stageOutputJsonSchema(stage.stage),
            ...(feedback ? { retryFeedback: feedback } : {}),
            signal: controller.signal
          });
          stage = {
            ...stage,
            provider: response.provider,
            model: response.model,
            modelVersion: response.modelVersion,
            responseId: response.responseId,
            usage: addUsage(stage.usage, response.usage)
          };
          if (controller.signal.aborted || this.workflows.isCancellationRequested(runId)) {
            return this.finishCancelled(this.replaceStage(run, index, stage, "running"), stage.stage);
          }
          const output = validateStageOutput(stage.stage, response.data, study, run.config);
          study = validateStudyDraft({
            ...applyStageOutput(stage.stage, output, study, runId, previousOutput),
            updatedAt: this.clock()
          });
          this.studies.saveDraft(study);
          stage = {
            ...stage,
            status: "completed",
            outputJson: JSON.stringify(output),
            error: null,
            completedAt: this.clock()
          };
          run = this.replaceStage(run, index, stage, "running");
          run = { ...run, totalUsage: totalUsage(run.stages), updatedAt: this.clock() };
          this.workflows.saveRun(run);
          succeeded = true;
          break;
        } catch (error) {
          feedback = errorFrom(error);
          stage = {
            ...stage,
            error: feedback,
            responseId: error instanceof ModelAdapterError && error.responseId ? error.responseId : stage.responseId
          };
          run = this.replaceStage(run, index, stage, "running");
          if (controller.signal.aborted || this.workflows.isCancellationRequested(runId)) {
            return this.finishCancelled(run, stage.stage);
          }
          if (!feedback.retryable || localAttempt === run.config.maxRetries) {
            stage = { ...stage, status: "failed", completedAt: this.clock() };
            run = this.replaceStage(run, index, stage, "failed");
            run = { ...run, totalUsage: totalUsage(run.stages), updatedAt: this.clock() };
            this.workflows.saveRun(run);
            this.active.delete(runId);
            return run;
          }
          this.workflows.saveRun({ ...run, totalUsage: totalUsage(run.stages), updatedAt: this.clock() });
        }
      }
      this.active.delete(runId);
      if (!succeeded) return this.getRun(runId);
    }

    run = this.getRun(runId);
    try {
      validateStudy(study);
    } catch (error) {
      const index = run.stages.findIndex((item) => item.stage === "synthesis");
      const stage = run.stages[index]!;
      const failed = {
        ...stage,
        status: "failed" as const,
        error: errorFrom(error),
        completedAt: this.clock()
      };
      run = this.replaceStage(run, index, failed, "failed");
      this.workflows.saveRun(run);
      return run;
    }
    const completedAt = this.clock();
    run = {
      ...run,
      status: "completed",
      cancelRequested: false,
      updatedAt: completedAt,
      completedAt,
      totalUsage: totalUsage(run.stages)
    };
    this.workflows.saveRun(run);
    return run;
  }

  private replaceStage(run: PipelineRun, index: number, stage: StageRun, status: PipelineRun["status"]): PipelineRun {
    const stages = [...run.stages];
    stages[index] = stage;
    return { ...run, status, stages, updatedAt: this.clock() };
  }

  private finishCancelled(run: PipelineRun, stageName: StageRun["stage"]): PipelineRun {
    const index = run.stages.findIndex((item) => item.stage === stageName);
    const stage = run.stages[index]!;
    const cancelled: StageRun = {
      ...stage,
      status: "cancelled",
      error: { code: "cancelled", message: "Run cancelled", retryable: false, issues: [] },
      completedAt: this.clock()
    };
    const stages = [...run.stages];
    stages[index] = cancelled;
    const result: PipelineRun = {
      ...run,
      status: "cancelled",
      cancelRequested: true,
      stages,
      updatedAt: this.clock(),
      completedAt: this.clock(),
      totalUsage: totalUsage(stages)
    };
    this.workflows.saveRun(result);
    this.active.delete(run.id);
    return result;
  }
}
