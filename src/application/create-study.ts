import { createId } from "../domain/ids.js";
import { STUDY_SCHEMA_VERSION, type Study } from "../domain/schema.js";
import { validateStudy } from "../domain/validation.js";

export type CreateStudyInput = {
  title: string;
  decision: string;
  objective: string;
  successCriteria: string[];
  mode: "quick" | "full";
  decisionMaker?: string;
  horizon?: string;
  decisionDeadline?: string;
  options: Array<{ name: string; description?: string; statusQuo: boolean }>;
  constraints?: Array<{ kind: "hard" | "preference"; statement: string }>;
};

export type CreateStudyOptions = {
  now?: string;
  id?: string;
};

const suppliedOrUnknown = (value: string | undefined, note: string) => value?.trim()
  ? { status: "known" as const, value: value.trim() }
  : { status: "unknown" as const, note };

export function createStudyDraft(input: CreateStudyInput, options: CreateStudyOptions = {}): Study {
  const now = options.now ?? new Date().toISOString();
  return validateStudy({
    schemaVersion: STUDY_SCHEMA_VERSION,
    id: options.id ?? createId(),
    title: input.title,
    mode: input.mode,
    status: "draft",
    createdAt: now,
    updatedAt: now,
    synthetic: false,
    problem: {
      id: createId(),
      statement: input.decision,
      decisionMaker: suppliedOrUnknown(input.decisionMaker, "Decision-maker not provided"),
      affectedParties: [],
      controllableChoices: input.options.map((option) => option.name),
      externalUncertainties: [],
      authorship: "user"
    },
    objective: {
      id: createId(),
      statement: input.objective,
      successCriteria: input.successCriteria,
      horizon: suppliedOrUnknown(input.horizon, "Time horizon not provided"),
      decisionDeadline: suppliedOrUnknown(input.decisionDeadline, "Decision deadline not provided"),
      authorship: "user"
    },
    constraints: (input.constraints ?? []).map((constraint) => ({
      id: createId(),
      kind: constraint.kind,
      statement: constraint.statement,
      sourceEvidenceIds: [],
      authorship: "user"
    })),
    evidence: [],
    assumptions: [],
    drivers: [],
    scenarioCoverage: {
      kind: "exploratory",
      rationale: "Scenarios have not been constructed; no probability is assigned."
    },
    scenarios: [],
    consequences: [],
    strategies: input.options.map((option) => ({
      id: createId(),
      name: option.name,
      description: option.description?.trim() || option.name,
      statusQuo: option.statusQuo,
      feasible: true,
      costAndReversibility: { status: "unknown", note: "Not evaluated" },
      authorship: "user"
    })),
    evaluationCriteria: [...input.successCriteria],
    evaluations: [],
    indicators: [],
    actions: [],
    evidenceGaps: [],
    recommendation: { status: "unknown", note: "No recommendation has been developed" },
    currentRevisionId: { status: "unknown", note: "No accepted revision yet" }
  });
}
