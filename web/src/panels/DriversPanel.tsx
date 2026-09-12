import type { Driver, Study } from "../../../src/domain/schema";
import { knownText, newId, replaceAt, unknown, valueOf } from "../study-utils";

type Props = { study: Study; onChange: (study: Study, section: "driver") => void };

export function DriversPanel({ study, onChange }: Props) {
  const add = () => onChange({ ...study, drivers: [...study.drivers, {
    id: newId(), name: "New driver", currentState: unknown("Not established"), impact: 3, uncertainty: 3, rationale: "Explain why this driver matters.", evidenceIds: [], assumptionIds: [], authorship: "user"
  }] }, "driver");
  return <div className="panel-stack" data-testid="drivers-panel">
    <header className="panel-heading"><div><div className="eyebrow">03 · Prioritize</div><h2>Decision drivers</h2><p>Impact × uncertainty is an ordinal discussion aid, never a probability.</p></div><button className="button primary compact" onClick={add}>+ Add driver</button></header>
    <section className="driver-table card">
      <div className="driver-head"><span>Driver & current state</span><span>Impact</span><span>Uncertainty</span><span>Priority</span><span>Rationale</span><span></span></div>
      {study.drivers.map((driver, index) => {
        const update = (patch: Partial<Driver>) => onChange({ ...study, drivers: replaceAt(study.drivers, index, { ...driver, ...patch, authorship: "user" }) }, "driver");
        return <div className="driver-row" key={driver.id}>
          <div><input className="title-input" value={driver.name} onChange={(event) => update({ name: event.target.value })} /><input value={valueOf(driver.currentState)} onChange={(event) => update({ currentState: knownText(event.target.value) })} placeholder="Current state unknown" /></div>
          <select value={driver.impact} onChange={(event) => update({ impact: Number(event.target.value) })}>{[1,2,3,4,5].map((value) => <option key={value}>{value}</option>)}</select>
          <select value={driver.uncertainty} onChange={(event) => update({ uncertainty: Number(event.target.value) })}>{[1,2,3,4,5].map((value) => <option key={value}>{value}</option>)}</select>
          <b className="priority-score">{driver.impact * driver.uncertainty}</b>
          <textarea value={driver.rationale} onChange={(event) => update({ rationale: event.target.value })} />
          <button className="icon-button" onClick={() => onChange({ ...study, drivers: study.drivers.filter((_, i) => i !== index) }, "driver")}>×</button>
        </div>;
      })}
      {!study.drivers.length && <div className="empty-state"><b>No drivers yet</b><span>Generate a draft or add the factors that could change the choice.</span></div>}
    </section>
  </div>;
}
