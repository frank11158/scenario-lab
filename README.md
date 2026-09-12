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

Each study produces a readable decision brief, scenario comparison, strategy
assessment, and action plan, with an evidence register and update history.
Use “quick study” for a compact pass or “full study” for the complete structure.

## How it works

Codex uses the root `AGENTS.md` as project guidance. This follows the
[official project-instruction convention](https://learn.chatgpt.com/docs/agent-configuration/agents-md).
Start a fresh task in this folder to pick up the instructions reliably.

This version is a document-based planning workspace operated through Codex.
It requires no application server, package installation, or separate API key.
It does not include an autonomous forecasting engine or scheduled monitoring.
Research depends on the sources and tools available in a particular task.

Product development has completed Milestones 0 and 1. The reviewable baselines
live in [`product/`](product/); the AI planning pipeline begins with M2.

Scenarios explore plausible futures; they are not predictions. Probabilities
are optional. A study should help you identify choices that hold up across futures
and specific evidence that would justify changing course.

## Develop the structured foundation

Requires Node.js 18.14 or newer.

```sh
npm ci
npm run check
```

The public TypeScript entry point is `src/index.ts`. It exports the versioned Zod
study contracts, relationship validation, study-draft factory, reference-case
importer, deterministic Markdown/JSON exporters, SQLite database and repository,
and revision service. Generated JSON Schemas are in [`schema/`](schema/).
