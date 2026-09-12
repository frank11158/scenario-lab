# ScenarioLab development roadmap

Status: Active roadmap; M0–M2 completed 2026-09-11, M3 not started.

## Product goal

Build an AI-powered scenario planning engine that helps people make better
decisions under uncertainty by exploring plausible futures, stress-testing
choices, and identifying robust actions.

The starting concept comes from the referenced conversation,
“Create Scenario Planning Project.” Its central idea is a structured analyst
workflow rather than a single prompt asking an AI to invent three scenarios:

**Problem → Objective and horizon → Evidence → Drivers and assumptions →
Scenarios → Consequences → Strategy stress tests → Indicators → Actions**

The available conversation ends at the start of a scenario comparison table.
The milestones below develop that concept into a proposed implementation plan;
they are not commitments or requirements already agreed in that conversation.

## Starting point

At roadmap approval, the repository contained project instructions, templates,
and a fictional worked example but no implementation. M1 now provides the
versioned domain model, validation, SQLite persistence, revisions, reference-case
import, exports, and a resumable model-backed planning pipeline. There is still no
application interface or monitoring service.

Relevant foundations:

- [Project workflow](AGENTS.md)
- [Study structure](templates/study.md)
- [Evidence register](templates/evidence.md)
- [Worked example](examples/team-workshop.md)

## Product principles

- Start with a decision, its constraints, and success criteria. Ask targeted
  follow-up questions when missing context could change the recommendation.
- Support different problem domains through a common planning model. Initially
  validate that model on a small set of representative problems rather than
  claiming reliable performance on every possible problem.
- Let users inspect and edit assumptions, drivers, scenarios, and evaluation
  criteria. Show what changes when an input changes.
- Distinguish sourced facts, user claims, assumptions, and inferences. Preserve
  provenance and identify unsupported claims.
- Treat scenarios as plausible futures. Keep likelihood separate from evidence
  confidence; do not generate precise probabilities merely to fill a field.
- Prefer actions that work across futures. Explain tradeoffs, failure conditions,
  and evidence that would justify a different choice.
- Distinguish qualitative causal analysis from numerical simulation. A narrative
  about second-order effects must not be presented as a computed forecast.
- Keep decisions with the user. Generating a plan does not execute its actions.

## First release boundary

The MVP is a single-user application that completes a saved, editable study from
problem intake through a decision brief. It supports user-provided evidence,
AI-assisted driver and scenario development, qualitative strategy comparisons,
explicit action triggers, and Markdown/JSON export.

Validate the MVP on three case families drawn from the original concept:
personal choices such as job timing, technical capacity planning such as traffic
growth, and business or technology strategy such as infrastructure adoption.
Begin with the existing fictional workshop case as a small reference fixture.

Live research, numerical simulation, scheduled monitoring, and team workflows
follow the MVP. Users can record sources manually in the first release.
Autonomous execution of recommended decisions is outside this roadmap.

## Milestone overview

| Milestone | Outcome | Depends on | Release gate |
|---|---|---|---|
| M0 — Product definition | **Complete (2026-09-11):** shared scope and reference cases | Existing workspace | Reviewable requirements and evaluation rubric |
| M1 — Structured study foundation | **Complete (2026-09-11):** persisted, validated study model | M0 | Reliable save, load, version, and export |
| M2 — AI planning pipeline | **Complete (2026-09-11):** resumable generation of a complete draft | M1 | Validated stages with traceable inputs and failures |
| M3 — Decision workbench | User can inspect, change, and compare choices | M2 | Complete end-to-end MVP |
| M4 — Evidence and research | Source-backed baseline and refreshable claims | M3 | Claims traceable to inspected sources |
| M5 — Quantitative analysis | Reproducible sensitivity and simulation | M3; M4 for live inputs | Verified calculations and visible limitations |
| M6 — Indicators and updates | Studies adapt to meaningful new evidence | M4 | Reliable, user-enabled monitoring and revision history |
| M7 — Pilot and release readiness | Dependable product for intended users | M3; later modules gated separately | Quality, usability, operational, and privacy checks |
| M8 — Domain and team expansion | Reusable specialized and collaborative workflows | M7 | Demonstrated demand and validated domain behavior |

Milestone numbers describe the intended progression, not fixed delivery dates.
M7 applies first to the MVP and repeats for later capabilities. M4–M6 need not
delay a useful MVP pilot. Estimates should follow M0 once team capacity, product
surface, deployment needs, and acceptable operating costs are known.

## M0 — Define the product and evaluation baseline

**Status: Complete (2026-09-11).** Acceptance evidence is recorded in
[`product/m0-acceptance.md`](product/m0-acceptance.md).

Deliverables:

- A product brief identifying initial users, decisions, jobs to be done, and
  the boundary between quick studies and full studies.
- User flows for creating, revising, comparing, and exporting a study.
- Four initial reference cases: the workshop example and one case from each
  MVP case family. Label synthetic inputs explicitly.
