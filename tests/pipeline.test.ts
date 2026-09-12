import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { importReferenceFixture } from "../src/application/reference-case-importer.js";
import { openDatabase } from "../src/persistence/database.js";
import { SqliteStudyRepository } from "../src/persistence/repository.js";
import { SqliteWorkflowRepository } from "../src/persistence/workflow-repository.js";
import { assertRunCurrent, getRunFreshness } from "../src/workflow/dependencies.js";
import { PlanningPipeline } from "../src/workflow/pipeline.js";
import { loadFixture } from "./helpers.js";
import { ScriptedModelAdapter } from "./scripted-model.js";

const now = () => "2026-09-11T15:00:00.000Z";

function harness(adapter = new ScriptedModelAdapter()) {
  const database = openDatabase(":memory:");
  const studies = new SqliteStudyRepository(database.db);
  const workflows = new SqliteWorkflowRepository(database.db);
  const pipeline = new PlanningPipeline(studies, workflows, adapter, now);
  return { database, studies, workflows, pipeline, adapter };
}

describe("planning pipeline", () => {
  it("produces a complete reviewable draft for every reference case", async () => {
    const files = readdirSync("product/reference-cases").filter((name) => name.endsWith(".json"));
    for (const file of files) {
      const test = harness();
      try {
        const fixture = loadFixture(file) as { important_unknowns: string[] };
        const study = importReferenceFixture(fixture, { now: now() });
        test.studies.saveDraft(study);
        const created = test.pipeline.createRun(study.id, { scenarioCount: 3, maxRetries: 2 });
        const run = await test.pipeline.executeRun(created.id);
        const completed = test.studies.loadDraft(study.id)!;

        assert.equal(run.status, "completed");
        assert.doesNotThrow(() => assertRunCurrent(run));
        assert.equal(completed.drivers.length, 3);
        assert.equal(completed.scenarios.length, 3);
        assert.equal(completed.consequences.length, 6);
        assert.equal(completed.evaluations.length, completed.strategies.length * completed.scenarios.length);
        assert.equal(completed.recommendation.status, "known");
        assert.ok(completed.actions.length > 0);
        assert.ok(completed.indicators.length > 0);
        assert.ok(completed.evidenceGaps.includes("Validate the supplied synthetic assumptions."));
        assert.ok(fixture.important_unknowns.every((gap) => completed.evidenceGaps.includes(gap)));
        assert.equal(run.stages.every((stage) => stage.inputHash && stage.outputJson && stage.promptVersion && stage.responseId), true);
        assert.equal(run.totalUsage.totalTokens, 210);
        assert.equal(run.totalUsage.costUsd, 0.07);
      } finally {
        test.database.close();
      }
    }
  });

  it("honors a configurable scenario count", async () => {
    const test = harness();
    try {
      const study = importReferenceFixture(loadFixture(), { now: now() });
      test.studies.saveDraft(study);
      const run = await test.pipeline.executeRun(test.pipeline.createRun(study.id, { scenarioCount: 4 }).id);
      assert.equal(run.status, "completed");
      assert.equal(test.studies.loadDraft(study.id)?.scenarios.length, 4);
    } finally {
      test.database.close();
    }
  });

  it("bounds invalid-output retries and persists a clear stage error", async () => {
    const adapter = new ScriptedModelAdapter({ invalidAttempts: { drivers: 3 } });
    const test = harness(adapter);
    try {
      const study = importReferenceFixture(loadFixture(), { now: now() });
      test.studies.saveDraft(study);
      const run = await test.pipeline.executeRun(test.pipeline.createRun(study.id, { maxRetries: 2 }).id);
      const driver = run.stages.find((stage) => stage.stage === "drivers")!;
      assert.equal(run.status, "failed");
      assert.equal(driver.status, "failed");
      assert.equal(driver.attemptCount, 3);
      assert.equal(driver.error?.code, "invalid_output");
      assert.ok(driver.error!.issues.length > 0);
      assert.equal(driver.provider, adapter.provider);
      assert.equal(driver.model, adapter.model);
      assert.equal(adapter.calls.filter((stage) => stage === "drivers").length, 3);
      assert.equal(run.stages.find((stage) => stage.stage === "scenarios")?.status, "pending");
    } finally {
      test.database.close();
    }
  });

  it("resumes after failure without rerunning completed stages or creating revisions", async () => {
    const directory = mkdtempSync(join(tmpdir(), "scenario-lab-m2-resume-"));
    const filename = join(directory, "resume.sqlite");
    const firstAdapter = new ScriptedModelAdapter({ failingStages: ["drivers"] });
    const firstDatabase = openDatabase(filename);
    const firstStudies = new SqliteStudyRepository(firstDatabase.db);
    const firstWorkflows = new SqliteWorkflowRepository(firstDatabase.db);
    try {
      const study = importReferenceFixture(loadFixture(), { now: now() });
      firstStudies.saveDraft(study);
      const firstPipeline = new PlanningPipeline(firstStudies, firstWorkflows, firstAdapter, now);
      const created = firstPipeline.createRun(study.id);
      const failed = await firstPipeline.executeRun(created.id);
      assert.equal(failed.status, "failed");
      assert.deepEqual(firstAdapter.calls, ["framing", "evidence", "drivers"]);
      firstDatabase.close();

      const reopened = openDatabase(filename);
      const studies = new SqliteStudyRepository(reopened.db);
      const workflows = new SqliteWorkflowRepository(reopened.db);
      const resumeAdapter = new ScriptedModelAdapter();
      try {
        const resumed = await new PlanningPipeline(studies, workflows, resumeAdapter, now).executeRun(created.id);
        assert.equal(resumed.status, "completed");
        assert.deepEqual(resumeAdapter.calls, ["drivers", "scenarios", "consequences", "strategy_evaluation", "synthesis"]);
        assert.equal(studies.listRevisions(study.id).length, 0);
        assert.equal(resumed.stages.find((stage) => stage.stage === "drivers")?.attemptCount, 2);
      } finally {
        reopened.close();
      }
    } finally {
      if (firstDatabase.sqlite.open) firstDatabase.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("cancels an active request, preserves checkpoints, and can resume", async () => {
    const delayed = new ScriptedModelAdapter({ delayedStages: ["framing"] });
    const test = harness(delayed);
    try {
      const study = importReferenceFixture(loadFixture(), { now: now() });
      test.studies.saveDraft(study);
      const created = test.pipeline.createRun(study.id);
      const executing = test.pipeline.executeRun(created.id);
      await new Promise((resolve) => setTimeout(resolve, 25));
      test.pipeline.cancelRun(created.id);
      const cancelled = await executing;
      assert.equal(cancelled.status, "cancelled");
      assert.equal(cancelled.stages[0]?.status, "cancelled");

      const resumedAdapter = new ScriptedModelAdapter();
      const resumed = await new PlanningPipeline(test.studies, test.workflows, resumedAdapter, now).executeRun(created.id);
      assert.equal(resumed.status, "completed");
      assert.equal(resumedAdapter.calls[0], "framing");
    } finally {
      test.database.close();
    }
  });

  it("marks only affected downstream stages stale and preserves a user recommendation", async () => {
    const test = harness();
    try {
      const study = importReferenceFixture(loadFixture(), { now: now() });
      test.studies.saveDraft(study);
      const created = test.pipeline.createRun(study.id);
      const completedRun = await test.pipeline.executeRun(created.id);
      const completedStudy = test.studies.loadDraft(study.id)!;
      const edited = {
        ...completedStudy,
        assumptions: completedStudy.assumptions.map((item, index) => index === 0
          ? { ...item, statement: `${item.statement} (user revised)`, authorship: "user" as const }
          : item),
        drivers: completedStudy.drivers.map((item, index) => index === 0
          ? { ...item, rationale: "User-authored driver rationale must remain.", authorship: "user" as const }
          : item),
        recommendation: { status: "known" as const, value: "User-authored recommendation must remain." }
      };
      const result = test.pipeline.applyStudyEdit(edited, ["assumption"]);
      assert.deepEqual(getRunFreshness(result.run!), {
        current: false,
        staleStages: ["drivers", "scenarios", "consequences", "strategy_evaluation", "synthesis"]
      });
      assert.throws(() => assertRunCurrent(result.run!), /not current/);

      const regenerationAdapter = new ScriptedModelAdapter();
      const regenerated = await new PlanningPipeline(test.studies, test.workflows, regenerationAdapter, now).executeRun(completedRun.id);
      assert.equal(regenerated.status, "completed");
      assert.deepEqual(regenerationAdapter.calls, ["drivers", "scenarios", "consequences", "strategy_evaluation", "synthesis"]);
      const finalStudy = test.studies.loadDraft(study.id)!;
      assert.equal(finalStudy.assumptions[0]?.authorship, "user");
      assert.equal(finalStudy.drivers[0]?.authorship, "user");
      assert.equal(finalStudy.drivers[0]?.rationale, "User-authored driver rationale must remain.");
      assert.equal(finalStudy.recommendation.status, "known");
      if (finalStudy.recommendation.status === "known") assert.equal(finalStudy.recommendation.value, "User-authored recommendation must remain.");
    } finally {
      test.database.close();
    }
  });
});
