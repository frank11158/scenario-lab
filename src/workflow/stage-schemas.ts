import { z } from "zod";
import { EntityIdSchema } from "../domain/ids.js";
import { StageNameSchema, type StageName } from "./types.js";

const Text = z.string().trim().min(1);
const NullableText = Text.nullable();

const ProposedAssumptionSchema = z.object({
  statement: Text,
  basis: Text,
  plausibleAlternatives: z.array(Text),
  effectIfWrong: NullableText,
  test: NullableText,
  evidenceIds: z.array(EntityIdSchema)
}).strict();

export const FramingOutputSchema = z.object({
  missingFields: z.array(Text),
  clarifyingQuestions: z.array(Text),
  provisionalAssumptions: z.array(ProposedAssumptionSchema),
  framingRisks: z.array(Text)
}).strict();

export const EvidenceOutputSchema = z.object({
  assumptions: z.array(ProposedAssumptionSchema),
  evidenceGaps: z.array(Text),
  contradictions: z.array(z.object({
    leftEvidenceId: EntityIdSchema,
    rightEvidenceId: EntityIdSchema,
    description: Text,
    resolution: NullableText
  }).strict())
}).strict();

export const DriversOutputSchema = z.object({
  drivers: z.array(z.object({
    name: Text,
    currentState: NullableText,
    impact: z.number().int().min(1).max(5),
    uncertainty: z.number().int().min(1).max(5),
    rationale: Text,
    evidenceIds: z.array(EntityIdSchema),
    assumptionIds: z.array(EntityIdSchema)
  }).strict()).min(1).max(10),
  interactionSummary: Text
}).strict();

export const ScenariosOutputSchema = z.object({
  coverage: z.object({
    kind: z.enum(["exploratory", "mutually_exclusive_exhaustive"]),
    rationale: Text
  }).strict(),
  scenarios: z.array(z.object({
    name: Text,
    driverStates: z.array(z.object({ driverId: EntityIdSchema, state: Text }).strict()).min(1),
    causalMechanism: Text,
    timeline: Text,
    disconfirmingEvidence: z.array(Text).min(1),
    probability: z.object({ value: z.number().min(0).max(1), basis: Text }).strict().nullable(),
    evidenceConfidence: z.enum(["low", "medium", "high"]),
    assumptionIds: z.array(EntityIdSchema)
  }).strict())
}).strict();

export const ConsequencesOutputSchema = z.object({
  consequences: z.array(z.object({
    scenarioId: EntityIdSchema,
    kind: z.enum(["direct", "second_order", "opportunity", "threat"]),
    statement: Text,
    driverIds: z.array(EntityIdSchema),
    assumptionIds: z.array(EntityIdSchema),
    evidenceIds: z.array(EntityIdSchema)
  }).strict()),
  consistencyNotes: z.array(Text),
  omittedTailRisks: z.array(Text)
}).strict();

export const StrategyEvaluationOutputSchema = z.object({
  evaluationCriteria: z.array(Text).min(1),
  evaluations: z.array(z.object({
    strategyId: EntityIdSchema,
    scenarioId: EntityIdSchema,
    rating: z.enum(["weak", "adequate", "strong", "not_applicable"]),
    rationale: Text,
    criterionResults: z.array(z.object({ criterion: Text, outcome: Text }).strict()).min(1),
    violatedConstraintIds: z.array(EntityIdSchema)
  }).strict()),
  robustChoice: Text,
  conditionalChoices: z.array(Text),
  failureConditions: z.array(Text)
}).strict();

export const SynthesisOutputSchema = z.object({
  recommendation: Text,
  strongestChallenge: Text,
  reversalAssumption: Text,
  unresolvedGaps: z.array(Text),
  actions: z.array(z.object({
    key: Text,
    timing: z.enum(["now", "prepare", "if_triggered"]),
    description: Text,
    owner: NullableText,
    due: NullableText,
    successCheck: Text,
    triggerIndicatorKeys: z.array(Text)
  }).strict()).min(1),
  indicators: z.array(z.object({
    key: Text,
    name: Text,
    source: NullableText,
    threshold: Text,
    observationWindow: Text,
    implication: Text,
    actionKeys: z.array(Text).min(1),
    owner: NullableText,
    reviewCadence: Text
  }).strict()).min(1)
}).strict();

export const STAGE_OUTPUT_SCHEMAS = {
  framing: FramingOutputSchema,
  evidence: EvidenceOutputSchema,
  drivers: DriversOutputSchema,
  scenarios: ScenariosOutputSchema,
  consequences: ConsequencesOutputSchema,
  strategy_evaluation: StrategyEvaluationOutputSchema,
  synthesis: SynthesisOutputSchema
} satisfies Record<StageName, z.ZodTypeAny>;

export const StageOutputEnvelopeSchema = z.object({
  stage: StageNameSchema,
  output: z.unknown()
}).strict();

export type StageOutputs = {
  framing: z.infer<typeof FramingOutputSchema>;
  evidence: z.infer<typeof EvidenceOutputSchema>;
  drivers: z.infer<typeof DriversOutputSchema>;
  scenarios: z.infer<typeof ScenariosOutputSchema>;
  consequences: z.infer<typeof ConsequencesOutputSchema>;
  strategy_evaluation: z.infer<typeof StrategyEvaluationOutputSchema>;
  synthesis: z.infer<typeof SynthesisOutputSchema>;
};