- An evaluation rubric covering decision framing, scenario distinction,
  consistency, evidence support, strategy coverage, and action usefulness.
- Architecture decisions for the application surface, implementation stack,
  storage, model provider, deployment, and cost/latency budgets.

Acceptance criteria: each reference case specifies inputs, important unknowns,
constraints, and expected output properties. Requirements distinguish MVP from
later features. There is an agreed method for judging usefulness without assuming
that only one scenario set or recommendation is correct.

## M1 — Build the structured study foundation

**Status: Complete (2026-09-11).** Acceptance evidence is recorded in
[`product/m1-acceptance.md`](product/m1-acceptance.md).

Deliverables:

- A versioned schema for `Problem`, `Objective`, `Constraint`, `Evidence`,
  `Assumption`, `Driver`, `Scenario`, `Consequence`, `Strategy`, `Evaluation`,
  `Indicator`, `Action`, and `StudyRevision`.
- Stable IDs and relationships connecting claims to evidence, scenarios to
  driver states, evaluations to strategies/scenarios, and triggers to actions.
- Study creation, validation, persistence, revision snapshots, and export.
- Import of a structured reference case and conversion to the existing Markdown
  study format. Arbitrary Markdown import is not required for this milestone.

Acceptance criteria: save/load and JSON round trips preserve the study; invalid
references and missing required fields produce clear errors; earlier revisions
remain accessible. Unknown values can be represented without fabricated defaults.
Probability is optional and validated according to the stated scenario coverage.

## M2 — Implement the AI planning pipeline

**Status: Complete (2026-09-11).** Acceptance evidence is recorded in
[`product/m2-acceptance.md`](product/m2-acceptance.md).

Deliverables:

- Separate stages for framing, evidence organization, driver identification,
  scenario construction, consequence analysis, strategy evaluation, and synthesis.
- Structured outputs validated against M1 schemas, with bounded retries and
  clear handling of incomplete or invalid responses.
- Impact/uncertainty ranking with rationale; configurable scenario count;
  causal links and second-order effects; consistency and contradiction checks.
- Saved stage inputs/outputs, prompt and model version metadata, run status,
  usage/cost measurements, cancellation, and resume after interruption.
- A dependency map so an edited assumption marks affected downstream results
  stale and allows selective regeneration.

Acceptance criteria: all reference cases produce reviewable drafts or explicit
stage errors. Interrupted runs can resume without losing completed work or
duplicating revisions. Missing evidence stays visibly missing. Generated content
does not silently replace user edits, and stale results cannot appear current.

## M3 — Deliver the decision workbench and MVP

Deliverables:

- Guided problem intake and editable evidence, assumptions, and driver views.
- A scenario comparison view with causal consequences and disconfirming signals.
- A strategy-by-scenario matrix including the status quo, explicit success
  criteria, score definitions, rationale, and hard constraint checks.
- Qualitative robustness comparison identifying broadly useful actions,
  conditional choices, and failure conditions.
- What-if editing with regeneration previews or clear change summaries.
- A decision brief containing actions for now, preparations, pivot triggers,
  evidence gaps, and next review; saved history and Markdown/JSON export.

Acceptance criteria: a user completes intake → scenarios → strategy comparison →
actions → save/export without developer assistance. Every strategy is assessed
against every scenario. Users can trace a recommendation to assumptions and
evaluations, revise one input, and see the affected result. Save/reopen preserves
edits. A study remains usable if the model service fails during regeneration.

## M4 — Add research and evidence grounding

Deliverables:

- Retrieval from a deliberately limited set of supported web and document sources.
- Claim-level citations, source excerpts where permitted, publication/retrieval
  dates, and freshness indicators.
- Evidence review that separates source content from inference, detects conflicting
  claims, and records unresolved contradictions and unavailable sources.
- Refresh of selected evidence with a preview of affected assumptions and results.
- Controls treating retrieved content as untrusted data, including instruction
  injection cases in the evaluation set.

Acceptance criteria: reviewers can inspect the supporting source for material
external claims. Unavailable or unsupported claims are flagged rather than given
invented citations. Source failures leave existing studies intact. Evidence
refresh creates a reviewable revision instead of silently changing a decision.

## M5 — Add quantitative stress testing

Deliverables:

- Explicit variables, units, ranges, formulas, and model assumptions.
- Deterministic sensitivity analysis and break-even thresholds before introducing
  probabilistic simulation.
- Optional Monte Carlo runs where distributions and dependencies have an explicit
  basis, with seeds, input versions, and reproducible results.
- Appropriate decision measures such as worst-case outcome, regret, and expected
  value when outcomes and probabilities support them. Define objective direction
  and score comparability before applying these measures.
- Separation of scenario exploration from within-scenario numerical uncertainty.

Acceptance criteria: calculations match independently computed fixtures, invalid
units/inputs are rejected, and reruns with identical inputs and seeds reproduce
results. Correlated inputs are not silently treated as independent. Outputs expose
assumptions and sensitivity. Synthetic distributions are labeled and cannot be
mistaken for calibrated forecasts.

