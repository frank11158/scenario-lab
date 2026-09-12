# ScenarioLab evaluation rubric

Status: Approved M0 baseline
Version: 1.0
As of: 2026-09-11

## Purpose

This rubric judges whether a study is useful and trustworthy without assuming one
scenario set or recommendation is uniquely correct. Apply it to a complete export,
using the matching reference fixture when applicable. Reviewers score observable
output, not writing style or agreement with their preferred decision.

## Review procedure

1. Confirm the output matches the fixture/input revision being evaluated.
2. Apply the non-negotiable gates below. A gated failure cannot be offset by a
   high numerical score.
3. Score each dimension from 0 to 4 and cite one short piece of output evidence.
4. Record disagreements by dimension. Two reviewers reconcile factual misses; a
   difference of one point based on judgment may remain and is reported as a range.
5. Report the dimension profile and total. Do not use the total alone to diagnose
   quality.

For automated regression, evaluate stable fixture property IDs semantically and
retain the generated artifact. Exact prose matching is not a valid quality test.

## Non-negotiable gates

A study fails regardless of score if it:

- invents a material source, observation, calculation, or user fact;
- presents synthetic input as real;
- silently omits a feasible strategy or scenario from the comparison;
- recommends an option that violates a stated hard constraint without explicitly
  identifying and resolving the violation;
- presents unsupported scenario probabilities as measured forecasts;
- replaces user-authored content without disclosure; or
- lacks any actionable next step and any condition for review or change.

## Common scale

| Score | Meaning |
|---:|---|
| 0 | Missing, unusable, or materially misleading |
| 1 | Present but major omissions or contradictions impair the decision |
| 2 | Minimally useful; important gaps are visible but weakly handled |
| 3 | Strong; complete and reasoned with only minor limitations |
| 4 | Excellent; precise, traceable, challenged, and unusually decision-useful |

## Scored dimensions

Each dimension has equal weight. The 0–32 total is an ordinal review aid, not a
probability or calibrated measure of decision correctness.

| Dimension | 0–1 evidence | 2 evidence | 3–4 evidence |
|---|---|---|---|
| 1. Decision framing | Decision, owner, horizon, options, success, or constraints are absent or confused | Core decision is recognizable; one material element is weak or unknown and labeled | Decision, deadline/horizon, objective, success, status quo, constraints, controls, and uncertainties are explicit and decision-relevant |
| 2. Scenario distinction | Futures are tone labels, duplicates, or arbitrary | Futures differ, but mechanisms or selected drivers are only partly explained | Futures differ through material driver states and causal mechanisms; coverage, overlap, dependencies, and tail risks are discussed |
| 3. Internal consistency | Driver states, timing, consequences, or recommendation contradict | Mostly coherent, with visible but unresolved dependencies | Each future connects states → mechanism/timeline → direct and second-order effects; disconfirming evidence is specific |
| 4. Evidence support | Claims are fabricated, conflated, or unsupported without warning | Types and major gaps are visible, but provenance or claim linkage is incomplete | Facts, user claims, assumptions, and inferences are distinct; material claims trace to evidence; gaps and contradictions affect confidence |
| 5. Strategy coverage | Options/scenarios are omitted or scoring is unexplained | Complete matrix with shallow rationale or unclear scale | Every feasible strategy × scenario is assessed using defined criteria; rationales, reversibility, and hard constraints are explicit |
| 6. Recommendation robustness | Recommendation merely follows a favored future or ignores failure | Cross-scenario tradeoff is identified but weakly challenged | Robust and conditional choices are separated; reversal assumption, switching point, costly failure, and value of learning are addressed |
| 7. Action usefulness | Generic advice with no owner, timing, threshold, or link to uncertainty | At least one concrete action and trigger, with some missing operational detail | Now/prepare/pivot actions have owner or unassigned status, due condition, success check, observable threshold, source, window, and cadence |
| 8. Uncertainty and numerical discipline | False precision, invalid probability, or unsupported calculation | Important unknowns and limitations are named | Likelihood is separate from evidence confidence; ranges, units, bases, dependencies, and limitations are explicit; no unjustified expected value |

## Baseline interpretation

Before M2 baseline runs, use these provisional thresholds:

- **Reviewable draft:** no gate failure; every dimension ≥2; total ≥20/32.
- **Strong draft candidate:** no gate failure; every dimension ≥2; total ≥25/32.
- **Regression:** a previously passing fixture gains a gate failure, loses a required
  fixture property, or drops by 3+ total points under the same model/prompt/config.

M2 must run at least three independent generations per fixture, report all runs,
and establish variance. Before M7 release testing, freeze numeric thresholds,
reviewer instructions, model/prompt versions, and the fixture revision. Do not
select only the best generation.

## Reference-case score sheet

```text
Fixture / input revision:
Study revision:
Model / prompt / configuration (if generated):
Reviewer and date:
Gate failures:

1 Framing: __/4 — evidence:
2 Distinction: __/4 — evidence:
3 Consistency: __/4 — evidence:
4 Evidence support: __/4 — evidence:
5 Strategy coverage: __/4 — evidence:
6 Robustness: __/4 — evidence:
7 Action usefulness: __/4 — evidence:
8 Discipline: __/4 — evidence:

Total: __/32
Fixture property IDs satisfied / missed:
Material reviewer disagreement:
Verdict: not reviewable / reviewable / strong candidate
```
