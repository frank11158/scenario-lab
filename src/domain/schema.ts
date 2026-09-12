import { z } from "zod";
import { EntityIdSchema } from "./ids.js";

export const STUDY_SCHEMA_VERSION = "1.0.0" as const;
export const ISODateTimeSchema = z.string().datetime({ offset: true });
const TextSchema = z.string().trim().min(1, "must not be empty");

export const UnknownSchema = z.object({
  status: z.literal("unknown"),
  note: TextSchema.optional()
}).strict();

export function knownOrUnknown<T extends z.ZodTypeAny>(value: T) {
  return z.discriminatedUnion("status", [
    z.object({ status: z.literal("known"), value }).strict(),
    UnknownSchema
  ]);
}

export const AuthorshipSchema = z.enum(["user", "generated", "imported"]);
export const StudyModeSchema = z.enum(["quick", "full"]);
export const StudyStatusSchema = z.enum(["draft", "reviewed", "superseded"]);
export const ConstraintKindSchema = z.enum(["hard", "preference"]);

export const ProblemSchema = z.object({
  id: EntityIdSchema,
  statement: TextSchema,
  decisionMaker: knownOrUnknown(TextSchema),
  affectedParties: z.array(TextSchema).default([]),
  controllableChoices: z.array(TextSchema).default([]),
  externalUncertainties: z.array(TextSchema).default([]),
  authorship: AuthorshipSchema
}).strict();

export const ObjectiveSchema = z.object({
  id: EntityIdSchema,
  statement: TextSchema,
  successCriteria: z.array(TextSchema).min(1, "requires at least one success criterion"),
  horizon: knownOrUnknown(TextSchema),
  decisionDeadline: knownOrUnknown(TextSchema),
  authorship: AuthorshipSchema
}).strict();

export const ConstraintSchema = z.object({
  id: EntityIdSchema,
  kind: ConstraintKindSchema,
  statement: TextSchema,
  sourceEvidenceIds: z.array(EntityIdSchema).default([]),
  authorship: AuthorshipSchema
}).strict();

export const EvidenceSchema = z.object({
  id: EntityIdSchema,
  claim: TextSchema,
  type: z.enum(["sourced_fact", "user_claim", "inference"]),
  source: knownOrUnknown(TextSchema),
  observedAt: knownOrUnknown(ISODateTimeSchema),
  retrievedAt: knownOrUnknown(ISODateTimeSchema),
  limitations: z.array(TextSchema).default([]),
  authorship: AuthorshipSchema
}).strict();

export const AssumptionSchema = z.object({
  id: EntityIdSchema,
  statement: TextSchema,
  basis: TextSchema,
  plausibleAlternatives: z.array(TextSchema).default([]),
  effectIfWrong: knownOrUnknown(TextSchema),
  test: knownOrUnknown(TextSchema),
  evidenceIds: z.array(EntityIdSchema).default([]),
  authorship: AuthorshipSchema
}).strict();

export const DriverSchema = z.object({
  id: EntityIdSchema,
  name: TextSchema,
  currentState: knownOrUnknown(TextSchema),
  impact: z.number().int().min(1).max(5),
  uncertainty: z.number().int().min(1).max(5),
  rationale: TextSchema,
  evidenceIds: z.array(EntityIdSchema).default([]),
  assumptionIds: z.array(EntityIdSchema).default([]),
  authorship: AuthorshipSchema
}).strict();

export const DriverStateSchema = z.object({
  driverId: EntityIdSchema,
  state: TextSchema
}).strict();

export const ProbabilitySchema = z.object({
  value: z.number().min(0).max(1),
  basis: TextSchema
}).strict();

export const ScenarioSchema = z.object({
  id: EntityIdSchema,
  name: TextSchema,
  driverStates: z.array(DriverStateSchema).min(1),
  causalMechanism: TextSchema,
  timeline: TextSchema,
  disconfirmingEvidence: z.array(TextSchema).min(1),
  probability: ProbabilitySchema.optional(),
  evidenceConfidence: z.enum(["low", "medium", "high"]),
  assumptionIds: z.array(EntityIdSchema).default([]),
  authorship: AuthorshipSchema
}).strict();

export const ConsequenceSchema = z.object({
  id: EntityIdSchema,
  scenarioId: EntityIdSchema,
  kind: z.enum(["direct", "second_order", "opportunity", "threat"]),
  statement: TextSchema,
  driverIds: z.array(EntityIdSchema).default([]),
  assumptionIds: z.array(EntityIdSchema).default([]),
  evidenceIds: z.array(EntityIdSchema).default([]),
  authorship: AuthorshipSchema
}).strict();

