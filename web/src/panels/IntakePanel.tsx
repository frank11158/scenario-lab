import type { Study, Strategy } from "../../../src/domain/schema";
import { knownText, lines, newId, replaceAt, unknown, valueOf } from "../study-utils";

type Props = { study: Study; onChange: (study: Study, section: "problem" | "objective" | "constraint" | "strategy") => void };

export function IntakePanel({ study, onChange }: Props) {
  const changeProblem = (patch: Partial<Study["problem"]>) => onChange({ ...study, problem: { ...study.problem, ...patch, authorship: "user" } }, "problem");
  const changeObjective = (patch: Partial<Study["objective"]>) => onChange({ ...study, objective: { ...study.objective, ...patch, authorship: "user" } }, "objective");
  const addConstraint = () => onChange({
    ...study,
    constraints: [...study.constraints, { id: newId(), kind: "preference", statement: "Describe the constraint", sourceEvidenceIds: [], authorship: "user" }]
  }, "constraint");
  const addStrategy = () => onChange({
    ...study,
    strategies: [...study.strategies, { id: newId(), name: "New option", description: "Describe this option", statusQuo: false, feasible: true, costAndReversibility: unknown("Not evaluated"), authorship: "user" }]
  }, "strategy");

  return <div className="panel-stack" data-testid="intake-panel">
    <header className="panel-heading"><div><div className="eyebrow">01 · Frame</div><h2>Decision frame</h2></div><span className="quiet-chip">{study.mode} study</span></header>
    <section className="card form-grid">
      <label className="field span-2">Decision<textarea value={study.problem.statement} onChange={(event) => changeProblem({ statement: event.target.value })} /></label>
      <label className="field">Decision-maker<input value={valueOf(study.problem.decisionMaker)} onChange={(event) => changeProblem({ decisionMaker: knownText(event.target.value) })} placeholder="Unknown is allowed" /></label>
      <label className="field">Affected parties<input value={study.problem.affectedParties.join(", ")} onChange={(event) => changeProblem({ affectedParties: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} /></label>
      <label className="field span-2">Objective<textarea value={study.objective.statement} onChange={(event) => changeObjective({ statement: event.target.value })} /></label>
      <label className="field">Horizon<input value={valueOf(study.objective.horizon)} onChange={(event) => changeObjective({ horizon: knownText(event.target.value) })} placeholder="Unknown" /></label>
      <label className="field">Decision deadline<input value={valueOf(study.objective.decisionDeadline)} onChange={(event) => changeObjective({ decisionDeadline: knownText(event.target.value) })} placeholder="Unknown" /></label>
      <label className="field span-2">Success criteria <span>one per line</span><textarea value={study.objective.successCriteria.join("\n")} onChange={(event) => changeObjective({ successCriteria: lines(event.target.value) })} /></label>
      <label className="field">Controllable choices <span>one per line</span><textarea value={study.problem.controllableChoices.join("\n")} onChange={(event) => changeProblem({ controllableChoices: lines(event.target.value) })} /></label>
      <label className="field">External uncertainties <span>one per line</span><textarea value={study.problem.externalUncertainties.join("\n")} onChange={(event) => changeProblem({ externalUncertainties: lines(event.target.value) })} /></label>
    </section>

    <section className="card">
      <div className="section-title"><div><h3>Constraints</h3><p>Hard constraints are pass/fail. Preferences inform tradeoffs.</p></div><button className="button compact" onClick={addConstraint}>+ Add constraint</button></div>
      <div className="row-list">
        {study.constraints.map((constraint, index) => <div className="editable-row" key={constraint.id}>
          <select aria-label="Constraint type" value={constraint.kind} onChange={(event) => onChange({ ...study, constraints: replaceAt(study.constraints, index, { ...constraint, kind: event.target.value as "hard" | "preference", authorship: "user" }) }, "constraint")}><option value="hard">Hard</option><option value="preference">Preference</option></select>
          <input aria-label="Constraint" value={constraint.statement} onChange={(event) => onChange({ ...study, constraints: replaceAt(study.constraints, index, { ...constraint, statement: event.target.value, authorship: "user" }) }, "constraint")} />
          <button className="icon-button" aria-label="Remove constraint" onClick={() => onChange({ ...study, constraints: study.constraints.filter((_, i) => i !== index) }, "constraint")}>×</button>
        </div>)}
        {!study.constraints.length && <p className="empty">No constraints recorded yet.</p>}
      </div>
    </section>

    <section className="card">
      <div className="section-title"><div><h3>Options</h3><p>The status quo remains visible in every comparison.</p></div><button className="button compact" onClick={addStrategy}>+ Add option</button></div>
      <div className="option-grid">
        {study.strategies.map((strategy, index) => {
          const update = (patch: Partial<Strategy>) => onChange({ ...study, strategies: replaceAt(study.strategies, index, { ...strategy, ...patch, authorship: "user" }) }, "strategy");
          return <article className={`option-card ${strategy.statusQuo ? "status-quo" : ""}`} key={strategy.id}>
            <div className="option-flags"><label><input type="checkbox" checked={strategy.statusQuo} onChange={(event) => update({ statusQuo: event.target.checked })} /> Status quo</label><label><input type="checkbox" checked={strategy.feasible} onChange={(event) => update({ feasible: event.target.checked })} /> Feasible</label></div>
            <input className="title-input" value={strategy.name} onChange={(event) => update({ name: event.target.value })} aria-label="Option name" />
            <textarea value={strategy.description} onChange={(event) => update({ description: event.target.value })} aria-label="Option description" />
            <input value={valueOf(strategy.costAndReversibility)} onChange={(event) => update({ costAndReversibility: knownText(event.target.value) })} placeholder="Cost and reversibility unknown" aria-label="Cost and reversibility" />
            {!strategy.statusQuo && <button className="text-button danger" onClick={() => onChange({ ...study, strategies: study.strategies.filter((_, i) => i !== index) }, "strategy")}>Remove</button>}
          </article>;
        })}
      </div>
    </section>
  </div>;
}
