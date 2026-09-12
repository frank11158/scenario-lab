# ScenarioLab MVP product brief

Status: Approved baseline for M1–M3
Decision date: 2026-09-11
Owner: ScenarioLab product development

## Product promise

ScenarioLab helps one person turn a consequential, uncertain decision into an
inspectable plan. It structures what is known, develops several causally distinct
futures, tests every feasible option in every future, and ends with actions and
observable reasons to change course. It supports judgment; it does not predict the
future or make the decision for the user.

The MVP succeeds when a user can create, revise, save, reopen, and export a useful
study without developer assistance and can explain the main tradeoff, the largest
assumption, and the condition that would reverse the recommendation.

## Initial users and decisions

The first user is an individual analyst or decision-maker working alone. Three
case families deliberately test whether one planning model transfers across
domains:

| User | Representative decision | Why ScenarioLab is hired |
|---|---|---|
| Professional making a personal choice | Change jobs now, search while employed, or wait | Expose personal constraints, preserve optionality, and define a decision deadline |
| Technical lead | Add capacity now, stage upgrades, or wait for measurements | Separate load uncertainty from architecture assumptions and identify thresholds |
| Product, business, or technology strategist | Adopt, pilot, defer, or reject an infrastructure approach | Compare path-dependent bets across adoption and ecosystem futures |

The fictional team-workshop case is a small cross-domain regression fixture. It
is not a fourth target market.

## Jobs to be done

1. When a consequential choice has several plausible futures, help me frame the
   decision, its deadline, constraints, and success criteria before recommending.
2. Help me separate evidence, claims, assumptions, and inference so that I can see
   what the conclusion depends on.
3. Help me construct futures that differ by causal mechanism, not just tone.
4. Show how every option—including the status quo—performs in every future and
   whether any hard constraint fails.
5. Let me change an input without losing my edits, then show which conclusions
   may be stale.
6. Give me a brief with an action now, preparations, pivot triggers, evidence gaps,
   and a review point that I can export and discuss elsewhere.

## Study modes

Both modes use the same data model and quality rules. “Quick” is not permission to
omit hard constraints, fabricate evidence, or skip strategy coverage.

| Dimension | Quick study | Full study |
|---|---|---|
| Intended use | Reversible or near-term choice; early orientation | Consequential, hard-to-reverse, or multi-stakeholder choice |
| Typical input | Decision plus enough context to identify options and constraints | Completed guided intake plus reviewed evidence |
| Scenarios | 3 by default | 3–4, configurable |
| Drivers | Only material drivers, normally 5–7 | Broader driver review, normally 5–10 |
| Evidence | User-provided evidence and visible gaps | Claim-level review and explicit contradictions within MVP limits |
| Evaluation | Compact qualitative matrix; all strategies × scenarios | Defined criteria, rationale, constraints, sensitivity, and challenge |
| Output | Concise decision brief and triggers | Complete study, evidence register, revision history, and exports |
| Review expectation | User checks before acting | Deliberate review and acceptance of a saved revision |

The interface suggests full mode when the user reports an irreversible decision,
a safety/legal/financial hard constraint, multiple decision-makers, or major
unsupported claims. The user retains the choice of mode.

## Functional MVP requirements (M1–M3)

The MVP must:

- guide intake while allowing unknown values and a saved draft;
- include the status quo and distinguish hard constraints from preferences;
- store stable, versioned entities and immutable accepted revision snapshots;
- let users inspect and edit evidence, assumptions, drivers, scenarios,
  consequences, strategies, evaluations, indicators, and actions;
- validate references and require every feasible strategy × scenario evaluation;
- retain provenance and mark affected generated material stale after upstream edits;
- generate through resumable, independently validated stages and preserve user edits;
- remain usable for editing, saving, reopening, and exporting when the model fails;
- export deterministic, human-readable Markdown and versioned JSON; and
- label generated suggestions and synthetic fixtures clearly.

## MVP boundary

| In MVP | Later, not required for MVP | Outside this roadmap |
|---|---|---|
| Single user; local studies | Hosted accounts and collaboration | Automatically executing recommended actions |
| User-entered source records | Live web/document retrieval and refresh | Claims of calibrated prediction without validation |
| AI-assisted qualitative planning | Scheduled indicator collection and alerts | Hidden replacement of user-authored content |
| Qualitative comparisons and explicit thresholds | Numerical sensitivity and Monte Carlo analysis | Unreviewed publication or sharing |
| Save, reopen, revision history, Markdown/JSON export | Domain packs, integrations, outcome learning | General-purpose autonomous agents |
| Local-first browser workbench | Multi-user cloud deployment | Arbitrary Markdown import in M1 |

## Quality, safety, and trust requirements

- Unknown remains unknown. The system never inserts a confident default merely to
  satisfy a schema.
- Likelihood is optional and always separate from evidence confidence. Percentages
  are accepted only for an explicitly mutually exclusive and exhaustive set.
- Generated rationales are concise, inspectable claims—not private chain-of-thought.
- The application validates IDs, references, completeness, and hard constraints;
  the model proposes narrative content.
- A model/tool failure cannot corrupt the last saved revision.
- No study action is executed by the product in the MVP.
- Private study content stays on the chosen single-user deployment except for the
  selected model request; the UI makes that transmission visible.

## Success measures and release evidence

M0 fixes the measurement method; M2 supplies baseline values and M7 freezes final
release thresholds before testing.

| Outcome | Measure | MVP evidence |
|---|---|---|
| Complete workflow | Unassisted completion of intake → export | Pilot task observation and event log |
| Understandable result | User can state tradeoff, key assumption, and pivot | Post-task comprehension check |
| Planning quality | Reference-case rubric score | Independent review using `evaluation-rubric.md` |
| Reliability | Save/load fidelity, validation, recovery, lost edits | Automated tests and failure-injection cases |
| Responsible uncertainty | Unsupported claims, invented citations/probabilities | Rubric and adversarial fixtures |
| Operating fit | End-to-end latency and model cost | Recorded per-run telemetry against architecture budgets |

Product usefulness is judged with a rubric and user observation, not by requiring
one “correct” scenario set or recommendation. A different answer may pass when it
is complete, causally coherent, evidence-aware, and actionable.

## Assumptions and open validation questions

These are adopted as the M0 baseline so implementation can proceed:

- A local-first browser application is acceptable for the first single-user pilot.
- English-language qualitative studies are sufficient for the MVP.
- Users will enter source metadata manually until M4.
- One replaceable model provider is sufficient for M2, with no provider fallback.
- Pilot users will accept explicit review steps in exchange for traceability.

Revisit these decisions if pilots show that installation is the primary completion
barrier, manual evidence entry prevents useful studies, or another language or
deployment model is needed to recruit representative users.
