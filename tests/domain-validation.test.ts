import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createStudyDraft } from "../src/application/create-study.js";
import { createId } from "../src/domain/ids.js";
import { safeValidateStudy, StudyValidationError, validateStudy } from "../src/domain/validation.js";
import { completeStudy, importedStudy } from "./helpers.js";

describe("study validation", () => {
  it("creates a valid draft while preserving genuinely unknown intake values", () => {
    const study = createStudyDraft({
      title: "Choose a rollout",
      decision: "Choose whether to pilot or launch.",
      objective: "Learn quickly without exceeding the budget.",
      successCriteria: ["Stay within the budget"],
      mode: "quick",
      options: [
        { name: "Keep the status quo", statusQuo: true },
        { name: "Run a pilot", statusQuo: false }
      ]
    }, { now: "2026-09-11T12:00:00.000Z" });
    assert.equal(study.problem.decisionMaker.status, "unknown");
    assert.equal(study.objective.horizon.status, "unknown");
    assert.equal(study.objective.decisionDeadline.status, "unknown");
    assert.deepEqual(validateStudy(study), study);
  });

  it("represents unknown required context explicitly", () => {
    const study = importedStudy();
    assert.deepEqual(study.problem.decisionMaker, {
      status: "unknown",
      note: "Not supplied by the synthetic fixture"
    });
    assert.doesNotThrow(() => validateStudy(study));
  });

  it("returns a clear path for missing required fields", () => {
    const invalid = { ...importedStudy() } as Record<string, unknown>;
    delete invalid.objective;
    const result = safeValidateStudy(invalid);
    assert.equal(result.success, false);
    if (!result.success) {
      assert.ok(result.issues.some((issue) => issue.path === "objective" && issue.code === "invalid_type"));
    }
  });

  it("rejects dangling references with the ID and location", () => {
    const study = importedStudy();
    const invalid = {
      ...study,
      assumptions: [{ ...study.assumptions[0]!, evidenceIds: [createId()] }, ...study.assumptions.slice(1)]
    };
    assert.throws(() => validateStudy(invalid), StudyValidationError);
    try {
      validateStudy(invalid);
    } catch (error) {
      const validation = error as StudyValidationError;
      assert.equal(validation.issues[0]?.path, "assumptions.0.evidenceIds.0");
      assert.equal(validation.issues[0]?.code, "invalid_reference");
      assert.ok(validation.issues[0]?.message.includes(invalid.assumptions[0]!.evidenceIds[0]!));
    }
  });

  it("requires every feasible strategy to be evaluated in every scenario", () => {
    const study = completeStudy();
    const invalid = { ...study, evaluations: study.evaluations.slice(1) };
    const result = safeValidateStudy(invalid);
    assert.equal(result.success, false);
    if (!result.success) assert.ok(result.issues.some((issue) => issue.code === "missing_evaluation"));
  });

  it("accepts optional probabilities only for a complete exhaustive set summing to one", () => {
    const valid = completeStudy();
    assert.deepEqual(validateStudy(valid), valid);

    const exploratory = { ...valid, scenarioCoverage: { kind: "exploratory", rationale: "Not a partition" } };
    const exploratoryResult = safeValidateStudy(exploratory);
    assert.equal(exploratoryResult.success, false);
    if (!exploratoryResult.success) {
      assert.ok(exploratoryResult.issues.some((issue) => issue.code === "probability_requires_exhaustive_coverage"));
    }

    const badSum = {
      ...valid,
      scenarios: valid.scenarios.map((scenario) => ({ ...scenario, probability: { ...scenario.probability!, value: 0.4 } }))
    };
    const badSumResult = safeValidateStudy(badSum);
    assert.equal(badSumResult.success, false);
    if (!badSumResult.success) assert.ok(badSumResult.issues.some((issue) => issue.code === "invalid_probability_sum"));
  });
});
