# ScenarioLab MVP user flows

Status: Approved M0 interaction baseline
As of: 2026-09-11

## Shared interaction rules

- Autosave a working draft locally after valid edits; never discard invalid input.
- Display `Saved`, `Unsaved`, `Generating`, `Needs review`, `Stale`, and `Failed`
  states in plain language.
- Generated changes arrive as a preview. Accepting them creates a new working
  revision; it does not overwrite user-authored fields silently.
- Every stage can be completed or edited manually if model generation is
  unavailable.
- The user may leave and reopen a draft at any step.
- A study is “complete” only when required fields and the strategy coverage matrix
  validate. A draft can be saved while incomplete.

## Flow 1 — Create a study

**Entry:** New study → choose Quick or Full.

1. Enter the decision, decision-maker, objective, horizon, deadline, options, hard
   constraints, unacceptable outcomes, current situation, and available evidence.
2. The application highlights only omissions that materially block framing. The
   user can answer, mark unknown, or save a draft.
3. Review normalized framing. The status quo is added if absent, clearly marked as
   a suggestion, and remains editable.
4. Add or edit source records, claims, and assumptions. Unsupported material stays
   visible as an evidence gap.
5. Generate or manually create drivers. Review impact/uncertainty ratings and their
   rationales.
6. Generate or manually create 3–4 scenarios. Compare driver states, causal path,
   direct and second-order consequences, and disconfirming evidence side by side.
7. Define evaluation criteria and score meaning. Assess every feasible strategy in
   every scenario; resolve hard-constraint failures separately from preferences.
8. Review the proposed robust choice, conditional alternatives, reversal
   assumption, indicators, triggers, and actions.
9. Accept a revision and export Markdown or JSON.

**Success:** The saved revision validates; the brief names an action now, a major
uncertainty, and a pivot condition. The user can navigate from a recommendation to
its evaluations and upstream assumptions.

**Recovery:** On invalid generation, show the failed stage and validation messages,
retain all previous content, and offer Retry, Edit manually, or Continue later.

## Flow 2 — Revise after an input changes

**Entry:** Open study → edit a claim, assumption, constraint, option, or objective.

1. Save the edit as a working change and show its difference from the accepted
   revision.
2. Compute downstream dependencies and mark affected items stale. Unaffected
   content stays current.
3. Offer a change summary and selective regeneration by affected stage.
4. Preview generated replacements beside existing content. Preserve manual edits
   unless the user explicitly accepts a replacement.
5. Revalidate references, strategy coverage, and hard constraints.
6. Accept as a new revision or leave the working draft unaccepted.

**Success:** Earlier accepted revisions remain accessible; the new revision records
what changed and why. Stale content cannot appear current.

**Recovery:** If regeneration fails, the edit and stale markers remain saved and
the last accepted recommendation remains identifiable.

## Flow 3 — Compare choices and futures

**Entry:** Study → Compare.

1. Select scenarios and evaluation criteria to display; default to all.
2. Read the complete strategy × scenario matrix with rationale and constraint
   status in each cell.
3. Inspect a cell to trace the relevant scenario states, assumptions, and evidence.
4. Change a criterion, score definition, strategy, or scenario in a working copy.
5. Preview the affected evaluations and the before/after robustness summary.
6. Keep the comparison as an experiment, discard it, or accept a revision.

**Success:** No feasible strategy or scenario is silently omitted, and the user can
state why the robust choice holds or when a conditional choice becomes preferable.

## Flow 4 — Export and share manually

**Entry:** Study → Export.

1. Choose the current working draft or an accepted revision.
2. Choose Markdown or JSON. Show validation status, stale sections, evidence gaps,
   synthetic labels, and generation metadata before export.
3. Produce a deterministic export with stable IDs and schema version. Markdown
   links to the evidence and update records; JSON preserves relationships.
4. Save the file through the browser.

**Success:** Repeated export of the same revision is byte-stable apart from fields
explicitly documented as volatile. Export does not imply approval or execute an
action.

**Recovery:** Export works without the model service. If the draft is incomplete,
allow export with an unmistakable `Draft / incomplete` label and validation report.

## Flow 5 — Reopen and inspect history

**Entry:** Study library → select study.

1. Show the latest accepted revision, working changes, last-updated time, and any
   stale or failed stage.
2. Resume the last incomplete step or browse the full study.
3. Open revision history to compare two accepted revisions by changed inputs,
   affected scenarios/evaluations, and recommendation status.
4. Restore an earlier revision only by creating a new working copy; history remains
   immutable.

**Success:** User edits and accepted revisions survive restart, and the source of
the currently displayed recommendation is unambiguous.

## Flow-to-requirement trace

| Requirement | Create | Revise | Compare | Export | Reopen |
|---|:---:|:---:|:---:|:---:|:---:|
| Unknown values supported | ✓ | ✓ |  | ✓ | ✓ |
| User edits preserved | ✓ | ✓ | ✓ | ✓ | ✓ |
| Dependencies/staleness visible |  | ✓ | ✓ | ✓ | ✓ |
| All strategies × scenarios assessed | ✓ | ✓ | ✓ | ✓ | ✓ |
| Model-independent core operation | ✓ | ✓ | ✓ | ✓ | ✓ |
| Immutable accepted history | ✓ | ✓ | ✓ | ✓ | ✓ |
