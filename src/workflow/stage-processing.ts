import { z } from "zod";
import { createFixtureId } from "../domain/ids.js";
import type { Study } from "../domain/schema.js";
import { validateStudyDraft } from "../domain/validation.js";
import { STAGE_OUTPUT_SCHEMAS, type StageOutputs } from "./stage-schemas.js";
import type { PipelineConfig, StageName } from "./types.js";

export type StageOutputIssue = { path: string; message: string };

export class StageOutputValidationError extends Error {
  constructor(readonly issues: StageOutputIssue[]) {
    super(`Stage output validation failed with ${issues.length} issue${issues.length === 1 ? "" : "s"}`);
    this.name = "StageOutputValidationError";
  }
}

const issue = (issues: StageOutputIssue[], path: string, message: string) => issues.push({ path, message });
const ids = <T extends { id: string }>(items: T[]) => new Set(items.map((item) => item.id));
const protectedItems = <T extends { authorship: string }>(items: T[]) => items.filter((item) => item.authorship !== "generated");
const mergeGenerated = <T extends { id: string; authorship: string }>(existing: T[], generated: T[]): T[] => {
  const protectedValues = protectedItems(existing);
  const protectedIds = ids(protectedValues);
  return [...protectedValues, ...generated.filter((item) => !protectedIds.has(item.id))];
};

function requireRefs(values: string[], valid: Set<string>, path: string, kind: string, issues: StageOutputIssue[]): void {
  values.forEach((value, index) => {
    if (!valid.has(value)) issue(issues, `${path}.${index}`, `Unknown ${kind} ID: ${value}`);
  });
}