export const StrategySchema = z.object({
  id: EntityIdSchema,
  name: TextSchema,
  description: TextSchema,
  statusQuo: z.boolean(),
  feasible: z.boolean(),
  costAndReversibility: knownOrUnknown(TextSchema),
  authorship: AuthorshipSchema
}).strict();

export const CriterionResultSchema = z.object({
  criterion: TextSchema,
  outcome: TextSchema
}).strict();

export const EvaluationSchema = z.object({
  id: EntityIdSchema,
  strategyId: EntityIdSchema,
  scenarioId: EntityIdSchema,
  rating: z.enum(["weak", "adequate", "strong", "not_applicable"]),
  rationale: TextSchema,
  criterionResults: z.array(CriterionResultSchema).min(1),
  violatedConstraintIds: z.array(EntityIdSchema).default([]),
  authorship: AuthorshipSchema
}).strict();

export const TriggerSchema = z.object({
  threshold: TextSchema,
  observationWindow: TextSchema
}).strict();

export const IndicatorSchema = z.object({
  id: EntityIdSchema,
  name: TextSchema,
  source: knownOrUnknown(TextSchema),
  trigger: TriggerSchema,
  implication: TextSchema,
  actionIds: z.array(EntityIdSchema).min(1),
  owner: knownOrUnknown(TextSchema),
  reviewCadence: TextSchema,
  authorship: AuthorshipSchema
}).strict();

export const ActionSchema = z.object({
  id: EntityIdSchema,
  timing: z.enum(["now", "prepare", "if_triggered"]),
  description: TextSchema,
  owner: knownOrUnknown(TextSchema),
  due: knownOrUnknown(TextSchema),
  successCheck: TextSchema,
  triggerIndicatorIds: z.array(EntityIdSchema).default([]),
  authorship: AuthorshipSchema
}).strict();

export const ScenarioCoverageSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("exploratory"),
    rationale: TextSchema
  }).strict(),
  z.object({
    kind: z.literal("mutually_exclusive_exhaustive"),
    rationale: TextSchema
  }).strict()
]);

export const StudyRevisionSchema = z.object({
  id: EntityIdSchema,
  studyId: EntityIdSchema,
  ordinal: z.number().int().positive(),
  parentRevisionId: knownOrUnknown(EntityIdSchema),
  acceptedAt: ISODateTimeSchema,
  summary: TextSchema,
  schemaVersion: z.literal(STUDY_SCHEMA_VERSION)
}).strict();

export const StudySchema = z.object({
  schemaVersion: z.literal(STUDY_SCHEMA_VERSION),
  id: EntityIdSchema,
  title: TextSchema,
  mode: StudyModeSchema,
  status: StudyStatusSchema,
  createdAt: ISODateTimeSchema,
  updatedAt: ISODateTimeSchema,
  synthetic: z.boolean(),
  syntheticNotice: TextSchema.optional(),
  problem: ProblemSchema,
  objective: ObjectiveSchema,
  constraints: z.array(ConstraintSchema),
  evidence: z.array(EvidenceSchema),
  assumptions: z.array(AssumptionSchema),
  drivers: z.array(DriverSchema),
  scenarioCoverage: ScenarioCoverageSchema,
  scenarios: z.array(ScenarioSchema),
  consequences: z.array(ConsequenceSchema),
  strategies: z.array(StrategySchema).min(1),
  evaluationCriteria: z.array(TextSchema),
  evaluations: z.array(EvaluationSchema),
  indicators: z.array(IndicatorSchema),
  actions: z.array(ActionSchema),
  evidenceGaps: z.array(TextSchema),
  recommendation: knownOrUnknown(TextSchema),
  currentRevisionId: knownOrUnknown(EntityIdSchema)
}).strict();

export type Unknown = z.infer<typeof UnknownSchema>;
export type Problem = z.infer<typeof ProblemSchema>;
export type Objective = z.infer<typeof ObjectiveSchema>;
export type Constraint = z.infer<typeof ConstraintSchema>;
export type Evidence = z.infer<typeof EvidenceSchema>;
export type Assumption = z.infer<typeof AssumptionSchema>;
export type Driver = z.infer<typeof DriverSchema>;
export type Scenario = z.infer<typeof ScenarioSchema>;
export type Consequence = z.infer<typeof ConsequenceSchema>;
export type Strategy = z.infer<typeof StrategySchema>;
export type Evaluation = z.infer<typeof EvaluationSchema>;
export type Indicator = z.infer<typeof IndicatorSchema>;
export type Action = z.infer<typeof ActionSchema>;
export type StudyRevision = z.infer<typeof StudyRevisionSchema>;
export type Study = z.infer<typeof StudySchema>;
