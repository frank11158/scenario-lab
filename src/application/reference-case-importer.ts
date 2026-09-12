import { z } from "zod";
import { createFixtureId } from "../domain/ids.js";
import { STUDY_SCHEMA_VERSION, type Study } from "../domain/schema.js";
import { validateStudy } from "../domain/validation.js";

const TextSchema = z.string().trim().min(1);
const FixtureSchema = z.object({
  fixture_version: z.literal("0.1"),
  id: TextSchema,
  title: TextSchema,
  family: TextSchema,
  synthetic: z.literal(true),
  notice: TextSchema,
  decision: TextSchema,
  objective: TextSchema,
  horizon: TextSchema,
  decision_deadline: TextSchema,
  options: z.array(z.object({
    id: TextSchema,
    label: TextSchema,
    status_quo: z.boolean()
  }).strict()).min(1),
  constraints: z.array(z.object({
    id: TextSchema,
    kind: z.enum(["hard", "preference"]),
    text: TextSchema
  }).strict()),
  inputs: z.array(z.object({
    id: TextSchema,
    classification: z.enum(["assumption", "user_claim"]),
    text: TextSchema
  }).strict()),
  important_unknowns: z.array(TextSchema),
  expected_output_properties: z.array(z.object({ id: TextSchema, text: TextSchema }).strict()),
  prohibited_shortcuts: z.array(TextSchema)
}).strict();

export type ReferenceFixture = z.infer<typeof FixtureSchema>;

export type ImportFixtureOptions = {
  now?: string;
  studyId?: string;
};

export type ImportedReferenceCase = {
  study: Study;
  evaluationContract: {
    fixtureId: string;
    fixtureVersion: "0.1";
    expectedOutputProperties: Array<{ id: string; text: string }>;
    prohibitedShortcuts: string[];
  };
};

const unknown = (note: string) => ({ status: "unknown" as const, note });
const known = <T>(value: T) => ({ status: "known" as const, value });

export function parseReferenceFixture(input: unknown): ReferenceFixture {
  return FixtureSchema.parse(input);
}

function buildReferenceStudy(fixture: ReferenceFixture, options: ImportFixtureOptions): Study {
  const now = options.now ?? new Date().toISOString();
  const id = options.studyId ?? createFixtureId(fixture.id, "study");
  const sourceId = (kind: string, originalId: string) => createFixtureId(fixture.id, kind, originalId);

  const study: Study = {
    schemaVersion: STUDY_SCHEMA_VERSION,
    id,
    title: fixture.title,
    mode: "full",
    status: "draft",
    createdAt: now,
    updatedAt: now,
    synthetic: true,
    syntheticNotice: fixture.notice,
    problem: {
      id: sourceId("problem", "primary"),
      statement: fixture.decision,
      decisionMaker: unknown("Not supplied by the synthetic fixture"),
      affectedParties: [],
      controllableChoices: fixture.options.map((option) => option.label),
      externalUncertainties: [...fixture.important_unknowns],
      authorship: "imported"
    },
    objective: {
      id: sourceId("objective", "primary"),
      statement: fixture.objective,
      successCriteria: [fixture.objective],
      horizon: known(fixture.horizon),
      decisionDeadline: known(fixture.decision_deadline),
      authorship: "imported"
    },
    constraints: fixture.constraints.map((constraint) => ({
      id: sourceId("constraint", constraint.id),
      kind: constraint.kind,
      statement: constraint.text,
      sourceEvidenceIds: [],
      authorship: "imported" as const
    })),
    evidence: fixture.inputs.filter((item) => item.classification === "user_claim").map((item) => ({
      id: sourceId("evidence", item.id),
      claim: item.text,
      type: "user_claim" as const,
      source: unknown("Synthetic fixture input; no external source"),
      observedAt: unknown("No observation date supplied"),
      retrievedAt: unknown("Not retrieved"),
      limitations: ["Synthetic user claim; not independently verified"],
      authorship: "imported" as const
    })),
    assumptions: fixture.inputs.filter((item) => item.classification === "assumption").map((item) => ({
      id: sourceId("assumption", item.id),
      statement: item.text,
      basis: "Synthetic reference-case input",
      plausibleAlternatives: [],
      effectIfWrong: unknown("To be completed during the study"),
      test: unknown("To be completed during the study"),
      evidenceIds: [],
      authorship: "imported" as const
    })),
    drivers: [],
    scenarioCoverage: {
      kind: "exploratory",
      rationale: "Reference fixtures begin unweighted; scenarios are not yet constructed."
    },
    scenarios: [],
    consequences: [],
    strategies: fixture.options.map((option) => ({
      id: sourceId("strategy", option.id),
      name: option.label,
      description: option.label,
      statusQuo: option.status_quo,
      feasible: true,
      costAndReversibility: unknown("To be evaluated"),
      authorship: "imported" as const
    })),
    evaluationCriteria: fixture.constraints.map((constraint) => constraint.text),
    evaluations: [],
    indicators: [],
    actions: [],
    evidenceGaps: [...fixture.important_unknowns],
    recommendation: unknown("No recommendation exists before scenario and strategy evaluation"),
    currentRevisionId: unknown("No accepted revision yet")
  };

  return validateStudy(study);
}

export function importReferenceCase(input: unknown, options: ImportFixtureOptions = {}): ImportedReferenceCase {
  const fixture = parseReferenceFixture(input);
  return {
    study: buildReferenceStudy(fixture, options),
    evaluationContract: {
      fixtureId: fixture.id,
      fixtureVersion: fixture.fixture_version,
      expectedOutputProperties: fixture.expected_output_properties.map((property) => ({ ...property })),
      prohibitedShortcuts: [...fixture.prohibited_shortcuts]
    }
  };
}

export function importReferenceFixture(input: unknown, options: ImportFixtureOptions = {}): Study {
  return importReferenceCase(input, options).study;
}
