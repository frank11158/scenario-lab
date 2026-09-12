import { z } from "zod";
import { StudySchema, type Study } from "./schema.js";

export type ValidationIssue = {
  path: string;
  code: string;
  message: string;
};

export class StudyValidationError extends Error {
  readonly issues: ValidationIssue[];

  constructor(issues: ValidationIssue[]) {
    super(`Study validation failed with ${issues.length} issue${issues.length === 1 ? "" : "s"}`);
    this.name = "StudyValidationError";
    this.issues = issues;
  }
}

function zodIssues(error: z.ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.join(".") || "$",
    code: issue.code,
    message: issue.message
  }));
}

function uniqueIds(study: Study, issues: ValidationIssue[]): void {
  const entries: Array<[string, string]> = [
    ["problem.id", study.problem.id],
    ["objective.id", study.objective.id],
    ...study.constraints.map((x, i) => [`constraints.${i}.id`, x.id] as [string, string]),
    ...study.evidence.map((x, i) => [`evidence.${i}.id`, x.id] as [string, string]),
    ...study.assumptions.map((x, i) => [`assumptions.${i}.id`, x.id] as [string, string]),
    ...study.drivers.map((x, i) => [`drivers.${i}.id`, x.id] as [string, string]),
    ...study.scenarios.map((x, i) => [`scenarios.${i}.id`, x.id] as [string, string]),
    ...study.consequences.map((x, i) => [`consequences.${i}.id`, x.id] as [string, string]),
    ...study.strategies.map((x, i) => [`strategies.${i}.id`, x.id] as [string, string]),
    ...study.evaluations.map((x, i) => [`evaluations.${i}.id`, x.id] as [string, string]),
    ...study.indicators.map((x, i) => [`indicators.${i}.id`, x.id] as [string, string]),
    ...study.actions.map((x, i) => [`actions.${i}.id`, x.id] as [string, string])
  ];
  const seen = new Map<string, string>();
  for (const [path, id] of entries) {
    const previous = seen.get(id);
    if (previous) {
      issues.push({ path, code: "duplicate_id", message: `ID is already used at ${previous}` });
    } else {
      seen.set(id, path);
    }
  }
}

function checkReferences(study: Study, issues: ValidationIssue[]): void {
  const ids = <T extends { id: string }>(items: T[]) => new Set(items.map((item) => item.id));
  const evidence = ids(study.evidence);
  const assumptions = ids(study.assumptions);
  const drivers = ids(study.drivers);
  const scenarios = ids(study.scenarios);
  const strategies = ids(study.strategies);
  const constraints = ids(study.constraints);
  const actions = ids(study.actions);
  const indicators = ids(study.indicators);

  const refs = (path: string, values: string[], valid: Set<string>, kind: string) => {
    values.forEach((value, index) => {
      if (!valid.has(value)) {
        issues.push({ path: `${path}.${index}`, code: "invalid_reference", message: `Unknown ${kind} ID: ${value}` });
      }
    });
  };

  study.constraints.forEach((x, i) => refs(`constraints.${i}.sourceEvidenceIds`, x.sourceEvidenceIds, evidence, "evidence"));
  study.assumptions.forEach((x, i) => refs(`assumptions.${i}.evidenceIds`, x.evidenceIds, evidence, "evidence"));
  study.drivers.forEach((x, i) => {
    refs(`drivers.${i}.evidenceIds`, x.evidenceIds, evidence, "evidence");
    refs(`drivers.${i}.assumptionIds`, x.assumptionIds, assumptions, "assumption");
  });
  study.scenarios.forEach((x, i) => {
    refs(`scenarios.${i}.driverStates`, x.driverStates.map((state) => state.driverId), drivers, "driver");
    refs(`scenarios.${i}.assumptionIds`, x.assumptionIds, assumptions, "assumption");
  });
  study.consequences.forEach((x, i) => {
    refs(`consequences.${i}.scenarioId`, [x.scenarioId], scenarios, "scenario");
    refs(`consequences.${i}.driverIds`, x.driverIds, drivers, "driver");
    refs(`consequences.${i}.assumptionIds`, x.assumptionIds, assumptions, "assumption");
    refs(`consequences.${i}.evidenceIds`, x.evidenceIds, evidence, "evidence");
  });
  study.evaluations.forEach((x, i) => {
    refs(`evaluations.${i}.strategyId`, [x.strategyId], strategies, "strategy");
    refs(`evaluations.${i}.scenarioId`, [x.scenarioId], scenarios, "scenario");
    refs(`evaluations.${i}.violatedConstraintIds`, x.violatedConstraintIds, constraints, "constraint");
  });
  study.indicators.forEach((x, i) => refs(`indicators.${i}.actionIds`, x.actionIds, actions, "action"));
  study.actions.forEach((x, i) => refs(`actions.${i}.triggerIndicatorIds`, x.triggerIndicatorIds, indicators, "indicator"));
}

