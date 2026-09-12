import { useState } from "react";
import type { Assumption, Evidence, EvidenceContradiction, Study, SupportAssessment } from "../../../src/domain/schema";
import type { ResearchPreview, ResearchSourceInput } from "../../../src/research/types";
import type { ResearchCapabilities } from "../api";
import { knownText, newId, replaceAt, unknown, valueOf } from "../study-utils";

type Props = {
  study: Study;
  capabilities: ResearchCapabilities;
  onChange: (study: Study, section: "evidence" | "assumption") => void;
  onPreviewNew: (input: ResearchSourceInput) => Promise<ResearchPreview | null>;
  onPreviewRefresh: (evidenceIds: string[], maxAgeDays: number) => Promise<ResearchPreview | null>;
  onApplyResearch: (preview: ResearchPreview) => Promise<void>;
};

const supportLabel: Record<SupportAssessment["status"], string> = {
  unreviewed: "Unreviewed",
  supports: "Supports",
  partially_supports: "Partially supports",
  contradicts: "Contradicts",
  unsupported: "Unsupported"
};

export function EvidencePanel({ study, capabilities, onChange, onPreviewNew, onPreviewRefresh, onApplyResearch }: Props) {
  const [kind, setKind] = useState<"web" | "document">("document");
  const [locator, setLocator] = useState("");
  const [claim, setClaim] = useState("");
  const [maxAgeDays, setMaxAgeDays] = useState(180);
  const [selected, setSelected] = useState<string[]>([]);
  const [preview, setPreview] = useState<ResearchPreview | null>(null);
  const [researchBusy, setResearchBusy] = useState(false);

  const addEvidence = () => onChange({ ...study, evidence: [...study.evidence, {
    id: newId(), claim: "Describe the claim", type: "user_claim", source: unknown("No source supplied"), observedAt: unknown("Unknown"), retrievedAt: unknown("Not retrieved"), limitations: [], support: { status: "unreviewed", rationale: unknown("No source review completed") }, authorship: "user"
  }] }, "evidence");
  const addAssumption = () => onChange({ ...study, assumptions: [...study.assumptions, {
    id: newId(), statement: "Describe the assumption", basis: "User judgment", plausibleAlternatives: [], effectIfWrong: unknown("Not assessed"), test: unknown("Not defined"), evidenceIds: [], authorship: "user"
  }] }, "assumption");

  const previewNew = async () => {
    setResearchBusy(true);
    try {
      const result = await onPreviewNew({ kind, locator, claim, maxAgeDays });
      if (result) setPreview(result);
    } finally { setResearchBusy(false); }
  };
  const previewRefresh = async () => {
    setResearchBusy(true);
    try {
      const result = await onPreviewRefresh(selected, maxAgeDays);
      if (result) setPreview(result);
    } finally { setResearchBusy(false); }
  };
  const apply = async () => {
    if (!preview) return;
    setResearchBusy(true);
    try {
      await onApplyResearch(preview);
      setPreview(null);
      setSelected([]);
      setClaim("");
      setLocator("");
    } finally { setResearchBusy(false); }
  };
  const updatePreviewSupport = (index: number, status: SupportAssessment["status"]) => {
    if (!preview) return;
    setPreview({ ...preview, entries: preview.entries.map((entry, itemIndex) => itemIndex === index && entry.status === "available"
      ? { ...entry, proposedEvidence: { ...entry.proposedEvidence, support: { status, rationale: status === "unreviewed" ? unknown("Reviewer has not assessed support") : { status: "known", value: `Reviewer marked this source as: ${supportLabel[status]}.` } } } }
      : entry) });
  };
  const updateContradiction = (index: number, patch: Partial<EvidenceContradiction>) => onChange({
    ...study,
    research: { ...study.research, contradictions: replaceAt(study.research.contradictions, index, { ...study.research.contradictions[index]!, ...patch }) }
  }, "evidence");

  const webEnabled = capabilities.webHosts.length > 0;
  const documentsEnabled = capabilities.documentRoot !== null;
  return <div className="panel-stack" data-testid="evidence-panel">
    <header className="panel-heading"><div><div className="eyebrow">02 · Ground</div><h2>Evidence & assumptions</h2><p>Inspect citations, separate source content from inference, and keep unresolved conflicts visible.</p></div><span className="quiet-chip">{study.evidenceGaps.length} open gaps</span></header>

    <section className="card research-workbench">
      <div className="section-title"><div><h3>Research source</h3><p>Preview first. Retrieved text is untrusted data and never changes the study until you apply the reviewed update.</p></div><span className="security-chip">Shielded retrieval</span></div>
      <div className="research-form">
        <label className="field">Source type<select value={kind} onChange={(event) => setKind(event.target.value as "web" | "document")}><option value="document" disabled={!documentsEnabled}>Local .md / .txt{documentsEnabled ? "" : " — not configured"}</option><option value="web" disabled={!webEnabled}>Allowlisted HTTPS{webEnabled ? "" : " — not configured"}</option></select></label>
        <label className="field span-2">{kind === "web" ? "HTTPS URL" : "Path relative to document root"}<input value={locator} onChange={(event) => setLocator(event.target.value)} placeholder={kind === "web" ? "https://allowed.example/report" : "notes/research.md"} /></label>
        <label className="field span-3">Claim to cite<textarea value={claim} onChange={(event) => setClaim(event.target.value)} placeholder="State the material claim this source should support." /></label>
        <label className="field">Freshness threshold<input type="number" min={1} max={3650} value={maxAgeDays} onChange={(event) => setMaxAgeDays(Number(event.target.value))} /></label>
      </div>
      <div className="research-policy"><b>Supported:</b> UTF-8 .md/.txt inside {capabilities.documentRoot ?? "a configured document root"}; HTTPS only for {capabilities.webHosts.length ? capabilities.webHosts.join(", ") : "explicitly allowlisted hosts"}. Redirects, active HTML, credentials, other ports, and oversized content are rejected.</div>
      <div className="button-row"><button className="button primary compact" disabled={researchBusy || !locator.trim() || !claim.trim() || (kind === "web" ? !webEnabled : !documentsEnabled)} onClick={() => void previewNew()}>Preview source</button><button className="button secondary compact" disabled={researchBusy || selected.length === 0} onClick={() => void previewRefresh()}>Preview refresh ({selected.length})</button></div>

      {preview && <div className="research-preview" data-testid="research-preview"><div className="preview-heading"><div><div className="mini-label">Review before applying</div><h4>{preview.entries.length} source result{preview.entries.length === 1 ? "" : "s"}</h4></div><button className="icon-button" onClick={() => setPreview(null)}>×</button></div>{preview.entries.map((entry, index) => entry.status === "unavailable"
        ? <article className="preview-entry unavailable" key={entry.unavailable.id}><span className="support-badge unsupported">Unavailable</span><b>{entry.source.locator}</b><p>{entry.unavailable.reason}</p><small>Applying records the failure in revision history without replacing evidence.</small></article>
        : <article className="preview-entry" key={entry.proposedEvidence.id}><div className="preview-meta"><span className={`freshness ${entry.proposedEvidence.citation!.freshness.status}`}>{entry.proposedEvidence.citation!.freshness.status}</span><span>{entry.contentChanged === null ? "New citation" : entry.contentChanged ? "Source changed" : "No content change"}</span><span>Retrieved {new Date(entry.proposedEvidence.citation!.retrievedAt).toLocaleString()}</span></div><h4>{valueOf(entry.proposedEvidence.citation!.title) || entry.source.locator}</h4><blockquote>{entry.proposedEvidence.citation!.excerpt}</blockquote><div className="impact-summary"><b>Affected if applied:</b> {entry.impact.assumptionIds.length} assumptions · {entry.impact.driverIds.length} drivers · {entry.impact.constraintIds.length} constraints · {entry.impact.consequenceIds.length} consequences · analysis from evidence onward</div><label className="field">Does the excerpt support the claim?<select value={entry.proposedEvidence.support.status} onChange={(event) => updatePreviewSupport(index, event.target.value as SupportAssessment["status"])}>{Object.entries(supportLabel).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label></article>)}<div className="preview-actions"><button className="button secondary" onClick={() => setPreview(null)}>Discard preview</button><button className="button primary" disabled={researchBusy} onClick={() => void apply()}>Apply as reviewed revision</button></div></div>}
    </section>

    <section className="card">
      <div className="section-title"><div><h3>Evidence register</h3><p>Sourced facts, user claims, and inferences stay distinct.</p></div><button className="button compact" onClick={addEvidence}>+ Add evidence</button></div>
      <div className="evidence-list">
        {study.evidence.map((evidence, index) => {
          const update = (patch: Partial<Evidence>) => onChange({ ...study, evidence: replaceAt(study.evidence, index, { ...evidence, ...patch, authorship: "user" }) }, "evidence");
          const refreshable = Boolean(evidence.citation);
          return <article className="evidence-card" key={evidence.id}>
            <div className="evidence-meta">{refreshable && <input type="checkbox" aria-label={`Select ${evidence.claim} for refresh`} checked={selected.includes(evidence.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, evidence.id] : current.filter((id) => id !== evidence.id))} />}<span className="id-chip">E · {evidence.id.slice(0, 6)}</span><select value={evidence.type} onChange={(event) => update({ type: event.target.value as Evidence["type"] })}><option value="sourced_fact">Sourced fact</option><option value="user_claim">User claim</option><option value="inference">Inference</option></select><span className={`support-badge ${evidence.support.status}`}>{supportLabel[evidence.support.status]}</span><button className="icon-button" onClick={() => onChange({ ...study, evidence: study.evidence.filter((_, i) => i !== index), research: { ...study.research, contradictions: study.research.contradictions.filter((item) => item.leftEvidenceId !== evidence.id && item.rightEvidenceId !== evidence.id), unavailableSources: study.research.unavailableSources.filter((item) => item.evidenceId !== evidence.id) } }, "evidence")}>×</button></div>
            <textarea className="plain-textarea" value={evidence.claim} onChange={(event) => update({ claim: event.target.value })} aria-label="Evidence claim" />
            <input value={valueOf(evidence.source)} onChange={(event) => update({ source: knownText(event.target.value) })} placeholder="Source URL, file, or observation — unknown allowed" aria-label="Evidence source" />
            {evidence.citation && <details className="citation-detail"><summary>Citation snapshot · {evidence.citation.freshness.status}</summary><div className="citation-meta"><span>Published: {evidence.citation.publishedAt.status === "known" ? new Date(evidence.citation.publishedAt.value).toLocaleDateString() : "unknown"}</span><span>Retrieved: {new Date(evidence.citation.retrievedAt).toLocaleString()}</span><span>SHA-256: {evidence.citation.contentHash.slice(0, 12)}…</span></div><blockquote>{evidence.citation.excerpt}</blockquote>{evidence.citation.kind === "web" && <a href={evidence.citation.locator} target="_blank" rel="noreferrer">Inspect supporting source ↗</a>}<label className="field">Support assessment<select value={evidence.support.status} onChange={(event) => update({ support: { status: event.target.value as SupportAssessment["status"], rationale: evidence.support.rationale } })}>{Object.entries(supportLabel).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label></details>}
          </article>;
        })}
        {!study.evidence.length && <div className="empty-state"><b>No evidence records yet</b><span>Add what you know, or leave the gap explicit.</span></div>}
      </div>
    </section>

    <section className="card review-register">
      <div className="section-title"><div><h3>Evidence review</h3><p>Potential conflicts and unavailable sources remain unresolved until a reviewer records a disposition.</p></div><span className="quiet-chip">{study.research.contradictions.filter((item) => item.status === "open").length} open conflicts</span></div>
      <div className="contradiction-list">{study.research.contradictions.map((item, index) => <article key={item.id} className={`contradiction-card ${item.status}`}><div><span className="support-badge contradicts">{item.detectedBy} detection</span><b>{item.description}</b><p>“{study.evidence.find((evidence) => evidence.id === item.leftEvidenceId)?.claim}” ↔ “{study.evidence.find((evidence) => evidence.id === item.rightEvidenceId)?.claim}”</p></div><label className="field">Disposition<select value={item.status} onChange={(event) => updateContradiction(index, { status: event.target.value as "open" | "resolved", resolution: event.target.value === "resolved" ? { status: "known", value: "Reviewed and resolved by the user." } : unknown("Not resolved") })}><option value="open">Open</option><option value="resolved">Resolved</option></select></label></article>)}{!study.research.contradictions.length && <p className="empty">No potential contradictions recorded.</p>}</div>
      <div className="unavailable-list"><div className="mini-label">Unavailable sources</div>{study.research.unavailableSources.map((item) => <div key={item.id}><b>{item.locator}</b><span>{item.reason}</span><small>{new Date(item.checkedAt).toLocaleString()}</small></div>)}{!study.research.unavailableSources.length && <p className="empty">None recorded.</p>}</div>
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
