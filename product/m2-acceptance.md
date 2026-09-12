# Milestone 2 acceptance record

Status: Complete
Accepted: 2026-09-11

## Delivered pipeline

| Requirement | Implementation | Verification |
|---|---|---|
| Seven independent stages | Framing, evidence, drivers, scenarios, consequences, strategy evaluation, and synthesis in `src/workflow/` | Full-run stage order and checkpoint tests |
| Structured validated output | Strict Zod and generated JSON Schema per stage, plus semantic reference/coverage checks | Schema, invalid-output, dangling-link, contradiction, and consequence tests |
| Bounded retries and errors | Configurable 0–3 retries; persisted retry feedback and typed stage errors | Three-attempt failure test |
| Scenario-planning behavior | Impact/uncertainty ratings, configurable scenario count, causal consequences, second-order effects, constraints, and contradictions | Four-fixture and semantic-validation tests |
| Traceability and measurement | Input JSON/hash, output JSON, prompt version, provider/model/version, response ID, attempts, token usage, cost or explicit unknown | Persisted stage metadata assertions |
| Cancellation and resume | Persisted cancellation request, active abort signal, stage checkpoints, restart recovery | Cancellation/resume and close/reopen recovery tests |
| Dependency invalidation | Explicit change-to-stage dependency map and current/stale assertion | Assumption edit selectively reruns five downstream stages |
| User-edit protection | Collision-aware merge preserves user/imported entities; recommendation replacement requires matching prior generated value | Regeneration preservation assertions |
| OpenAI provider adapter | Provider-neutral interface plus Responses API adapter using strict `text.format` JSON Schema, output extraction, status/errors, usage, and abort | Wire-format and 429-classification tests |

The OpenAI adapter follows the official [Create a model response](https://developers.openai.com/api/reference/cli/resources/responses/methods/create)
contract reviewed on 2026-09-11. Live credentials and a model ID are runtime
configuration; tests never contain or require an API key. Model prices are not
hardcoded: cost remains `null` unless an explicit price calculator is supplied.

## Acceptance-criteria evidence

The suite proves that:

- all four M0 reference cases complete as structurally reviewable drafts through
  the seven-stage contract;
- invalid structured output exhausts a bounded retry count and leaves a clear,
  inspectable failed stage while prior study data remains intact;
- a failed run survives SQLite close/reopen and resumes at the failed stage without
  rerunning completed work or creating duplicate accepted revisions;
- an active request can be cancelled and subsequently resumed;
- original and newly identified evidence gaps remain visible;
- a user-edited assumption, generated driver, and recommendation survive selective
  regeneration; and
- stale downstream outputs are explicitly marked and rejected by `assertRunCurrent`
  until regeneration completes.

At acceptance, `npm run check` passes 23 behavioral tests, validates all four
fixtures, and confirms that every generated schema is current. `npm audit` reports
zero known vulnerabilities.

## Operator surface

`PlanningPipeline` exposes `createRun`, `executeRun`, `cancelRun`, `getRun`, and
`applyStudyEdit`. `executeRun` is also the resume operation: completed stages are
skipped, interrupted/failed stages restart with a fresh bounded attempt window,
and stale stages regenerate selectively.

The production adapter is instantiated explicitly:

```ts
const adapter = new OpenAIResponsesAdapter({
  apiKey: process.env.OPENAI_API_KEY!,
  model: process.env.OPENAI_MODEL!
});
```

The application layer must not display recommendations as current unless
`assertRunCurrent(run)` succeeds.

## Scope boundary and evidence gap

M2 delivers the tested generation engine, not the M3 browser workbench. Regression
tests use a deterministic adapter so they are repeatable and cost-free; the real
OpenAI transport is verified at the HTTP contract boundary but was not called with
live credentials. Model-quality baselines and repeated rubric scoring require an
explicit pilot model/configuration and are part of release validation rather than
an invented M2 result.

