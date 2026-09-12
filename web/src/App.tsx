import { useEffect, useMemo, useState } from "react";
import type { Study, StudyRevision } from "../../src/domain/schema";
import type { StudySummary } from "../../src/persistence/repository";
import { STAGE_ORDER, type PipelineRun } from "../../src/workflow/types";
import type { StudyChange } from "../../src/workflow/dependencies";
import type { ResearchPreview, ResearchSourceInput } from "../../src/research/types";
import { CHANGE_INVALIDATES_FROM } from "../../src/workflow/dependencies";
import { api, ApiError, type ReferenceCase, type ResearchCapabilities } from "./api";
import { NewStudyDialog } from "./components/NewStudyDialog";
import { BriefPanel } from "./panels/BriefPanel";
import { ComparePanel } from "./panels/ComparePanel";
import { DriversPanel } from "./panels/DriversPanel";
import { EvidencePanel } from "./panels/EvidencePanel";
import { IntakePanel } from "./panels/IntakePanel";
import { ScenariosPanel } from "./panels/ScenariosPanel";

type Tab = "intake" | "evidence" | "drivers" | "scenarios" | "compare" | "brief";

const TABS: Array<{ id: Tab; label: string; number: string }> = [
  { id: "intake", label: "Frame", number: "01" },
  { id: "evidence", label: "Evidence", number: "02" },
  { id: "drivers", label: "Drivers", number: "03" },
  { id: "scenarios", label: "Scenarios", number: "04" },
  { id: "compare", label: "Compare", number: "05" },
  { id: "brief", label: "Decision", number: "06" }
];

const errorMessage = (error: unknown) => {
  if (error instanceof ApiError && error.issues.length) return `${error.message}: ${error.issues.slice(0, 3).map((item) => `${item.path} ${item.message}`).join("; ")}`;
  return error instanceof Error ? error.message : "Something went wrong";
};

