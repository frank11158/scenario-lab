import { useState, type FormEvent } from "react";
import type { CreateStudyInput } from "../../../src/application/create-study";

type Props = {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onCreate: (input: CreateStudyInput) => Promise<void>;
};

export function NewStudyDialog({ open, busy, onClose, onCreate }: Props) {
  const [title, setTitle] = useState("");
  const [decision, setDecision] = useState("");
  const [objective, setObjective] = useState("");
  const [success, setSuccess] = useState("");
  const [horizon, setHorizon] = useState("");
  const [deadline, setDeadline] = useState("");
  const [statusQuo, setStatusQuo] = useState("");
  const [alternative, setAlternative] = useState("");
  const [mode, setMode] = useState<"quick" | "full">("quick");
  if (!open) return null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await onCreate({
      title,
      decision,
      objective,
      successCriteria: [success],
      mode,
      horizon: horizon || undefined,
      decisionDeadline: deadline || undefined,
      options: [
        { name: statusQuo, statusQuo: true },
        { name: alternative, statusQuo: false }
      ]
    });
  };

  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="new-study-title">
      <button className="icon-button dialog-close" onClick={onClose} aria-label="Close">×</button>
      <div className="eyebrow">New decision</div>
      <h2 id="new-study-title">Frame the choice before the futures</h2>
      <p className="muted">Start with what matters. Unknown details can stay unknown and be resolved later.</p>
      <form onSubmit={submit} className="form-grid">
        <label className="field span-2">Study title<input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Choose a rollout strategy" autoFocus /></label>
        <label className="field span-2">Decision<textarea required value={decision} onChange={(event) => setDecision(event.target.value)} placeholder="What needs to be decided, and by when?" /></label>
        <label className="field span-2">Objective<textarea required value={objective} onChange={(event) => setObjective(event.target.value)} placeholder="What outcome are you trying to create?" /></label>
        <label className="field span-2">One success criterion<input required value={success} onChange={(event) => setSuccess(event.target.value)} placeholder="The result stays within budget and remains reversible" /></label>
        <label className="field">Horizon <span>optional</span><input value={horizon} onChange={(event) => setHorizon(event.target.value)} placeholder="12 months" /></label>
        <label className="field">Decision deadline <span>optional</span><input value={deadline} onChange={(event) => setDeadline(event.target.value)} placeholder="End of this month" /></label>
        <label className="field">Status quo<input required value={statusQuo} onChange={(event) => setStatusQuo(event.target.value)} placeholder="Continue current approach" /></label>
        <label className="field">Alternative<input required value={alternative} onChange={(event) => setAlternative(event.target.value)} placeholder="Run a limited pilot" /></label>
        <fieldset className="mode-choice span-2">
          <legend>Study depth</legend>
          <label className={mode === "quick" ? "selected" : ""}><input type="radio" checked={mode === "quick"} onChange={() => setMode("quick")} /> <b>Quick</b><span>Focused orientation for a reversible choice</span></label>
          <label className={mode === "full" ? "selected" : ""}><input type="radio" checked={mode === "full"} onChange={() => setMode("full")} /> <b>Full</b><span>Complete review for a consequential decision</span></label>
        </fieldset>
        <div className="dialog-actions span-2">
          <button type="button" className="button secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="button primary" disabled={busy}>{busy ? "Creating…" : "Create study"}</button>
        </div>
      </form>
    </section>
  </div>;
}
