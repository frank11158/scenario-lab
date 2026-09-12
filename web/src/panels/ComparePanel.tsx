import type { Evaluation, Study } from "../../../src/domain/schema";
import { lines, newId } from "../study-utils";

type Props = { study: Study; onChange: (study: Study, section: "evaluation") => void };

export function ComparePanel({ study, onChange }: Props) {
  const setCriteria = (value: string) => onChange({ ...study, evaluationCriteria: lines(value) }, "evaluation");
  const updateEvaluation = (strategyId: string, scenarioId: string, patch: Partial<Evaluation>) => {
    const index = study.evaluations.findIndex((item) => item.strategyId === strategyId && item.scenarioId === scenarioId);
    const existing: Evaluation = index >= 0 ? study.evaluations[index]! : {
      id: newId(), strategyId, scenarioId, rating: "adequate", rationale: "Explain how this option performs in this future.", criterionResults: [{ criterion: study.evaluationCriteria[0] ?? study.objective.successCriteria[0]!, outcome: "Describe the outcome." }], violatedConstraintIds: [], authorship: "user"
    };
    const next = { ...existing, ...patch, authorship: "user" as const };
    onChange({ ...study, evaluations: index >= 0 ? study.evaluations.map((item, itemIndex) => itemIndex === index ? next : item) : [...study.evaluations, next] }, "evaluation");
  };
  const expected = study.strategies.filter((item) => item.feasible).length * study.scenarios.length;
  const covered = study.evaluations.filter((item) => study.strategies.find((strategy) => strategy.id === item.strategyId)?.feasible).length;

  return <div className="panel-stack" data-testid="compare-panel">
    <header className="panel-heading"><div><div className="eyebrow">05 · Stress-test</div><h2>Strategy × scenario</h2><p>Weak = fails a criterion; adequate = works with tradeoffs; strong = meets criteria with useful flexibility.</p></div><span className={`coverage-chip ${covered === expected && expected > 0 ? "complete" : ""}`}>{covered}/{expected} assessed</span></header>
    <section className="card criteria-card"><label className="field">Success criteria <span>one per line</span><textarea value={study.evaluationCriteria.join("\n")} onChange={(event) => setCriteria(event.target.value)} /></label><div className="hard-constraint-list"><div className="mini-label">Hard constraints</div>{study.constraints.filter((item) => item.kind === "hard").map((item) => <span key={item.id}>◆ {item.statement}</span>)}{!study.constraints.some((item) => item.kind === "hard") && <span>None recorded</span>}</div></section>
    {study.scenarios.length && study.strategies.length ? <div className="matrix-wrap"><table className="matrix"><thead><tr><th>Strategy</th>{study.scenarios.map((scenario, index) => <th key={scenario.id}><span>S{index + 1}</span>{scenario.name}</th>)}</tr></thead><tbody>{study.strategies.map((strategy) => <tr key={strategy.id}><th><b>{strategy.name}</b>{strategy.statusQuo && <em>Status quo</em>}{!strategy.feasible && <em>Infeasible</em>}</th>{study.scenarios.map((scenario) => {
      const evaluation = study.evaluations.find((item) => item.strategyId === strategy.id && item.scenarioId === scenario.id);
      if (!strategy.feasible) return <td key={scenario.id} className="na-cell">Not evaluated</td>;
      return <td key={scenario.id} className={`matrix-cell ${evaluation?.rating ?? "missing"}`}>
        <select aria-label={`${strategy.name} in ${scenario.name} rating`} value={evaluation?.rating ?? ""} onChange={(event) => updateEvaluation(strategy.id, scenario.id, { rating: event.target.value as Evaluation["rating"] })}><option value="" disabled>Not assessed</option><option value="weak">Weak</option><option value="adequate">Adequate</option><option value="strong">Strong</option><option value="not_applicable">N/A</option></select>
        <textarea aria-label={`${strategy.name} in ${scenario.name} rationale`} value={evaluation?.rationale ?? ""} onChange={(event) => updateEvaluation(strategy.id, scenario.id, { rationale: event.target.value })} placeholder="Explain the outcome and tradeoff" />
        <details><summary>Constraint checks</summary>{study.constraints.filter((item) => item.kind === "hard").map((constraint) => <label key={constraint.id}><input type="checkbox" checked={evaluation?.violatedConstraintIds.includes(constraint.id) ?? false} onChange={(event) => updateEvaluation(strategy.id, scenario.id, { violatedConstraintIds: event.target.checked ? [...(evaluation?.violatedConstraintIds ?? []), constraint.id] : (evaluation?.violatedConstraintIds ?? []).filter((id) => id !== constraint.id) })} /> Violates: {constraint.statement}</label>)}</details>
      </td>;
    })}</tr>)}</tbody></table></div> : <div className="empty-state card"><b>The matrix needs options and scenarios</b><span>Complete the frame and plausible futures first.</span></div>}
  </div>;
}