## M6 — Add indicators, monitoring, and study updates

Deliverables:

- Observable indicators linked to evidence sources, thresholds, observation
  windows, owners, review cadence, and recommended actions.
- User-enabled scheduled checks with pause, resume, and cancellation.
- Meaningful-change notifications, deduplication, and separate treatment of stale
  data, collection failures, and genuine threshold crossings.
- Revision comparisons showing changed evidence, assumptions, scenario assessments,
  and recommendations. Updates remain reviewable before becoming the accepted plan.

Acceptance criteria: simulated signal changes trigger the intended alert once;
unchanged observations stay quiet; failed collection does not count as a threshold
crossing. Users can disable monitoring and inspect why an alert occurred. Prior
decisions remain available, and no recommended real-world action runs automatically.

## M7 — Validate and prepare each release

Deliverables:

- Regression evaluations using reference cases and adversarial cases: conflicting
  evidence, missing context, infeasible choices, overlapping scenarios, invalid
  probabilities, and model/tool failures.
- Pilot sessions with representative users and a record of confusing flows,
  unsupported recommendations, and useful decision changes.
- Run diagnostics, failure recovery, data backup/restore, deletion/export, and
  deployment documentation. Add authentication and access isolation before
  exposing private studies through a hosted multi-user service.
- Measured latency, generation costs, and resource limits against budgets set in M0.

Acceptance criteria: no unresolved critical issues in data loss, access isolation
where applicable, fabricated citations, or incorrect calculations. Pilot users
can complete the MVP flow and explain the main tradeoff and pivot condition.
Repeated evaluations meet thresholds fixed before release testing; failures are
not hidden by selecting favorable model runs. Restore and deletion behavior are
verified for the chosen storage/deployment model.

## M8 — Expand domains and collaboration

Deliverables, prioritized by pilot evidence:

- Domain packs with specialized intake, drivers, constraints, evidence sources,
  evaluation cases, and output conventions.
- Shared studies, reviewer comments, roles, and explicit revision acceptance.
- Reusable scenario/strategy libraries with provenance and freshness checks.
- Integrations for importing evidence and exporting approved planning artifacts.
- Optional comparison across related studies and decision-outcome history.

Acceptance criteria: each domain pack passes dedicated evaluations; shared studies
enforce permissions and handle concurrent edits; reused assumptions are reviewed
for applicability. Outcome history distinguishes decision quality from luck and
does not imply forecasting calibration without enough resolved observations.

## Proposed architecture

Keep the initial implementation a modular application rather than separate
services. Confirm specific technology choices in M0.

| Component | Responsibility |
|---|---|
| User interface | Intake, editing, comparisons, review, and exports |
| Application layer | Study operations, validation, revision lifecycle |
| Workflow runner | Stage dependencies, checkpoints, retries, cancellation |
| Model adapter | AI requests and structured responses behind a replaceable interface |
| Evidence layer | Source records, retrieval, provenance, freshness |
| Analysis layer | Constraint checks, comparisons, deterministic calculations |
| Persistence | Studies, revisions, evidence metadata, run records |
| Scheduler, later | User-enabled indicator checks and notifications |

The LLM proposes and explains. Application code validates structure and references,
enforces constraints, and performs numerical calculations. Save concise rationale
and provenance, not private chain-of-thought. Do not add multiple autonomous agents
unless evaluations demonstrate a benefit worth their added cost and complexity.

## How progress will be measured

- **Planning quality:** rubric scores for distinct/coherent futures, complete
  strategy coverage, supported claims, and actionable recommendations.
- **User usefulness:** completion rate, time to a usable brief, ability to explain
  tradeoffs, and pilot feedback on whether the study informed the decision.
- **Reliability:** schema failures, recovery success, lost edits, citation errors,
  numerical errors, and regression failures.
- **Operating cost:** per-study latency, model usage, retries, and monitoring cost.
- **Longer-term learning:** whether indicators were informative and how decisions
  performed, while accounting for incomplete feedback and outcome uncertainty.

Set numerical targets after baseline measurement in M0–M2 and freeze release
thresholds before M7 evaluation. User satisfaction alone is insufficient evidence
of analytical quality.

## Immediate development backlog

- [x] Complete M0 product brief and choose the first application surface.
- [x] Convert the workshop example into the first structured reference fixture.
- [x] Define the versioned study schema and validation rules.
- [x] Establish the evaluation rubric and remaining reference cases.
- [x] Record stack, storage, provider, deployment, and cost-budget decisions.
- [x] Implement M1 persistence and export before connecting generation stages.
- [x] Implement M2 staged generation against the M1 contracts.
- [ ] Implement the M3 decision workbench against the M2 pipeline.

This roadmap authorizes no deployment, scheduled monitor, or external action;
it records the proposed development sequence. Revisit scope after the first
end-to-end pilot and keep milestone status tied to demonstrated acceptance criteria.
