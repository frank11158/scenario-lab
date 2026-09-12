# Milestone 1 acceptance record

Status: Complete
Accepted: 2026-09-11

## Delivered foundation

| Requirement | Implementation | Verification |
|---|---|---|
| Versioned schemas for all named entities | Zod contracts in `src/domain/schema.ts`; generated Study and StudyRevision JSON Schemas in `schema/` | Typecheck and `npm run schema:check` |
| Stable IDs and relationships | Opaque UUIDs, deterministic fixture UUIDs, and cross-entity validation in `src/domain/validation.ts` | Dangling/duplicate reference tests |
| Study creation and validation | `createStudyDraft`, `validateStudy`, and structured validation issues | Creation, unknown-value, missing-field, probability, and coverage tests |
| Persistence | SQLite/Drizzle repository with transactional migration 1 and foreign keys | In-memory and close/reopen file-database tests |
| Revision snapshots | Atomic accepted snapshots with ordinal and parent links | Two-revision immutability/history test |
| JSON and Markdown export | Deterministic JSON and the existing study-section Markdown format | Round-trip, stability, and section tests |
| Reference-case import | All four M0 fixtures, including synthetic labels and evaluation contracts | `npm run fixtures:validate` and import tests |

## Acceptance-criteria evidence

The automated suite proves:

- save/load preserves a study, including after closing and reopening SQLite;
- parsing an exported JSON study recreates the same validated value;
- missing required fields and dangling IDs return path-specific errors;
- earlier accepted snapshots remain accessible after later edits and acceptance;
- unknown decision-maker, horizon, deadline, sources, dates, owners, and other
  fields can be represented explicitly without invented defaults;
- probabilities are optional, but when supplied require stated mutually exclusive
  and exhaustive coverage, a basis for every scenario, and a sum of one;
- every feasible strategy must have exactly one evaluation in every scenario;
- each M0 fixture retains its synthetic notice, unknowns, options, expected output
  properties, and prohibited shortcuts; and
- Markdown conversion contains every section of `templates/study.md`.

Run the complete gate with:

```sh
npm ci
npm run check
npm audit
```

At acceptance, `npm run check` passes 12 tests plus all fixture and generated-schema
checks. `npm audit` reports zero known vulnerabilities.

## Scope boundary

M1 is a library and persistence foundation, not the browser workbench. It does not
generate scenarios, run model requests, expose a server, or provide the M3 UI.
Those layers consume these validated contracts beginning in M2.

The Node test runner replaces the originally selected Vitest for M1 because the
advisory-free Vitest release requires a newer Node runtime than the current Node
18 environment. This change is recorded in `architecture-decisions.md` and does
not alter the production architecture.
