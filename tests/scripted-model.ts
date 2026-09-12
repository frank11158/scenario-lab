import type { Study } from "../src/domain/schema.js";
import { ModelAdapterError, type ModelAdapter, type ModelRequest, type ModelResponse, type StageName } from "../src/workflow/types.js";

type ScriptedOptions = {
  invalidAttempts?: Partial<Record<StageName, number>>;
  failingStages?: StageName[];
  delayedStages?: StageName[];
};

export class ScriptedModelAdapter implements ModelAdapter {
  readonly provider = "scripted-test";
  readonly model = "fixture-model";
  readonly modelVersion = "fixture-model-1";
  readonly calls: StageName[] = [];
  private readonly invalidAttempts: Partial<Record<StageName, number>>;
  private readonly failingStages: Set<StageName>;
  private readonly delayedStages: Set<StageName>;

  constructor(options: ScriptedOptions = {}) {
    this.invalidAttempts = { ...options.invalidAttempts };
    this.failingStages = new Set(options.failingStages ?? []);
    this.delayedStages = new Set(options.delayedStages ?? []);
  }

  async generate(request: ModelRequest): Promise<ModelResponse> {
    this.calls.push(request.stage);
    if (this.delayedStages.has(request.stage)) {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(resolve, 250);
        request.signal.addEventListener("abort", () => {
          clearTimeout(timeout);
          reject(new ModelAdapterError("Scripted request cancelled", false));
        }, { once: true });
      });
    }
    if (this.failingStages.has(request.stage)) throw new ModelAdapterError(`Scripted failure at ${request.stage}`, false);
    const invalid = this.invalidAttempts[request.stage] ?? 0;
    if (invalid > 0) {
      this.invalidAttempts[request.stage] = invalid - 1;
      return this.response({ invalid: true }, request.stage);
    }
    return this.response(this.output(request), request.stage);
  }

  private response(data: unknown, stage: StageName): ModelResponse {
    return {
      data,
      responseId: `response-${stage}-${this.calls.length}`,
      provider: this.provider,
      model: this.model,
      modelVersion: this.modelVersion,
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30, costUsd: 0.01 }
    };
  }

  private output(request: ModelRequest): unknown {
    const input = request.input as {
      study: Study;
      generationTargets: {
        generatedScenarioCount: number;
        missingEvaluationPairs: Array<{ strategyId: string; scenarioId: string }>;
      };
    };
    const study = input.study;
    switch (request.stage) {
      case "framing":
        return {
          missingFields: study.problem.decisionMaker.status === "unknown" ? ["Decision-maker"] : [],
          clarifyingQuestions: ["Which unknown could reverse the choice?"],
          provisionalAssumptions: [],
          framingRisks: ["Synthetic inputs require validation before action."]
        };
      case "evidence":
        return {
          assumptions: [],
          evidenceGaps: ["Validate the supplied synthetic assumptions."],
          contradictions: []
        };
      case "drivers":
        return {
          drivers: [1, 2, 3].map((index) => ({
            name: `Decision driver ${index}`,
            currentState: null,
            impact: 6 - index,
            uncertainty: index + 1,
            rationale: `Driver ${index} materially changes the decision outcome.`,
            evidenceIds: [],
            assumptionIds: study.assumptions.slice(0, 2).map((item) => item.id)
          })),
          interactionSummary: "The drivers interact through timing, demand, and reversibility."
        };
      case "scenarios": {
        const driver = study.drivers[0]!;
        return {
          coverage: { kind: "exploratory", rationale: "Distinct plausible futures; no probabilities assigned." },
          scenarios: Array.from({ length: input.generationTargets.generatedScenarioCount }, (_, index) => ({
            name: `Plausible future ${index + 1}`,
            driverStates: [{ driverId: driver.id, state: `Driver state ${index + 1}` }],
            causalMechanism: `A distinct sequence ${index + 1} changes the option tradeoffs.`,
            timeline: `Develops during period ${index + 1} of the decision horizon.`,
            disconfirmingEvidence: [`Observed state differs from driver state ${index + 1}.`],
            probability: null,
            evidenceConfidence: "low",
            assumptionIds: study.assumptions.slice(0, 2).map((item) => item.id)
          }))
        };
      }
      case "consequences":
        return {
          consequences: study.scenarios.flatMap((scenario) => [
            {
              scenarioId: scenario.id,
              kind: "direct",
              statement: `The scenario directly changes whether the objective is met in ${scenario.name}.`,
              driverIds: scenario.driverStates.map((item) => item.driverId),
              assumptionIds: scenario.assumptionIds,
              evidenceIds: []
            },
            {
              scenarioId: scenario.id,
              kind: "second_order",
              statement: `The initial outcome changes later flexibility in ${scenario.name}.`,
              driverIds: scenario.driverStates.map((item) => item.driverId),
              assumptionIds: scenario.assumptionIds,
              evidenceIds: []
            }
          ]),
          consistencyNotes: ["Each future uses a defined driver state and timeline."],
          omittedTailRisks: ["A simultaneous external shock remains outside the scenario set."]
        };
      case "strategy_evaluation":
        return {
          evaluationCriteria: study.evaluationCriteria.length ? study.evaluationCriteria : study.objective.successCriteria,
          evaluations: input.generationTargets.missingEvaluationPairs.map((pair) => ({
            ...pair,
            rating: "adequate",
            rationale: "The option remains feasible but depends on unresolved evidence.",
            criterionResults: [{ criterion: study.objective.successCriteria[0]!, outcome: "Conditionally meets the criterion." }],
            violatedConstraintIds: []
          })),
          robustChoice: "Prefer the most reversible option while material evidence is missing.",
          conditionalChoices: ["A less reversible option can become preferable after its trigger is observed."],
          failureConditions: ["A hard constraint fails or the key assumption reverses."]
        };
      case "synthesis":
        return {
          recommendation: "Take the reversible next step, validate the largest gap, and preserve a fallback.",
          strongestChallenge: "Waiting may sacrifice a time-sensitive opportunity.",
          reversalAssumption: "The choice reverses if waiting removes the feasible option.",
          unresolvedGaps: ["Validate the highest-impact assumption."],
          actions: [
            { key: "learn", timing: "now", description: "Run the smallest useful evidence check.", owner: null, due: "Before commitment", successCheck: "The key assumption is measured.", triggerIndicatorKeys: [] },
            { key: "pivot", timing: "if_triggered", description: "Switch to the contingent option.", owner: null, due: null, successCheck: "The hard constraints remain satisfied.", triggerIndicatorKeys: ["signal"] }
          ],
          indicators: [
            { key: "signal", name: "Decision reversal signal", source: null, threshold: "The key assumption crosses its switching point", observationWindow: "At each review", implication: "The contingent option is now preferable.", actionKeys: ["pivot"], owner: null, reviewCadence: "Monthly" }
          ]
        };
    }
  }
}
