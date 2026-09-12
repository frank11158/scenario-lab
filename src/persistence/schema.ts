import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const studiesTable = sqliteTable("studies", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  status: text("status").notNull(),
  schemaVersion: text("schema_version").notNull(),
  draftJson: text("draft_json").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const revisionsTable = sqliteTable("study_revisions", {
  id: text("id").primaryKey(),
  studyId: text("study_id").notNull().references(() => studiesTable.id, { onDelete: "cascade" }),
  ordinal: integer("ordinal").notNull(),
  parentRevisionId: text("parent_revision_id"),
  acceptedAt: text("accepted_at").notNull(),
  summary: text("summary").notNull(),
  schemaVersion: text("schema_version").notNull(),
  snapshotJson: text("snapshot_json").notNull()
}, (table) => ({
  studyOrdinalUnique: uniqueIndex("study_revisions_study_ordinal_unique").on(table.studyId, table.ordinal)
}));

export const workflowRunsTable = sqliteTable("workflow_runs", {
  id: text("id").primaryKey(),
  schemaVersion: text("schema_version").notNull(),
  studyId: text("study_id").notNull().references(() => studiesTable.id, { onDelete: "cascade" }),
  status: text("status").notNull(),
  configJson: text("config_json").notNull(),
  cancelRequested: integer("cancel_requested", { mode: "boolean" }).notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  completedAt: text("completed_at"),
  totalUsageJson: text("total_usage_json").notNull()
});

export const workflowStageRunsTable = sqliteTable("workflow_stage_runs", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull().references(() => workflowRunsTable.id, { onDelete: "cascade" }),
  stage: text("stage").notNull(),
  ordinal: integer("ordinal").notNull(),
  status: text("status").notNull(),
  attemptCount: integer("attempt_count").notNull(),
  inputJson: text("input_json"),
  inputHash: text("input_hash"),
  outputJson: text("output_json"),
  promptVersion: text("prompt_version").notNull(),
  provider: text("provider"),
  model: text("model"),
  modelVersion: text("model_version"),
  responseId: text("response_id"),
  usageJson: text("usage_json"),
  errorJson: text("error_json"),
  startedAt: text("started_at"),
  completedAt: text("completed_at")
}, (table) => ({
  runStageUnique: uniqueIndex("workflow_stage_runs_run_stage_unique").on(table.runId, table.stage)
}));
