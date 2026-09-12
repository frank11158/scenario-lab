import { useState } from "react";
import type { Action, Indicator, Study, StudyRevision } from "../../../src/domain/schema";
import type { PipelineRun } from "../../../src/workflow/types";
import { knownText, newId, replaceAt, unknown, valueOf } from "../study-utils";

type Props = {
  study: Study;
  run: PipelineRun | null;
  revisions: StudyRevision[];
  onChange: (study: Study, section: "action" | "indicator" | "evaluation") => void;
  onNavigate: (tab: "evidence" | "compare") => void;
  onAccept: (summary: string) => Promise<void>;
  exportUrl: (format: "json" | "markdown", revisionId?: string) => string;
};

type StrategySynthesis = { robustChoice?: string; conditionalChoices?: string[]; failureConditions?: string[] };
type FinalSynthesis = { strongestChallenge?: string; reversalAssumption?: string };

function stageOutput<T>(run: PipelineRun | null, stage: string): T | null {
  const raw = run?.stages.find((item) => item.stage === stage)?.outputJson;
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}

export function BriefPanel({ study, run, revisions, onChange, onNavigate, onAccept, exportUrl }: Props) {
  const [summary, setSummary] = useState("Reviewed decision brief");
  const strategy = stageOutput<StrategySynthesis>(run, "strategy_evaluation");
  const synthesis = stageOutput<FinalSynthesis>(run, "synthesis");
  const addAction = (timing: Action["timing"] = "now") => onChange({ ...study, actions: [...study.actions, {
    id: newId(), timing, description: "Describe the action", owner: unknown("Unassigned"), due: unknown("Not set"), successCheck: "Define how completion will be checked", triggerIndicatorIds: [], authorship: "user"
  }] }, "action");
  const addIndicator = () => {
    if (!study.actions.length) return addAction("if_triggered");
    onChange({ ...study, indicators: [...study.indicators, {
      id: newId(), name: "New decision signal", source: unknown("Not established"), trigger: { threshold: "Define the switching threshold", observationWindow: "Define the observation window" }, implication: "Explain what this signal means", actionIds: [study.actions[0]!.id], owner: unknown("Unassigned"), reviewCadence: "Monthly", authorship: "user"
    }] }, "indicator");
  };
  const recommendation = study.recommendation.status === "known" ? study.recommendation.value : "No recommendation yet. Generate a draft or write one after comparing strategies.";

  return <div className="panel-stack" data-testid="brief-panel">
    <header className="panel-heading"><div><div className="eyebrow">06 · Decide</div><h2>Decision brief</h2><p>What to do now, what to prepare, and when to change course.</p></div><span className={`run-badge ${run?.status ?? "pending"}`}>{run?.status ?? "manual draft"}</span></header>
    <section className="decision-hero">
      <div className="eyebrow light">Current recommendation</div>
      <textarea value={recommendation} onChange={(event) => onChange({ ...study, recommendation: { status: "known", value: event.target.value } }, "evaluation")} aria-label="Decision recommendation" />
      {run?.status === "stale" && <div className="stale-note">This recommendation depends on stale analysis. Regenerate the affected stages before treating it as current.</div>}
    </section>

    <div className="brief-grid">
      <section className="card robustness-card"><div className="mini-label">Robustness check</div><h3>{strategy?.robustChoice ?? "Complete the strategy matrix to identify the robust choice."}</h3><div className="brief-detail"><b>Conditional choices</b>{strategy?.conditionalChoices?.map((item) => <p key={item}>{item}</p>) ?? <p>None generated yet.</p>}</div><div className="brief-detail"><b>Failure conditions</b>{strategy?.failureConditions?.map((item) => <p key={item}>{item}</p>) ?? <p>None generated yet.</p>}</div></section>
      <section className="card challenge-card"><div className="mini-label">Challenge the recommendation</div><h3>{synthesis?.strongestChallenge ?? "What is the strongest argument against this choice?"}</h3><p>{synthesis?.reversalAssumption ?? "Identify the assumption and switching point that would reverse it."}</p><div className="trace-links"><button onClick={() => onNavigate("evidence")}><b>{study.assumptions.length}</b> assumptions</button><span>→</span><button onClick={() => onNavigate("compare")}><b>{study.evaluations.length}</b> evaluations</button><span>→</span><div><b>1</b> recommendation</div></div></section>
    </div>

    <section className="card">
      <div className="section-title"><div><h3>Actions</h3><p>Separate immediate moves, preparations, and triggered pivots.</p></div><div className="button-row"><button className="button compact" onClick={() => addAction("now")}>+ Now</button><button className="button compact" onClick={() => addAction("prepare")}>+ Prepare</button><button className="button compact" onClick={() => addAction("if_triggered")}>+ Pivot</button></div></div>
      <div className="action-list">{study.actions.map((action, index) => {
        const update = (patch: Partial<Action>) => onChange({ ...study, actions: replaceAt(study.actions, index, { ...action, ...patch, authorship: "user" }) }, "action");
        return <article className={`action-row ${action.timing}`} key={action.id}><select value={action.timing} onChange={(event) => update({ timing: event.target.value as Action["timing"] })}><option value="now">Now</option><option value="prepare">Prepare</option><option value="if_triggered">If triggered</option></select><div><input className="title-input" value={action.description} onChange={(event) => update({ description: event.target.value })} /><div className="action-meta"><input value={valueOf(action.owner)} onChange={(event) => update({ owner: knownText(event.target.value) })} placeholder="Owner unassigned" /><input value={valueOf(action.due)} onChange={(event) => update({ due: knownText(event.target.value) })} placeholder="Due / trigger" /><input value={action.successCheck} onChange={(event) => update({ successCheck: event.target.value })} placeholder="Success check" /></div></div><button className="icon-button" onClick={() => onChange({ ...study, actions: study.actions.filter((_, i) => i !== index), indicators: study.indicators.map((indicator) => ({ ...indicator, actionIds: indicator.actionIds.filter((id) => id !== action.id) })).filter((indicator) => indicator.actionIds.length) }, "action")}>×</button></article>;
      })}{!study.actions.length && <p className="empty">No actions recorded.</p>}</div>
    </section>

    <section className="card">
      <div className="section-title"><div><h3>Indicators, triggers & next review</h3><p>Every signal needs a threshold, observation window, action, and cadence.</p></div><button className="button compact" onClick={addIndicator}>+ Add indicator</button></div>
      <div className="indicator-grid">{study.indicators.map((indicator, index) => {
        const update = (patch: Partial<Indicator>) => onChange({ ...study, indicators: replaceAt(study.indicators, index, { ...indicator, ...patch, authorship: "user" }) }, "indicator");
        return <article className="indicator-card" key={indicator.id}><div className="signal-dot"></div><input className="title-input" value={indicator.name} onChange={(event) => update({ name: event.target.value })} /><label className="field">Threshold<input value={indicator.trigger.threshold} onChange={(event) => update({ trigger: { ...indicator.trigger, threshold: event.target.value } })} /></label><label className="field">Observation window<input value={indicator.trigger.observationWindow} onChange={(event) => update({ trigger: { ...indicator.trigger, observationWindow: event.target.value } })} /></label><label className="field">Source<input value={valueOf(indicator.source)} onChange={(event) => update({ source: knownText(event.target.value) })} placeholder="Unknown" /></label><label className="field">Review cadence<input value={indicator.reviewCadence} onChange={(event) => update({ reviewCadence: event.target.value })} /></label><label className="field span-2">Action<select value={indicator.actionIds[0] ?? ""} onChange={(event) => update({ actionIds: [event.target.value] })}>{study.actions.map((action) => <option key={action.id} value={action.id}>{action.description}</option>)}</select></label><button className="text-button danger" onClick={() => onChange({ ...study, indicators: study.indicators.filter((_, i) => i !== index), actions: study.actions.map((action) => ({ ...action, triggerIndicatorIds: action.triggerIndicatorIds.filter((id) => id !== indicator.id) })) }, "indicator")}>Remove indicator</button></article>;
      })}{!study.indicators.length && <div className="empty-state"><b>No monitoring plan yet</b><span>Add the signal that would make you reconsider.</span></div>}</div>
    </section>

    <section className="card gap-summary"><div><div className="mini-label">Unresolved evidence</div><h3>{study.evidenceGaps.length} gap{study.evidenceGaps.length === 1 ? "" : "s"} remain</h3><ul>{study.evidenceGaps.map((gap) => <li key={gap}>{gap}</li>)}</ul></div><button className="button secondary" onClick={() => onNavigate("evidence")}>Review evidence</button></section>

    <section className="card history-card">
      <div className="section-title"><div><h3>Save a reviewed revision</h3><p>Accepted snapshots remain immutable and exportable.</p></div><div className="export-links"><a className="button secondary compact" href={exportUrl("markdown")}>Export Markdown</a><a className="button secondary compact" href={exportUrl("json")}>Export JSON</a></div></div>
      <div className="revision-form"><input value={summary} onChange={(event) => setSummary(event.target.value)} aria-label="Revision summary" /><button className="button primary" onClick={() => onAccept(summary)}>Accept revision</button></div>
      <div className="timeline">{revisions.map((revision) => <div className="timeline-row" key={revision.id}><span>{revision.ordinal}</span><div><b>{revision.summary}</b><small>{new Date(revision.acceptedAt).toLocaleString()}</small></div><div className="export-links"><a href={exportUrl("markdown", revision.id)}>MD</a><a href={exportUrl("json", revision.id)}>JSON</a></div></div>)}{!revisions.length && <p className="empty">No accepted revisions yet.</p>}</div>
    </section>
  </div>;
}
