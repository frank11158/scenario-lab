import type { Study } from "../domain/schema.js";
import { validateStudy } from "../domain/validation.js";

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stable(item)]));
  }
  return value;
}

export function exportStudyJson(input: unknown): string {
  const study = validateStudy(input);
  return `${JSON.stringify(stable(study), null, 2)}\n`;
}

const display = <T>(value: { status: "known"; value: T } | { status: "unknown"; note?: string | undefined }): string =>
  value.status === "known" ? String(value.value) : `Unknown${value.note ? ` — ${value.note}` : ""}`;

const list = (values: string[]): string => values.length ? values.map((value) => `- ${value}`).join("\n") : "- None recorded";
const cell = (value: string): string => value.replaceAll("|", "\\|").replaceAll("\n", " ");

export function exportStudyMarkdown(input: unknown): string {
  const study: Study = validateStudy(input);
  const scenarioHeaders = study.scenarios.map((scenario) => `S: ${cell(scenario.name)}`);
  const scenarioTable = study.scenarios.length === 0
    ? "_No scenarios recorded._"
    : [
        `| Dimension | ${scenarioHeaders.join(" | ")} |`,
        `|---|${study.scenarios.map(() => "---").join("|")}|`,
        `| Key driver states | ${study.scenarios.map((scenario) => cell(scenario.driverStates.map((state) => state.state).join("; "))).join(" | ")} |`,
        `| Causal mechanism and timeline | ${study.scenarios.map((scenario) => cell(`${scenario.causalMechanism} ${scenario.timeline}`)).join(" | ")} |`,
        `| Disconfirming evidence | ${study.scenarios.map((scenario) => cell(scenario.disconfirmingEvidence.join("; "))).join(" | ")} |`
      ].join("\n");
  const evaluations = new Map(study.evaluations.map((item) => [`${item.strategyId}:${item.scenarioId}`, item]));
  const strategyTable = study.scenarios.length === 0
    ? "_No scenario evaluations recorded._"
    : [
        `| Strategy | ${scenarioHeaders.join(" | ")} | Cost / reversibility |`,
        `|---|${study.scenarios.map(() => "---").join("|")}|---|`,
        ...study.strategies.map((strategy) => `| ${cell(strategy.name)} | ${study.scenarios.map((scenario) => {
          const evaluation = evaluations.get(`${strategy.id}:${scenario.id}`);
          return evaluation ? cell(`${evaluation.rating}: ${evaluation.rationale}`) : "Missing";
        }).join(" | ")} | ${cell(display(strategy.costAndReversibility))} |`)
      ].join("\n");
  const evidenceRows = study.evidence.length
    ? study.evidence.map((item) => `| ${item.id} | ${cell(item.claim)} | ${item.type} | ${item.support.status} | ${cell(display(item.source))} | ${item.citation ? cell(display(item.citation.publishedAt)) : "Unknown"} | ${item.citation?.retrievedAt ?? display(item.retrievedAt)} | ${item.citation?.freshness.status ?? "unknown"} | ${cell(item.citation?.excerpt ?? "No source excerpt recorded")} | ${cell(item.limitations.join("; ") || "None recorded")} |`).join("\n")
    : "| — | None recorded | — | — | — | — | — | — | — | — |";
  const contradictionRows = study.research.contradictions.length
    ? study.research.contradictions.map((item) => `| ${item.leftEvidenceId} ↔ ${item.rightEvidenceId} | ${cell(item.description)} | ${item.status} | ${cell(display(item.resolution))} | ${item.detectedBy} |`).join("\n")
    : "| — | None recorded | — | — | — |";
  const unavailableRows = study.research.unavailableSources.length
    ? study.research.unavailableSources.map((item) => `| ${item.kind} | ${cell(item.locator)} | ${cell(item.reason)} | ${item.checkedAt} |`).join("\n")
    : "| — | None recorded | — | — |";
  const assumptionRows = study.assumptions.length
    ? study.assumptions.map((item) => `| ${item.id} | ${cell(item.statement)} | ${cell(item.basis)} | ${cell(display(item.effectIfWrong))} | ${cell(display(item.test))} |`).join("\n")
    : "| — | None recorded | — | — | — |";

  return `# ${study.title}

Status: ${study.status}${study.synthetic ? " · SYNTHETIC" : ""}
As of: ${study.updatedAt} · Horizon: ${display(study.objective.horizon)} · Decision deadline: ${display(study.objective.decisionDeadline)}

${study.syntheticNotice ? `> ${study.syntheticNotice}\n` : ""}
## Decision brief

${display(study.recommendation)}

## Frame

- Decision and decision-maker: ${study.problem.statement} — ${display(study.problem.decisionMaker)}
- Objective: ${study.objective.statement}
- Success criteria:
${list(study.objective.successCriteria)}
- Options, including status quo:
${list(study.strategies.map((strategy) => `${strategy.name}${strategy.statusQuo ? " (status quo)" : ""}`))}
- Constraints:
${list(study.constraints.map((constraint) => `[${constraint.kind}] ${constraint.statement}`))}
- Controllable choices:
${list(study.problem.controllableChoices)}
- External uncertainties:
${list(study.problem.externalUncertainties)}

## Baseline and evidence

| ID | Claim | Type | Support | Source | Published | Retrieved | Freshness | Source excerpt | Limitations |
|---|---|---|---|---|---|---|---|---|---|
${evidenceRows}

### Evidence review

Last reviewed: ${display(study.research.lastReviewedAt)}

| Potential conflict | Description | Status | Resolution | Detected by |
|---|---|---|---|---|
${contradictionRows}

| Unavailable source kind | Locator | Reason | Checked at |
|---|---|---|---|
${unavailableRows}

### Assumptions

| ID | Assumption | Basis | Effect if wrong | How to test |
|---|---|---|---|---|
${assumptionRows}

### Evidence gaps

${list(study.evidenceGaps)}

## Drivers

${study.drivers.length ? `| Driver | Impact | Uncertainty | Product | Rationale |\n|---|---:|---:|---:|---|\n${study.drivers.map((driver) => `| ${cell(driver.name)} | ${driver.impact} | ${driver.uncertainty} | ${driver.impact * driver.uncertainty} | ${cell(driver.rationale)} |`).join("\n")}` : "_No drivers recorded._"}

## Scenarios

Likelihood: ${study.scenarioCoverage.kind === "exploratory" ? "Unweighted / exploratory" : "Mutually exclusive and exhaustive"}. ${study.scenarioCoverage.rationale}

${scenarioTable}

## Strategy stress test

Criteria:
${list(study.evaluationCriteria)}

${strategyTable}

## Indicators and triggers

${study.indicators.length ? `| Indicator | Source | Threshold and window | Implication | Owner | Cadence |\n|---|---|---|---|---|---|\n${study.indicators.map((indicator) => `| ${cell(indicator.name)} | ${cell(display(indicator.source))} | ${cell(`${indicator.trigger.threshold}; ${indicator.trigger.observationWindow}`)} | ${cell(indicator.implication)} | ${cell(display(indicator.owner))} | ${cell(indicator.reviewCadence)} |`).join("\n")}` : "_No indicators recorded._"}

## Actions

${study.actions.length ? `| Timing | Action | Owner | Due / trigger | Success check |\n|---|---|---|---|---|\n${study.actions.map((action) => `| ${action.timing} | ${cell(action.description)} | ${cell(display(action.owner))} | ${cell(display(action.due))} | ${cell(action.successCheck)} |`).join("\n")}` : "_No actions recorded._"}

## Limits and next review

Unknown values and evidence gaps above remain unresolved. This export preserves schema version ${study.schemaVersion} and study ID ${study.id}.
`;
}
