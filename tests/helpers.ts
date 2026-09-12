import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { importReferenceFixture } from "../src/application/reference-case-importer.js";
import { createId } from "../src/domain/ids.js";
import type { Study } from "../src/domain/schema.js";
import { validateStudy } from "../src/domain/validation.js";

export const FIXED_NOW = "2026-09-11T12:00:00.000Z";

export function loadFixture(name = "rc-01-workshop.json"): unknown {
  return JSON.parse(readFileSync(resolve("product/reference-cases", name), "utf8"));
}

export function importedStudy(name = "rc-01-workshop.json"): Study {
  return importReferenceFixture(loadFixture(name), { now: FIXED_NOW });
}

export function completeStudy(): Study {
  const base = importedStudy();
  const driverId = createId();
  const scenarioA = createId();
  const scenarioB = createId();
  const scenarios = [
    {
      id: scenarioA,
      name: "Attendance holds",
      driverStates: [{ driverId, state: "At least eight attend" }],
      causalMechanism: "Schedules align before the cancellation point.",
      timeline: "Confirmed three weeks before the event.",
      disconfirmingEvidence: ["Fewer than eight confirmations"],
      probability: { value: 0.5, basis: "Synthetic equal weighting for validation" },
      evidenceConfidence: "low" as const,
      assumptionIds: base.assumptions.map((item) => item.id),
      authorship: "generated" as const
    },
    {
      id: scenarioB,
      name: "Attendance falls",
      driverStates: [{ driverId, state: "Fewer than eight attend" }],
      causalMechanism: "Conflicts accumulate before the cancellation point.",
      timeline: "Observed three weeks before the event.",
      disconfirmingEvidence: ["At least eight firm confirmations"],
      probability: { value: 0.5, basis: "Synthetic equal weighting for validation" },
      evidenceConfidence: "low" as const,
      assumptionIds: base.assumptions.map((item) => item.id),
      authorship: "generated" as const
    }
  ];
  const evaluations = base.strategies.flatMap((strategy) => scenarios.map((scenario) => ({
    id: createId(),
    strategyId: strategy.id,
    scenarioId: scenario.id,
    rating: "adequate" as const,
    rationale: "Synthetic evaluation used to verify complete matrix coverage.",
    criterionResults: [{ criterion: "Participation and budget", outcome: "Requires review" }],
    violatedConstraintIds: [],
    authorship: "generated" as const
  })));
  return validateStudy({
    ...base,
    drivers: [{
      id: driverId,
      name: "Attendance",
      currentState: { status: "unknown", note: "Awaiting survey" },
      impact: 5,
      uncertainty: 5,
      rationale: "Participation is a hard constraint.",
      evidenceIds: [],
      assumptionIds: base.assumptions.map((item) => item.id),
      authorship: "generated"
    }],
    scenarioCoverage: {
      kind: "mutually_exclusive_exhaustive",
      rationale: "Synthetic binary partition used only to test probability validation."
    },
    scenarios,
    evaluations,
    recommendation: { status: "known", value: "Preserve a remote fallback while attendance is unknown." }
  });
}
