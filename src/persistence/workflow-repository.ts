import { asc, eq } from "drizzle-orm";
import { PipelineConfigSchema, PipelineRunSchema, RunStatusSchema, StageErrorSchema, StageNameSchema, StageStatusSchema, UsageSchema, type PipelineRun, type StageRun } from "../workflow/types.js";
import type { ScenarioLabDatabase } from "./database.js";
import { workflowRunsTable, workflowStageRunsTable } from "./schema.js";

export interface WorkflowRepository {
  saveRun(run: PipelineRun): void;
  loadRun(runId: string): PipelineRun | undefined;
  listRuns(studyId: string): PipelineRun[];
  requestCancellation(runId: string, updatedAt: string): void;
  clearCancellation(runId: string, updatedAt: string): void;
  isCancellationRequested(runId: string): boolean;
}

const parseNullable = <T>(value: string | null, parser: { parse(input: unknown): T }): T | null =>
  value === null ? null : parser.parse(JSON.parse(value));

export class SqliteWorkflowRepository implements WorkflowRepository {
  constructor(private readonly db: ScenarioLabDatabase) {}

  saveRun(input: PipelineRun): void {
    const run = PipelineRunSchema.parse(input);
    this.db.transaction((tx) => {
      tx.insert(workflowRunsTable).values({
        id: run.id,
        schemaVersion: run.schemaVersion,
        studyId: run.studyId,
        status: run.status,
        configJson: JSON.stringify(run.config),
        cancelRequested: run.cancelRequested,
        createdAt: run.createdAt,
        updatedAt: run.updatedAt,
        completedAt: run.completedAt,
        totalUsageJson: JSON.stringify(run.totalUsage)
      }).onConflictDoUpdate({
        target: workflowRunsTable.id,
        set: {
          schemaVersion: run.schemaVersion,
          status: run.status,
          configJson: JSON.stringify(run.config),
          cancelRequested: run.cancelRequested,
          updatedAt: run.updatedAt,
          completedAt: run.completedAt,
          totalUsageJson: JSON.stringify(run.totalUsage)
        }
      }).run();
      for (const stage of run.stages) {
        tx.insert(workflowStageRunsTable).values({
          id: stage.id,
          runId: stage.runId,
          stage: stage.stage,
          ordinal: stage.ordinal,
          status: stage.status,
          attemptCount: stage.attemptCount,
          inputJson: stage.inputJson,
          inputHash: stage.inputHash,
          outputJson: stage.outputJson,
          promptVersion: stage.promptVersion,
          provider: stage.provider,
          model: stage.model,
          modelVersion: stage.modelVersion,
          responseId: stage.responseId,
          usageJson: stage.usage ? JSON.stringify(stage.usage) : null,
          errorJson: stage.error ? JSON.stringify(stage.error) : null,
          startedAt: stage.startedAt,
          completedAt: stage.completedAt
        }).onConflictDoUpdate({
          target: workflowStageRunsTable.id,
          set: {
            status: stage.status,
            attemptCount: stage.attemptCount,
            inputJson: stage.inputJson,
            inputHash: stage.inputHash,
            outputJson: stage.outputJson,
            promptVersion: stage.promptVersion,
            provider: stage.provider,
            model: stage.model,
            modelVersion: stage.modelVersion,
            responseId: stage.responseId,
            usageJson: stage.usage ? JSON.stringify(stage.usage) : null,
            errorJson: stage.error ? JSON.stringify(stage.error) : null,
            startedAt: stage.startedAt,
            completedAt: stage.completedAt
          }
        }).run();
      }
    });
  }

  loadRun(runId: string): PipelineRun | undefined {
    const row = this.db.select().from(workflowRunsTable).where(eq(workflowRunsTable.id, runId)).get();
    if (!row) return undefined;
    const stages = this.db.select().from(workflowStageRunsTable)
      .where(eq(workflowStageRunsTable.runId, runId))
      .orderBy(asc(workflowStageRunsTable.ordinal)).all()
      .map((stage): StageRun => ({
        id: stage.id,
        runId: stage.runId,
        stage: StageNameSchema.parse(stage.stage),
        ordinal: stage.ordinal,
        status: StageStatusSchema.parse(stage.status),
        attemptCount: stage.attemptCount,
        inputJson: stage.inputJson,
        inputHash: stage.inputHash,
        outputJson: stage.outputJson,
        promptVersion: stage.promptVersion,
        provider: stage.provider,
        model: stage.model,
        modelVersion: stage.modelVersion,
        responseId: stage.responseId,
        usage: parseNullable(stage.usageJson, UsageSchema),
        error: parseNullable(stage.errorJson, StageErrorSchema),
        startedAt: stage.startedAt,
        completedAt: stage.completedAt
      }));
    return PipelineRunSchema.parse({
      schemaVersion: row.schemaVersion,
      id: row.id,
      studyId: row.studyId,
      status: RunStatusSchema.parse(row.status),
      config: PipelineConfigSchema.parse(JSON.parse(row.configJson)),
      cancelRequested: row.cancelRequested,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      completedAt: row.completedAt,
      totalUsage: UsageSchema.parse(JSON.parse(row.totalUsageJson)),
      stages
    });
  }

  listRuns(studyId: string): PipelineRun[] {
    return this.db.select({ id: workflowRunsTable.id }).from(workflowRunsTable)
      .where(eq(workflowRunsTable.studyId, studyId))
      .orderBy(asc(workflowRunsTable.createdAt)).all()
      .map((row) => this.loadRun(row.id)!)
      .filter(Boolean);
  }

  requestCancellation(runId: string, updatedAt: string): void {
    this.db.update(workflowRunsTable).set({ cancelRequested: true, updatedAt })
      .where(eq(workflowRunsTable.id, runId)).run();
  }

  clearCancellation(runId: string, updatedAt: string): void {
    this.db.update(workflowRunsTable).set({ cancelRequested: false, updatedAt })
      .where(eq(workflowRunsTable.id, runId)).run();
  }

  isCancellationRequested(runId: string): boolean {
    return this.db.select({ cancelRequested: workflowRunsTable.cancelRequested })
      .from(workflowRunsTable).where(eq(workflowRunsTable.id, runId)).get()?.cancelRequested ?? false;
  }
}