export function App() {
  const [studies, setStudies] = useState<StudySummary[]>([]);
  const [referenceCases, setReferenceCases] = useState<ReferenceCase[]>([]);
  const [study, setStudy] = useState<Study | null>(null);
  const [run, setRun] = useState<PipelineRun | null>(null);
  const [revisions, setRevisions] = useState<StudyRevision[]>([]);
  const [tab, setTab] = useState<Tab>("intake");
  const [dirty, setDirty] = useState<StudyChange[]>([]);
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [modelConfigured, setModelConfigured] = useState(false);
  const [researchCapabilities, setResearchCapabilities] = useState<ResearchCapabilities>({ webHosts: [], documentRoot: null, documentExtensions: [".md", ".txt"] });
  const [newStudyOpen, setNewStudyOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [scenarioCount, setScenarioCount] = useState(3);

  const refreshList = async () => setStudies((await api.listStudies()).studies);
  const openStudy = async (id: string) => {
    setBusy(true);
    setMessage(null);
    try {
      const [studyResult, runsResult, revisionsResult] = await Promise.all([api.getStudy(id), api.listRuns(id), api.listRevisions(id)]);
      setStudy(studyResult.study);
      setRun(runsResult.runs.at(-1) ?? null);
      setRevisions(revisionsResult.revisions);
      setDirty([]);
      setTab("intake");
    } catch (error) { setMessage(errorMessage(error)); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    Promise.all([api.health(), api.listStudies(), api.listReferenceCases()])
      .then(([health, studyResult, cases]) => {
        setModelConfigured(health.modelConfigured);
        setResearchCapabilities(health.research);
        setStudies(studyResult.studies);
        setReferenceCases(cases.cases);
        if (studyResult.studies[0]) void openStudy(studyResult.studies[0].id);
      })
      .catch((error) => setMessage(errorMessage(error)));
  }, []);

  useEffect(() => {
    const prevent = (event: BeforeUnloadEvent) => {
      if (dirty.length) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty]);

  const changeStudy = (next: Study, section: StudyChange) => {
    setStudy(next);
    setDirty((current) => current.includes(section) ? current : [...current, section]);
  };

  const persist = async (): Promise<{ study: Study; run: PipelineRun | null } | null> => {
    if (!study) return null;
    if (!dirty.length) return { study, run };
    setBusy(true);
    try {
      const saved = await api.saveStudy(study, dirty);
      setStudy(saved.study);
      setRun(saved.run);
      setDirty([]);
      await refreshList();
      setMessage("Saved. Affected downstream analysis is marked stale.");
      return saved;
    } catch (error) {
      setMessage(errorMessage(error));
      return null;
    } finally { setBusy(false); }
  };

  const generate = async () => {
    if (!study || generating) return;
    setGenerating(true);
    setMessage(null);
    try {
      const saved = await persist();
      if (!saved) return;
      let target = saved.run;
      if (!target || target.status === "completed") target = (await api.createRun(study.id, { scenarioCount, maxRetries: 2 })).run;
      setRun({ ...target, status: "running" });
      const result = (await api.executeRun(target.id)).run;
      setRun(result);
      setStudy((await api.getStudy(study.id)).study);
      if (result.status === "failed") {
        const failed = result.stages.find((stage) => stage.status === "failed");
        setMessage(failed?.error?.message ?? "Generation failed. Your study remains editable and exportable.");
      } else if (result.status === "cancelled") setMessage("Generation cancelled. Completed checkpoints were preserved.");
      else setMessage("Draft generated. Review every section before accepting a revision.");
      await refreshList();
    } catch (error) { setMessage(errorMessage(error)); }
    finally { setGenerating(false); }
  };

  const cancel = async () => {
    if (!run) return;
    try { setRun((await api.cancelRun(run.id)).run); }
    catch (error) { setMessage(errorMessage(error)); }
  };

  const accept = async (summary: string) => {
    if (!study) return;
    const saved = await persist();
    if (!saved) return;
    setBusy(true);
    try {
      const accepted = await api.acceptRevision(study.id, summary);
      setStudy(accepted.snapshot);
      setRevisions((await api.listRevisions(study.id)).revisions);
      setMessage("Revision accepted and preserved in history.");
      await refreshList();
    } catch (error) { setMessage(errorMessage(error)); }
    finally { setBusy(false); }
  };

  const create = async (input: Parameters<typeof api.createStudy>[0]) => {
    setBusy(true);
    try {
      const created = (await api.createStudy(input)).study;
      setNewStudyOpen(false);
      await refreshList();
      await openStudy(created.id);
    } catch (error) { setMessage(errorMessage(error)); }
    finally { setBusy(false); }
  };

  const importCase = async (file: string) => {
    setBusy(true);
    try {
      const imported = (await api.importReferenceCase(file)).study;
      await refreshList();
      await openStudy(imported.id);
      setMessage("Synthetic reference case imported. Validate every assumption before real use.");
    } catch (error) { setMessage(errorMessage(error)); }
    finally { setBusy(false); }
  };

  const previewNewResearch = async (input: ResearchSourceInput): Promise<ResearchPreview | null> => {
    if (!study) return null;
    const saved = await persist();
    if (!saved) return null;
    try {
      const result = await api.previewResearch(study.id, input);
      setMessage(result.preview.entries.some((entry) => entry.status === "unavailable") ? "Preview completed with an unavailable source. Review before recording it." : "Source retrieved. Review the excerpt and support assessment before applying.");
      return result.preview;
    } catch (error) { setMessage(errorMessage(error)); return null; }
  };

  const previewResearchRefresh = async (evidenceIds: string[], maxAgeDays: number): Promise<ResearchPreview | null> => {
    if (!study) return null;
    const saved = await persist();
    if (!saved) return null;
    try {
      const result = await api.previewResearchRefresh(study.id, { evidenceIds, maxAgeDays });
      setMessage("Refresh preview ready. No study data has changed yet.");
      return result.preview;
    } catch (error) { setMessage(errorMessage(error)); return null; }
  };

  const applyResearch = async (preview: ResearchPreview): Promise<void> => {
    if (!study) return;
    if (dirty.length) {
      setMessage("The study changed after the research preview. Save and create a fresh preview before applying.");
      return;
    }
    setBusy(true);
    try {
      const applied = await api.applyResearch(study.id, preview, `Reviewed ${preview.entries.length} evidence source${preview.entries.length === 1 ? "" : "s"}`);
      setStudy(applied.snapshot);
      setRun(applied.run);
      setRevisions((await api.listRevisions(study.id)).revisions);
      setMessage("Evidence update applied as an immutable reviewed revision. Downstream analysis is stale until regenerated.");
      await refreshList();
    } catch (error) { setMessage(errorMessage(error)); }
    finally { setBusy(false); }
  };

  const progress = useMemo(() => study ? [
    Boolean(study.problem.statement && study.objective.statement),
    Boolean(study.assumptions.length || study.evidence.length),
    Boolean(study.drivers.length),
    Boolean(study.scenarios.length),
    Boolean(study.scenarios.length && study.evaluations.length >= study.strategies.filter((item) => item.feasible).length * study.scenarios.length),
    study.recommendation.status === "known" && Boolean(study.actions.length)
  ] : [], [study]);

  const staleStage = dirty.length ? STAGE_ORDER[Math.min(...dirty.map((change) => STAGE_ORDER.indexOf(CHANGE_INVALIDATES_FROM[change])))] : null;
  const staleFrom = staleStage ? TABS.findIndex((item) => item.id === ({ framing: "intake", evidence: "evidence", drivers: "drivers", scenarios: "scenarios", consequences: "scenarios", strategy_evaluation: "compare", synthesis: "brief" } as Record<string, Tab>)[staleStage]) : -1;

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">S</div><div><b>ScenarioLab</b><span>Decision workbench</span></div></div>
      <button className="button primary new-button" onClick={() => setNewStudyOpen(true)}>+ New study</button>
      <div className="sidebar-label">Your studies</div>
      <nav className="study-list" aria-label="Studies">
        {studies.map((item) => <button key={item.id} className={study?.id === item.id ? "active" : ""} onClick={() => void openStudy(item.id)}><span className="study-monogram">{item.title.slice(0, 1).toUpperCase()}</span><span><b>{item.title}</b><small>{item.status} · {item.mode}</small></span>{item.synthetic && <em>SYN</em>}</button>)}
        {!studies.length && <p className="empty sidebar-empty">No saved studies yet.</p>}
      </nav>
      <div className="sidebar-label">Reference cases</div>
      <div className="reference-list">{referenceCases.map((item) => <button key={item.file} onClick={() => void importCase(item.file)}><span>↳</span><span><b>{item.title}</b><small>{item.family}</small></span></button>)}</div>
      <div className="sidebar-footer"><span className={`health-dot ${modelConfigured ? "ready" : ""}`}></span><div><b>{modelConfigured ? "Model connected" : "Manual mode"}</b><span>{modelConfigured ? "Generation available" : "Editing and export available"}</span></div></div>
    </aside>

    <main className="workspace">
      {message && <div className="toast" role="status"><span>{message}</span><button onClick={() => setMessage(null)}>×</button></div>}
      {!study ? <section className="welcome">
        <div className="welcome-orbit"><span></span><span></span><span></span><b>?</b></div>
        <div className="eyebrow">Decisions under uncertainty</div><h1>Build a plan that survives more than one future.</h1><p>Frame the choice, make assumptions visible, stress-test every option, and know exactly when to pivot.</p><div className="button-row"><button className="button primary" onClick={() => setNewStudyOpen(true)}>Start a study</button>{referenceCases[0] && <button className="button secondary" onClick={() => void importCase(referenceCases[0]!.file)}>Explore an example</button>}</div>
      </section> : <>
        <header className="topbar">
          <div className="title-block"><div className="crumb">Studies <span>/</span> {study.synthetic ? "Synthetic reference" : "Active study"}</div><input value={study.title} onChange={(event) => changeStudy({ ...study, title: event.target.value }, "problem")} aria-label="Study title" /></div>
          <div className="top-actions"><span className={`save-state ${dirty.length ? "dirty" : ""}`}>{busy ? "Working…" : dirty.length ? `${dirty.length} unsaved change${dirty.length === 1 ? "" : "s"}` : "Saved"}</span><button className="button secondary" onClick={() => void persist()} disabled={!dirty.length || busy}>Save</button><label className="scenario-count">Futures<select value={scenarioCount} onChange={(event) => setScenarioCount(Number(event.target.value))}>{[2,3,4,5,6].map((value) => <option key={value}>{value}</option>)}</select></label><button className="button primary generate-button" onClick={() => void generate()} disabled={generating}>{generating ? "Generating…" : run && ["failed","cancelled","stale"].includes(run.status) ? "Resume analysis" : "Generate draft"}</button>{generating && <button className="button danger-button" onClick={() => void cancel()}>Cancel</button>}</div>
        </header>
        <nav className="workflow-nav" aria-label="Study workflow">{TABS.map((item, index) => <button key={item.id} className={`${tab === item.id ? "active" : ""} ${progress[index] ? "done" : ""}`} onClick={() => setTab(item.id)}><span>{progress[index] ? "✓" : item.number}</span>{item.label}{staleFrom >= 0 && index >= staleFrom && <i title="Will become stale"></i>}</button>)}</nav>
        {dirty.length > 0 && <div className="change-banner"><span>△</span><div><b>What-if changes not saved</b><p>{dirty.join(", ")} changed. Saving will mark analysis stale from <b>{staleStage}</b> onward.</p></div></div>}
        {run && <div className="run-strip"><div className="run-label"><span className={`run-dot ${run.status}`}></span><b>Analysis run</b><small>{run.status} · {run.totalUsage.totalTokens.toLocaleString()} tokens · {run.totalUsage.costUsd === null ? "cost unknown" : `$${run.totalUsage.costUsd.toFixed(2)}`}</small></div><div className="stage-pills">{run.stages.map((stage) => <span key={stage.id} className={stage.status} title={stage.error?.message ?? stage.stage}>{stage.stage.replace("_", " ")}</span>)}</div></div>}
        <div className="content-area">
          {tab === "intake" && <IntakePanel study={study} onChange={changeStudy} />}
          {tab === "evidence" && <EvidencePanel study={study} capabilities={researchCapabilities} onChange={changeStudy} onPreviewNew={previewNewResearch} onPreviewRefresh={previewResearchRefresh} onApplyResearch={applyResearch} />}
          {tab === "drivers" && <DriversPanel study={study} onChange={changeStudy} />}
          {tab === "scenarios" && <ScenariosPanel study={study} onChange={changeStudy} onMessage={setMessage} />}
          {tab === "compare" && <ComparePanel study={study} onChange={changeStudy} />}
          {tab === "brief" && <BriefPanel study={study} run={run} revisions={revisions} onChange={changeStudy} onNavigate={setTab} onAccept={accept} exportUrl={(format, revisionId) => api.exportUrl(study.id, format, revisionId)} />}
        </div>
      </>}
    </main>
    <NewStudyDialog open={newStudyOpen} busy={busy} onClose={() => setNewStudyOpen(false)} onCreate={create} />
  </div>;
}
