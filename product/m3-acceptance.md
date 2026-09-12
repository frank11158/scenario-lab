# Milestone 3 acceptance record

Status: Complete
Accepted: 2026-09-11

## Delivered workbench

| Requirement | Implementation | Verification |
|---|---|---|
| Guided intake | Editable decision, objective, horizon, deadline, decision-maker, options, constraints, and success criteria | Browser workflow plus create/edit HTTP tests |
| Evidence and drivers | Editable typed evidence, explicit unknowns, assumptions and tests, open gaps, and impact × uncertainty driver view | UI type checks and persisted edit/reopen tests |
| Plausible futures | Side-by-side scenario cards expose driver states, causal mechanisms, timelines, consequences, and disconfirming signals | Generated reference-case browser flow |
| Complete strategy comparison | Strategy × scenario matrix includes status quo, defined ratings, success criteria, rationales, and hard-constraint checks | Domain coverage invariant and 9/9 browser assertion |
| Robustness and traceability | Decision brief shows robust and conditional choices, failure conditions, challenges, and links from assumptions through evaluations to recommendation | Browser navigation assertions and persisted stage output |
| What-if regeneration | Unsaved-change preview identifies the earliest affected stage; save marks downstream stages stale; resume selectively regenerates | Browser assumption-edit/resume flow and pipeline dependency tests |
| Actionable brief | Editable now/prepare/pivot actions, indicators, thresholds, observation windows, sources, cadence, evidence gaps, and next review | Browser brief review and schema validation |
| History and exports | Immutable accepted revisions plus current/revision Markdown and JSON downloads | HTTP revision/export tests and browser download assertion |
| Model failure recovery | Missing or failed model configuration produces a clear failed run while manual editing, save, reopen, and export remain available | Dedicated unavailable-adapter HTTP test |

## Acceptance-criteria evidence

The Playwright critical-flow test completes the MVP as a user: it imports a
synthetic case, generates three futures, verifies all nine feasible
strategy/scenario pairs, inspects the decision trace, changes an assumption,
previews and saves the invalidation, selectively regenerates, accepts a revision,
downloads Markdown, reloads the app, and confirms the edit was preserved.

The deterministic browser fixture avoids external model cost and nondeterminism.
The same application server selects the real OpenAI Responses adapter only when
both runtime variables are configured. The browser remains fully usable in manual
mode when they are absent.

At acceptance:

- `npm run typecheck` validates the Node and React targets;
- `npm test` passes 27 behavioral assertions across domain, persistence, pipeline,
  adapter, API, static serving, and failure recovery;
- `npm run test:e2e` passes the full Chromium user journey;
- `npm run check` validates fixtures, generated schemas, and the production Vite
  bundle; and
- `npm audit` reports zero known vulnerabilities.

## Operating boundary

The server binds to loopback and has no authentication, so it is not a hosted or
multi-user service. The UI records sources supplied by the user but does not
perform live research; M4 owns source retrieval and claim-level grounding.
Qualitative ratings are not forecasts or numerical simulation. M5 owns verified
quantitative analysis. Scheduled monitoring and notifications remain M6 scope.

The production OpenAI path was contract-tested with a fake transport but not
called with live credentials during M3 acceptance. Real-model quality, latency,
and cost baselines remain an explicit M7 pilot evidence gap.
