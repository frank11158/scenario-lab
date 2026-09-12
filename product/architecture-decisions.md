# ScenarioLab M0 architecture decisions

Status: Accepted for M1–M3
Decision date: 2026-09-11
Review trigger: M2 baseline results or a pilot-blocking constraint

These decisions optimize for a single-user, local-first MVP and a small codebase.
They are reversible at module boundaries; they are not a commitment to the later
multi-user hosted architecture.

## Decision summary

| Area | M0 decision | Primary reason | Revisit when |
|---|---|---|---|
| Application surface | Local-first browser workbench, desktop-width first | Fastest inspectable UI for tables, comparison, and export | Local setup materially blocks pilots or offline packaging is required |
| Structure | TypeScript modular monolith in one repository | Shared types and low operational complexity | Independent scaling or release cadence is demonstrated |
| UI | React + Vite | Simple client build and component ecosystem | Framework blocks accessibility, packaging, or required server rendering |
| API/application | Node.js + Fastify | Explicit local API boundary and lightweight modular server | Deployment surface or team expertise changes |
| Contracts | TypeScript + Zod; JSON Schema emitted for exports | Runtime validation and reusable typed contracts | Cross-language clients become a near-term requirement |
| Persistence | SQLite + Drizzle ORM; append-only accepted revisions | Portable local database, transactions, inspectable migrations | Concurrent multi-user writes or hosted isolation is required |
| Model integration | Provider-neutral adapter; first adapter uses OpenAI Responses API structured output | One supported path while preventing provider logic from entering domain code | Quality, residency, cost, or availability requires another provider |
| Deployment | Local Node process serving API and static UI; Docker image as reproducible pilot option | Single-user boundary without premature cloud operations | Representative pilots need zero-install hosting |
| Testing | Vitest for domain/application; Playwright for critical flows; JSON fixtures for evaluation | Covers deterministic core and user-visible workflow | Test feedback or platform changes justify alternatives |
| Observability | Local structured logs and per-stage run/usage records; no study content in diagnostics by default | Debuggability with data minimization | Hosted operations require centralized telemetry |

Library versions are selected and locked when M1 scaffolding begins. M0 fixes the
responsibility boundaries, not version numbers that would become stale.

## Application boundaries

```text
React workbench
      |
Fastify application API
      |
Study domain + validation + revision service
      |                 |
SQLite repositories    Workflow runner (M2)
                        |
                  Model adapter
```

- The **domain layer** owns entities, stable IDs, references, constraints,
  completeness rules, and staleness semantics. It has no UI, database, or model
  dependency.
- The **application layer** coordinates drafts, accepted revisions, import/export,
  and later stage runs.
- **Repositories** persist versioned JSON payloads and indexed metadata in SQLite.
  Accepted revisions are immutable; restoring one creates a new draft.
- The **workflow runner** checkpoints each stage and calls a replaceable model
  adapter. It cannot write directly to an accepted revision.
- Deterministic validation and calculations stay in code. The model proposes and
  explains qualitative content.

## Storage and privacy

The SQLite database and exports live in a user-selected local data directory, not
the source tree. Enable foreign keys and transactional migrations. Store:

- study metadata and mutable working draft;
- immutable accepted revision snapshots and parent IDs;
- stage inputs/outputs, status, prompt/model identifiers, and usage/cost metadata;
- source metadata entered by the user; and
- explicit provenance and authored/generated origin for editable content.

Do not store private chain-of-thought. Logs use IDs, timing, status, token counts,
and validation errors; prompt or study content is excluded unless the user enables
a diagnostic export. Model calls transmit only the stage inputs shown in a preview.
Deletion/export behavior is implemented and tested before hosted exposure (M7).

## Model policy

M2 will define a small interface supporting structured request/response, model and
prompt version, cancellation, usage, and error classification. The initial OpenAI
adapter uses schema-constrained output. No generation is required to create, edit,
validate, save, reopen, or export a study. Retries are bounded per stage and never
silently replace user content. Provider selection and credentials are runtime
configuration and are not persisted in study exports.

## Performance, cost, and latency budgets

These are adopted engineering budgets for measurement, not claims about current
performance. M2 records baselines; M7 freezes release thresholds.

| Operation | Budget | Measurement rule |
|---|---:|---|
| Local edit/autosave acknowledgment | p95 ≤ 250 ms | 100 edits on reference-sized study, warm local process |
| Open saved reference-sized study | p95 ≤ 1 s | UI usable with latest accepted revision visible |
| Validate or export without model | p95 ≤ 2 s | Largest M0 fixture expanded to a full study |
| First visible generation progress | p95 ≤ 3 s | From user confirmation to stage status update |
| Quick-study AI draft | p50 ≤ 45 s; p95 ≤ 120 s | End-to-end, successful run, network time included |
| Full-study AI draft | p50 ≤ 90 s; p95 ≤ 240 s | End-to-end, successful run, network time included |
| Quick-study model cost | target ≤ USD 0.75; hard warning at USD 1.50 | Actual provider-reported usage per completed draft |
| Full-study model cost | target ≤ USD 2.00; hard warning at USD 4.00 | Actual provider-reported usage per completed draft |
| Stage retries | maximum 2 after initial attempt | Validation/transient errors; cost remains visible |

The runner estimates cost before generation when price metadata is available and
requires explicit confirmation if the hard warning is expected to be exceeded.
Unknown price never displays as zero. A failed or cancelled run records incurred
usage separately from completed-study cost.

## Deployment decision and limitations

MVP pilots run as a local application on loopback only. A production-style Docker
image provides a repeatable environment but is not exposed as a public service.
There is no authentication in the local single-user boundary. Any hosted or
network-accessible deployment requires authentication, per-user access isolation,
backup/restore, deletion, transport security, and a privacy review under M7.

SQLite backup is a consistent database snapshot while writes are quiesced (or via
the SQLite backup API once implemented). Export is not a substitute for backup.

## Deliberately rejected for the MVP

- Microservices: no independently scaling workload yet.
- A vector database: manual evidence and structured links suffice before M4.
- Multi-agent generation: no evaluation evidence that added cost/complexity helps.
- Cloud-first multi-user hosting: expands privacy and operational scope before the
  core workflow is validated.
- Numerical simulation inside the model: deterministic quantitative work belongs
  to M5 code with units, inputs, and reproducibility.

## M1 handoff constraints

M1 must keep the domain package independent of React, Fastify, Drizzle, and the
model adapter; use stable opaque IDs; represent unknown explicitly; validate all
relationships; preserve JSON round trips; and import all four `fixture_version`
`0.1` files. M1 may refine the fixture import mapping but must not weaken their
expected properties or synthetic labels.
