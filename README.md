# ScenarioLab

A reusable Codex workspace for deciding what to do when the future is uncertain.

**Problem → Evidence → Drivers → Scenarios → Strategy tests → Indicators → Actions**

## Start here

Use this folder as your Codex project and send a problem in ordinary language:

> Run a scenario study on whether I should switch jobs now or wait six months.
> Compare staying, searching while employed, and leaving first. Ask for the
> personal constraints that would materially affect the recommendation.

Or try:

- “Stress-test our platform strategy if traffic grows between 2× and 10× over
  the next year. Identify the measurements you need before recommending changes.”
- “Explore how AI inference infrastructure could evolve over three years.
  Start by clarifying which decision this analysis should support.”
- “Run a quick scenario study on whether our team should launch now or pilot first.”
- “Update the study in studies/[folder] with this new evidence. Explain whether
  the recommendation or action thresholds change.”

You do not need to fill out a form first. The [intake template](templates/intake.md)
is available when you want to prepare the context yourself.

## What is included

| File | Purpose |
|---|---|
| [AGENTS.md](AGENTS.md) | Persistent instructions for scenario work in this project |
| [Study template](templates/study.md) | Decision framing through actions and review |
| [Evidence template](templates/evidence.md) | Facts, assumptions, sources, and gaps |
| [Update template](templates/updates.md) | Changes to evidence and decisions over time |
| [Worked example](examples/team-workshop.md) | A fictional study showing the complete workflow |
| [Studies](studies/README.md) | Home for your actual analyses |
| [Development roadmap](development.md) | Product milestones and release gates |
| [M0 product baseline](product/m0-acceptance.md) | Approved scope, flows, fixtures, rubric, and architecture decisions |
| [M1 foundation](product/m1-acceptance.md) | Versioned model, validation, SQLite persistence, revisions, imports, and exports |
| [M2 pipeline](product/m2-acceptance.md) | Resumable validated generation, model adapter, retries, usage, and staleness |
| [M3 workbench](product/m3-acceptance.md) | Complete browser workflow, local API, history, model-failure recovery, and exports |

Each study produces a readable decision brief, scenario comparison, strategy
assessment, and action plan, with an evidence register and update history.
Use “quick study” for a compact pass or “full study” for the complete structure.

## How it works

Codex uses the root `AGENTS.md` as project guidance. This follows the
[official project-instruction convention](https://learn.chatgpt.com/docs/agent-configuration/agents-md).
Start a fresh task in this folder to pick up the instructions reliably.

ScenarioLab can still be used as a document-based Codex workspace with no
application server. It now also includes a local browser workbench. AI generation
is enabled when `OPENAI_API_KEY` and `OPENAI_MODEL` are supplied; manual creation,
editing, persistence, revision history, and export remain available without them.
It does not include autonomous forecasting, live research, or scheduled monitoring.

Product development has completed Milestones 0 through 3. The reviewable baselines
live in [`product/`](product/); M3 is the complete local-first MVP.

Scenarios explore plausible futures; they are not predictions. Probabilities
are optional. A study should help you identify choices that hold up across futures
and specific evidence that would justify changing course.

## Develop the structured foundation

Requires Node.js 18.14 or newer.

```sh
npm ci
npm run check
npm run test:e2e:install # once per machine
npm run test:e2e
```

Start the workbench in manual mode:

```sh
npm start
```

Then open `http://127.0.0.1:4174`. To enable generation, set
`OPENAI_API_KEY` and `OPENAI_MODEL` before starting. By default, study data is
stored in `scenario-lab.sqlite`; set `SCENARIOLAB_DB_PATH` to choose another
local path.

The public TypeScript entry point is `src/index.ts`. It exports the versioned Zod
study contracts, relationship validation, study-draft factory, reference-case
importer, deterministic Markdown/JSON exporters, SQLite database and repository,
revision service, and resumable planning pipeline. Generated JSON Schemas are in
[`schema/`](schema/). The React/Vite client is in [`web/`](web/) and the local
HTTP application boundary is in [`src/server/`](src/server/).
