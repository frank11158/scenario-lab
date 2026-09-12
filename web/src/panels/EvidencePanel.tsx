import type { Assumption, Evidence, Study } from "../../../src/domain/schema";
import { knownText, newId, replaceAt, unknown, valueOf } from "../study-utils";

type Props = { study: Study; onChange: (study: Study, section: "evidence" | "assumption") => void };

export function EvidencePanel({ study, onChange }: Props) {
  const addEvidence = () => onChange({ ...study, evidence: [...study.evidence, {
    id: newId(), claim: "Describe the claim", type: "user_claim", source: unknown("No source supplied"), observedAt: unknown("Unknown"), retrievedAt: unknown("Not retrieved"), limitations: [], authorship: "user"
  }] }, "evidence");
  const addAssumption = () => onChange({ ...study, assumptions: [...study.assumptions, {
    id: newId(), statement: "Describe the assumption", basis: "User judgment", plausibleAlternatives: [], effectIfWrong: unknown("Not assessed"), test: unknown("Not defined"), evidenceIds: [], authorship: "user"
  }] }, "assumption");
  return <div className="panel-stack" data-testid="evidence-panel">
    <header className="panel-heading"><div><div className="eyebrow">02 · Ground</div><h2>Evidence & assumptions</h2></div><span className="quiet-chip">{study.evidenceGaps.length} open gaps</span></header>
    <section className="card">
      <div className="section-title"><div><h3>Evidence register</h3><p>Keep sourced facts, user claims, and inference distinct.</p></div><button className="button compact" onClick={addEvidence}>+ Add evidence</button></div>
      <div className="evidence-list">
        {study.evidence.map((evidence, index) => {
          const update = (patch: Partial<Evidence>) => onChange({ ...study, evidence: replaceAt(study.evidence, index, { ...evidence, ...patch, authorship: "user" }) }, "evidence");
          return <article className="evidence-card" key={evidence.id}>
            <div className="evidence-meta"><span className="id-chip">E · {evidence.id.slice(0, 6)}</span><select value={evidence.type} onChange={(event) => update({ type: event.target.value as Evidence["type"] })}><option value="sourced_fact">Sourced fact</option><option value="user_claim">User claim</option><option value="inference">Inference</option></select><button className="icon-button" onClick={() => onChange({ ...study, evidence: study.evidence.filter((_, i) => i !== index) }, "evidence")}>×</button></div>
            <textarea className="plain-textarea" value={evidence.claim} onChange={(event) => update({ claim: event.target.value })} aria-label="Evidence claim" />
            <input value={valueOf(evidence.source)} onChange={(event) => update({ source: knownText(event.target.value) })} placeholder="Source URL, file, or observation — unknown allowed" aria-label="Evidence source" />
          </article>;
        })}
        {!study.evidence.length && <div className="empty-state"><b>No evidence records yet</b><span>Add what you know, or leave the gap explicit.</span></div>}
      </div>
    </section>
    <section className="card">
      <div className="section-title"><div><h3>Assumptions</h3><p>State what could be wrong and what would test it.</p></div><button className="button compact" onClick={addAssumption}>+ Add assumption</button></div>
      <div className="assumption-list">
        {study.assumptions.map((assumption, index) => {
          const update = (patch: Partial<Assumption>) => onChange({ ...study, assumptions: replaceAt(study.assumptions, index, { ...assumption, ...patch, authorship: "user" }) }, "assumption");
          return <article className="assumption-card" key={assumption.id}>
            <div className="number-mark">A{index + 1}</div><div className="assumption-fields">
              <input className="title-input" value={assumption.statement} onChange={(event) => update({ statement: event.target.value })} aria-label="Assumption" />
              <div className="two-fields"><label className="field">Basis<input value={assumption.basis} onChange={(event) => update({ basis: event.target.value })} /></label><label className="field">How to test<input value={valueOf(assumption.test)} onChange={(event) => update({ test: knownText(event.target.value) })} placeholder="Unknown" /></label></div>
            </div><button className="icon-button" onClick={() => onChange({ ...study, assumptions: study.assumptions.filter((_, i) => i !== index) }, "assumption")}>×</button>
          </article>;
        })}
      </div>
    </section>
    <section className="card gap-card"><div><h3>Evidence gaps</h3><p>One gap per line. These remain visible in the decision brief.</p></div><textarea value={study.evidenceGaps.join("\n")} onChange={(event) => onChange({ ...study, evidenceGaps: event.target.value.split("\n").map((item) => item.trim()).filter(Boolean) }, "evidence")} /></section>
  </div>;
}