function validateSemantics(stage: StageName, output: unknown, study: Study, config: PipelineConfig): StageOutputIssue[] {
  const issues: StageOutputIssue[] = [];
  const evidenceIds = ids(study.evidence);
  const assumptionIds = ids(study.assumptions);
  const driverIds = ids(study.drivers);
  const scenarioIds = ids(study.scenarios);
  const strategyIds = ids(study.strategies);
  const constraintIds = ids(study.constraints);

  if (stage === "framing") {
    (output as StageOutputs["framing"]).provisionalAssumptions.forEach((item, index) =>
      requireRefs(item.evidenceIds, evidenceIds, `provisionalAssumptions.${index}.evidenceIds`, "evidence", issues));
  }
  if (stage === "evidence") {
    const value = output as StageOutputs["evidence"];
    value.assumptions.forEach((item, index) =>
      requireRefs(item.evidenceIds, evidenceIds, `assumptions.${index}.evidenceIds`, "evidence", issues));
    value.contradictions.forEach((item, index) => {
      requireRefs([item.leftEvidenceId], evidenceIds, `contradictions.${index}.leftEvidenceId`, "evidence", issues);
      requireRefs([item.rightEvidenceId], evidenceIds, `contradictions.${index}.rightEvidenceId`, "evidence", issues);
      if (item.leftEvidenceId === item.rightEvidenceId) issue(issues, `contradictions.${index}`, "A contradiction must link two different evidence records");
    });
  }
  if (stage === "drivers") {
    const value = output as StageOutputs["drivers"];
    const names = new Set<string>();
    value.drivers.forEach((item, index) => {
      const normalized = item.name.toLocaleLowerCase();
      if (names.has(normalized)) issue(issues, `drivers.${index}.name`, `Duplicate driver name: ${item.name}`);
      names.add(normalized);
      requireRefs(item.evidenceIds, evidenceIds, `drivers.${index}.evidenceIds`, "evidence", issues);
      requireRefs(item.assumptionIds, assumptionIds, `drivers.${index}.assumptionIds`, "assumption", issues);
    });
  }
  if (stage === "scenarios") {
    const value = output as StageOutputs["scenarios"];
    const protectedCount = protectedItems(study.scenarios).length;
    const expected = Math.max(0, config.scenarioCount - protectedCount);
    if (value.scenarios.length !== expected) issue(issues, "scenarios", `Expected ${expected} generated scenarios; received ${value.scenarios.length}`);
    const names = new Set(protectedItems(study.scenarios).map((item) => item.name.toLocaleLowerCase()));
    value.scenarios.forEach((item, index) => {
      const normalized = item.name.toLocaleLowerCase();
      if (names.has(normalized)) issue(issues, `scenarios.${index}.name`, `Duplicate scenario name: ${item.name}`);
      names.add(normalized);
      requireRefs(item.driverStates.map((state) => state.driverId), driverIds, `scenarios.${index}.driverStates`, "driver", issues);
      requireRefs(item.assumptionIds, assumptionIds, `scenarios.${index}.assumptionIds`, "assumption", issues);
      const stateIds = item.driverStates.map((state) => state.driverId);
      if (new Set(stateIds).size !== stateIds.length) issue(issues, `scenarios.${index}.driverStates`, "A driver can have only one state in a scenario");
      if (value.coverage.kind === "exploratory" && item.probability !== null) issue(issues, `scenarios.${index}.probability`, "Exploratory scenarios cannot carry numeric probabilities");
    });
    const probabilities = value.scenarios.map((item) => item.probability).filter((item) => item !== null);
    if (probabilities.length > 0) {
      if (probabilities.length !== value.scenarios.length) issue(issues, "scenarios", "Probability must be supplied for every generated scenario or none");
      const sum = probabilities.reduce((total, item) => total + item.value, 0);
      if (Math.abs(sum - 1) > 1e-9) issue(issues, "scenarios", `Scenario probabilities must sum to 1; received ${sum}`);
    }
  }
  if (stage === "consequences") {
    const value = output as StageOutputs["consequences"];
    value.consequences.forEach((item, index) => {
      requireRefs([item.scenarioId], scenarioIds, `consequences.${index}.scenarioId`, "scenario", issues);
      requireRefs(item.driverIds, driverIds, `consequences.${index}.driverIds`, "driver", issues);
      requireRefs(item.assumptionIds, assumptionIds, `consequences.${index}.assumptionIds`, "assumption", issues);
      requireRefs(item.evidenceIds, evidenceIds, `consequences.${index}.evidenceIds`, "evidence", issues);
    });
    const combined = [...protectedItems(study.consequences), ...value.consequences];
    for (const scenario of study.scenarios) {
      if (!combined.some((item) => item.scenarioId === scenario.id && item.kind === "direct")) issue(issues, "consequences", `Scenario ${scenario.id} has no direct consequence`);
      if (!combined.some((item) => item.scenarioId === scenario.id && item.kind === "second_order")) issue(issues, "consequences", `Scenario ${scenario.id} has no second-order consequence`);
    }
  }
  if (stage === "strategy_evaluation") {
    const value = output as StageOutputs["strategy_evaluation"];
    const preserved = protectedItems(study.evaluations);
    const expected = new Set<string>();
    for (const strategy of study.strategies.filter((item) => item.feasible)) {
      for (const scenario of study.scenarios) {
        if (!preserved.some((item) => item.strategyId === strategy.id && item.scenarioId === scenario.id)) expected.add(`${strategy.id}:${scenario.id}`);
      }
    }
    const actual = new Set<string>();
    value.evaluations.forEach((item, index) => {
      requireRefs([item.strategyId], strategyIds, `evaluations.${index}.strategyId`, "strategy", issues);
      requireRefs([item.scenarioId], scenarioIds, `evaluations.${index}.scenarioId`, "scenario", issues);
      requireRefs(item.violatedConstraintIds, constraintIds, `evaluations.${index}.violatedConstraintIds`, "constraint", issues);
      const pair = `${item.strategyId}:${item.scenarioId}`;
      if (actual.has(pair)) issue(issues, `evaluations.${index}`, `Duplicate strategy/scenario evaluation: ${pair}`);
      actual.add(pair);
    });
    for (const pair of expected) if (!actual.has(pair)) issue(issues, "evaluations", `Missing required evaluation: ${pair}`);
    for (const pair of actual) if (!expected.has(pair)) issue(issues, "evaluations", `Unexpected or user-covered evaluation: ${pair}`);
  }
  if (stage === "synthesis") {
    const value = output as StageOutputs["synthesis"];
    const actionKeys = new Set<string>();
    const indicatorKeys = new Set<string>();
    value.actions.forEach((item, index) => {
      if (actionKeys.has(item.key)) issue(issues, `actions.${index}.key`, `Duplicate action key: ${item.key}`);
      actionKeys.add(item.key);
    });
    value.indicators.forEach((item, index) => {
      if (indicatorKeys.has(item.key)) issue(issues, `indicators.${index}.key`, `Duplicate indicator key: ${item.key}`);
      indicatorKeys.add(item.key);
    });
    value.actions.forEach((item, index) => item.triggerIndicatorKeys.forEach((key, refIndex) => {
      if (!indicatorKeys.has(key)) issue(issues, `actions.${index}.triggerIndicatorKeys.${refIndex}`, `Unknown indicator key: ${key}`);
    }));
    value.indicators.forEach((item, index) => item.actionKeys.forEach((key, refIndex) => {
      if (!actionKeys.has(key)) issue(issues, `indicators.${index}.actionKeys.${refIndex}`, `Unknown action key: ${key}`);
    }));
  }
  return issues;
}