function checkProbability(study: Study, issues: ValidationIssue[]): void {
  const withProbability = study.scenarios.filter((scenario) => scenario.probability !== undefined);
  if (withProbability.length === 0) return;
  if (study.scenarioCoverage.kind !== "mutually_exclusive_exhaustive") {
    issues.push({
      path: "scenarioCoverage.kind",
      code: "probability_requires_exhaustive_coverage",
      message: "Scenario probabilities require mutually exclusive and exhaustive coverage"
    });
    return;
  }
  if (withProbability.length !== study.scenarios.length) {
    issues.push({ path: "scenarios", code: "incomplete_probability_set", message: "Every scenario must have a probability when any scenario does" });
    return;
  }
  const sum = withProbability.reduce((total, scenario) => total + (scenario.probability?.value ?? 0), 0);
  if (Math.abs(sum - 1) > 1e-9) {
    issues.push({ path: "scenarios", code: "invalid_probability_sum", message: `Scenario probabilities must sum to 1; received ${sum}` });
  }
}

function checkStrategyCoverage(study: Study, issues: ValidationIssue[]): void {
  if (study.scenarios.length === 0) return;
  const pairs = new Set<string>();
  study.evaluations.forEach((evaluation, index) => {
    const pair = `${evaluation.strategyId}:${evaluation.scenarioId}`;
    if (pairs.has(pair)) {
      issues.push({ path: `evaluations.${index}`, code: "duplicate_evaluation", message: "Strategy/scenario pair is evaluated more than once" });
    }
    pairs.add(pair);
  });
  for (const strategy of study.strategies.filter((item) => item.feasible)) {
    for (const scenario of study.scenarios) {
      if (!pairs.has(`${strategy.id}:${scenario.id}`)) {
        issues.push({ path: "evaluations", code: "missing_evaluation", message: `Missing evaluation for strategy ${strategy.id} in scenario ${scenario.id}` });
      }
    }
  }
}

function checkStudyInvariants(study: Study): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  uniqueIds(study, issues);
  checkReferences(study, issues);
  checkProbability(study, issues);
  checkStrategyCoverage(study, issues);
  if (!study.strategies.some((strategy) => strategy.statusQuo)) {
    issues.push({ path: "strategies", code: "missing_status_quo", message: "At least one strategy must represent the status quo" });
  }
  if (study.synthetic && !study.syntheticNotice) {
    issues.push({ path: "syntheticNotice", code: "missing_synthetic_notice", message: "Synthetic studies require an explicit notice" });
  }
  if (!study.synthetic && study.syntheticNotice) {
    issues.push({ path: "syntheticNotice", code: "unexpected_synthetic_notice", message: "Non-synthetic studies cannot carry a synthetic notice" });
  }
  return issues;
}

export function validateStudy(input: unknown): Study {
  const parsed = StudySchema.safeParse(input);
  if (!parsed.success) throw new StudyValidationError(zodIssues(parsed.error));
  const issues = checkStudyInvariants(parsed.data);
  if (issues.length > 0) throw new StudyValidationError(issues);
  return parsed.data;
}

export function safeValidateStudy(input: unknown): { success: true; data: Study } | { success: false; issues: ValidationIssue[] } {
  try {
    return { success: true, data: validateStudy(input) };
  } catch (error) {
    if (error instanceof StudyValidationError) return { success: false, issues: error.issues };
    throw error;
  }
}
