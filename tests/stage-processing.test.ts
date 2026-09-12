import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createId } from "../src/domain/ids.js";
import { PipelineConfigSchema } from "../src/workflow/types.js";
import { StageOutputValidationError, validateStageOutput } from "../src/workflow/stage-processing.js";
import { completeStudy, importedStudy } from "./helpers.js";

const config = PipelineConfigSchema.parse({ scenarioCount: 3 });

describe("stage semantic validation", () => {
  it("rejects generated driver links to unavailable evidence", () => {
    const study = importedStudy();
    const missing = createId();
    assert.throws(() => validateStageOutput("drivers", {
      drivers: [{
        name: "Demand",
        currentState: null,
        impact: 5,
        uncertainty: 4,
        rationale: "Demand changes the preferred option.",
        evidenceIds: [missing],
        assumptionIds: []
      }],
      interactionSummary: "Demand interacts with lead time."
    }, study, config), (error: unknown) => {
      assert.ok(error instanceof StageOutputValidationError);
      assert.ok(error.issues.some((item) => item.message.includes(missing)));
      return true;
    });
  });

  it("rejects self-contradictions and unknown evidence references", () => {
    const study = importedStudy("rc-02-job-timing.json");
    const evidenceId = study.evidence[0]!.id;
    assert.throws(() => validateStageOutput("evidence", {
      assumptions: [],
      evidenceGaps: [],
      contradictions: [{
        leftEvidenceId: evidenceId,
        rightEvidenceId: evidenceId,
        description: "A record cannot contradict itself.",
        resolution: null
      }]
    }, study, config), (error: unknown) => {
      assert.ok(error instanceof StageOutputValidationError);
      assert.ok(error.issues.some((item) => item.message.includes("two different")));
      return true;
    });
  });

  it("requires both direct and second-order effects for every scenario", () => {
    const study = completeStudy();
    assert.throws(() => validateStageOutput("consequences", {
      consequences: study.scenarios.map((scenario) => ({
        scenarioId: scenario.id,
        kind: "direct",
        statement: "A direct effect is present.",
        driverIds: scenario.driverStates.map((item) => item.driverId),
        assumptionIds: [],
        evidenceIds: []
      })),
      consistencyNotes: [],
      omittedTailRisks: []
    }, study, config), (error: unknown) => {
      assert.ok(error instanceof StageOutputValidationError);
      assert.ok(error.issues.some((item) => item.message.includes("second-order")));
      return true;
    });
  });
});