export function validateStageOutput(stage: StageName, input: unknown, study: Study, config: PipelineConfig): unknown {
  const result = STAGE_OUTPUT_SCHEMAS[stage].safeParse(input);
  if (!result.success) {
    throw new StageOutputValidationError(result.error.issues.map((item) => ({ path: item.path.join("."), message: item.message })));
  }
  const issues = validateSemantics(stage, result.data, study, config);
  if (issues.length) throw new StageOutputValidationError(issues);
  return result.data;
}

const nullable = (value: string | null, note: string) => value === null
  ? { status: "unknown" as const, note }
  : { status: "known" as const, value };

const assumptionEntities = (runId: string, stage: StageName, assumptions: StageOutputs["evidence"]["assumptions"]) => assumptions.map((item, index) => ({
  id: createFixtureId(runId, stage, "assumption", String(index), item.statement),
  statement: item.statement,
  basis: item.basis,
  plausibleAlternatives: item.plausibleAlternatives,
  effectIfWrong: nullable(item.effectIfWrong, "Effect has not been established"),
  test: nullable(item.test, "Test has not been established"),
  evidenceIds: item.evidenceIds,
  authorship: "generated" as const
}));

export function applyStageOutput(
  stage: StageName,
  rawOutput: unknown,
  study: Study,
  runId: string,
  previousOutput: unknown | null = null
): Study {
  if (stage === "framing") {
    const output = rawOutput as StageOutputs["framing"];
    return validateStudyDraft({
      ...study,
      assumptions: mergeGenerated(study.assumptions, assumptionEntities(runId, stage, output.provisionalAssumptions))
    });
  }
  if (stage === "evidence") {
    const output = rawOutput as StageOutputs["evidence"];
    const detected = output.contradictions.map((item) => ({
      id: createFixtureId(runId, stage, "contradiction", ...[item.leftEvidenceId, item.rightEvidenceId].sort()),
      leftEvidenceId: item.leftEvidenceId,
      rightEvidenceId: item.rightEvidenceId,
      description: item.description,
      status: item.resolution === null ? "open" as const : "resolved" as const,
      resolution: nullable(item.resolution, "Not resolved"),
      detectedAt: study.updatedAt,
      detectedBy: "model" as const
    }));
    const detectedIds = new Set(detected.map((item) => item.id));
    return validateStudyDraft({
      ...study,
      assumptions: mergeGenerated(study.assumptions, assumptionEntities(runId, stage, output.assumptions)),
      evidenceGaps: [...new Set([...study.evidenceGaps, ...output.evidenceGaps])],
      research: {
        ...study.research,
        contradictions: [...study.research.contradictions.filter((item) => !detectedIds.has(item.id) || item.status === "resolved"), ...detected.filter((item) => !study.research.contradictions.some((prior) => prior.id === item.id && prior.status === "resolved"))]
      }
    });
  }
  if (stage === "drivers") {
    const output = rawOutput as StageOutputs["drivers"];
    const generated = output.drivers.map((item, index) => ({
      id: createFixtureId(runId, stage, "driver", String(index), item.name),
      name: item.name,
      currentState: nullable(item.currentState, "Current state not established"),
      impact: item.impact,
      uncertainty: item.uncertainty,
      rationale: item.rationale,
      evidenceIds: item.evidenceIds,
      assumptionIds: item.assumptionIds,
      authorship: "generated" as const
    }));
    return validateStudyDraft({ ...study, drivers: mergeGenerated(study.drivers, generated) });
  }
  if (stage === "scenarios") {
    const output = rawOutput as StageOutputs["scenarios"];
    const generated = output.scenarios.map((item, index) => ({
      id: createFixtureId(runId, stage, "scenario", String(index), item.name),
      name: item.name,
      driverStates: item.driverStates,
      causalMechanism: item.causalMechanism,
      timeline: item.timeline,
      disconfirmingEvidence: item.disconfirmingEvidence,
      ...(item.probability === null ? {} : { probability: item.probability }),
      evidenceConfidence: item.evidenceConfidence,
      assumptionIds: item.assumptionIds,
      authorship: "generated" as const
    }));
    return validateStudyDraft({
      ...study,
      scenarioCoverage: output.coverage,
      scenarios: mergeGenerated(study.scenarios, generated)
    });
  }
  if (stage === "consequences") {
    const output = rawOutput as StageOutputs["consequences"];
    const generated = output.consequences.map((item, index) => ({
      id: createFixtureId(runId, stage, "consequence", String(index), item.scenarioId, item.kind),
      ...item,
      authorship: "generated" as const
    }));
    return validateStudyDraft({ ...study, consequences: mergeGenerated(study.consequences, generated) });
  }
  if (stage === "strategy_evaluation") {
    const output = rawOutput as StageOutputs["strategy_evaluation"];
    const generated = output.evaluations.map((item, index) => ({
      id: createFixtureId(runId, stage, "evaluation", String(index), item.strategyId, item.scenarioId),
      ...item,
      authorship: "generated" as const
    }));
    return validateStudyDraft({
      ...study,
      evaluationCriteria: [...new Set([...study.evaluationCriteria, ...output.evaluationCriteria])],
      evaluations: mergeGenerated(study.evaluations, generated)
    });
  }
  const output = rawOutput as StageOutputs["synthesis"];
  const actionIds = new Map(output.actions.map((item) => [item.key, createFixtureId(runId, stage, "action", item.key)]));
  const indicatorIds = new Map(output.indicators.map((item) => [item.key, createFixtureId(runId, stage, "indicator", item.key)]));
  const generatedActions = output.actions.map((item) => ({
    id: actionIds.get(item.key)!,
    timing: item.timing,
    description: item.description,
    owner: nullable(item.owner, "Owner unassigned"),
    due: nullable(item.due, "Due date or trigger not assigned"),
    successCheck: item.successCheck,
    triggerIndicatorIds: item.triggerIndicatorKeys.map((key) => indicatorIds.get(key)!),
    authorship: "generated" as const
  }));
  const generatedIndicators = output.indicators.map((item) => ({
    id: indicatorIds.get(item.key)!,
    name: item.name,
    source: nullable(item.source, "Source not established"),
    trigger: { threshold: item.threshold, observationWindow: item.observationWindow },
    implication: item.implication,
    actionIds: item.actionKeys.map((key) => actionIds.get(key)!),
    owner: nullable(item.owner, "Owner unassigned"),
    reviewCadence: item.reviewCadence,
    authorship: "generated" as const
  }));
  const previousRecommendation = previousOutput && typeof previousOutput === "object" && "recommendation" in previousOutput
    ? String((previousOutput as { recommendation: unknown }).recommendation)
    : null;
  const mayReplaceRecommendation = study.recommendation.status === "unknown"
    || (study.recommendation.status === "known" && study.recommendation.value === previousRecommendation);
  return validateStudyDraft({
    ...study,
    recommendation: mayReplaceRecommendation ? { status: "known", value: output.recommendation } : study.recommendation,
    evidenceGaps: [...new Set([...study.evidenceGaps, ...output.unresolvedGaps])],
    actions: mergeGenerated(study.actions, generatedActions),
    indicators: mergeGenerated(study.indicators, generatedIndicators)
  });
}
