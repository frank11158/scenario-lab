import type { Consequence, Scenario, Study } from "../../../src/domain/schema";
import { lines, newId, replaceAt } from "../study-utils";

type Props = { study: Study; onChange: (study: Study, section: "scenario" | "consequence") => void; onMessage: (message: string) => void };

export function ScenariosPanel({ study, onChange, onMessage }: Props) {
  const addScenario = () => {
    if (!study.drivers.length) return onMessage("Add at least one driver before creating a scenario.");
    const scenario: Scenario = {
      id: newId(), name: `Scenario ${study.scenarios.length + 1}`, driverStates: [{ driverId: study.drivers[0]!.id, state: "Describe this driver state" }], causalMechanism: "Describe how this future unfolds.", timeline: "Describe the sequence over the decision horizon.", disconfirmingEvidence: ["What observation would contradict this future?"], evidenceConfidence: "low", assumptionIds: [], authorship: "user"
    };
    onChange({ ...study, scenarios: [...study.scenarios, scenario] }, "scenario");
  };
  const addConsequence = (scenarioId: string, kind: Consequence["kind"]) => onChange({
    ...study,
    consequences: [...study.consequences, { id: newId(), scenarioId, kind, statement: `Describe the ${kind.replace("_", "-")} effect.`, driverIds: [], assumptionIds: [], evidenceIds: [], authorship: "user" }]
  }, "consequence");

  return <div className="panel-stack" data-testid="scenarios-panel">
    <header className="panel-heading"><div><div className="eyebrow">04 · Explore</div><h2>Plausible futures</h2><p>Compare mechanisms and consequences—not optimistic, base, and pessimistic labels.</p></div><button className="button primary compact" onClick={addScenario}>+ Add scenario</button></header>
    <div className="scenario-grid">
      {study.scenarios.map((scenario, index) => {
        const update = (patch: Partial<Scenario>) => onChange({ ...study, scenarios: replaceAt(study.scenarios, index, { ...scenario, ...patch, authorship: "user" }) }, "scenario");
        const consequences = study.consequences.filter((item) => item.scenarioId === scenario.id);
        return <article className="scenario-card" key={scenario.id}>
          <div className="scenario-top"><span className="scenario-number">S{index + 1}</span><select value={scenario.evidenceConfidence} onChange={(event) => update({ evidenceConfidence: event.target.value as Scenario["evidenceConfidence"] })} aria-label="Evidence confidence"><option value="low">Low confidence</option><option value="medium">Medium confidence</option><option value="high">High confidence</option></select><button className="icon-button" onClick={() => onChange({ ...study, scenarios: study.scenarios.filter((_, i) => i !== index), consequences: study.consequences.filter((item) => item.scenarioId !== scenario.id), evaluations: study.evaluations.filter((item) => item.scenarioId !== scenario.id) }, "scenario")}>×</button></div>
          <input className="scenario-name" value={scenario.name} onChange={(event) => update({ name: event.target.value })} aria-label="Scenario name" />
          <div className="mini-label">Driver states</div>
          {scenario.driverStates.map((state, stateIndex) => <div className="driver-state" key={`${state.driverId}-${stateIndex}`}><select value={state.driverId} onChange={(event) => update({ driverStates: replaceAt(scenario.driverStates, stateIndex, { ...state, driverId: event.target.value }) })}>{study.drivers.map((driver) => <option value={driver.id} key={driver.id}>{driver.name}</option>)}</select><input value={state.state} onChange={(event) => update({ driverStates: replaceAt(scenario.driverStates, stateIndex, { ...state, state: event.target.value }) })} /></div>)}
          <label className="field">Causal mechanism<textarea value={scenario.causalMechanism} onChange={(event) => update({ causalMechanism: event.target.value })} /></label>
          <label className="field">Timeline<textarea value={scenario.timeline} onChange={(event) => update({ timeline: event.target.value })} /></label>
          <label className="field">Disconfirming evidence <span>one per line</span><textarea value={scenario.disconfirmingEvidence.join("\n")} onChange={(event) => update({ disconfirmingEvidence: lines(event.target.value) })} /></label>
          <div className="consequence-head"><span>Consequences</span><div><button className="text-button" onClick={() => addConsequence(scenario.id, "direct")}>+ Direct</button><button className="text-button" onClick={() => addConsequence(scenario.id, "second_order")}>+ 2nd order</button></div></div>
          <div className="consequence-list">
            {consequences.map((consequence) => {
              const consequenceIndex = study.consequences.findIndex((item) => item.id === consequence.id);
              const updateConsequence = (patch: Partial<Consequence>) => onChange({ ...study, consequences: replaceAt(study.consequences, consequenceIndex, { ...consequence, ...patch, authorship: "user" }) }, "consequence");
              return <div className={`consequence ${consequence.kind}`} key={consequence.id}><select value={consequence.kind} onChange={(event) => updateConsequence({ kind: event.target.value as Consequence["kind"] })}><option value="direct">Direct</option><option value="second_order">Second order</option><option value="opportunity">Opportunity</option><option value="threat">Threat</option></select><textarea value={consequence.statement} onChange={(event) => updateConsequence({ statement: event.target.value })} /><button className="icon-button" onClick={() => onChange({ ...study, consequences: study.consequences.filter((item) => item.id !== consequence.id) }, "consequence")}>×</button></div>;
            })}
          </div>
        </article>;
      })}
      {!study.scenarios.length && <div className="empty-state wide"><b>No scenarios yet</b><span>Generate a draft or add 3–4 causally distinct futures.</span></div>}
    </div>
  </div>;
}
