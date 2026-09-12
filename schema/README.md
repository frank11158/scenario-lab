# Generated schemas

- `study.schema.json` is the structural JSON Schema for a ScenarioLab Study.
- `study-revision.schema.json` is the structural JSON Schema for accepted revision
  metadata.
- `workflow-run.schema.json` describes resumable pipeline run records.
- `stages/*.schema.json` are the seven model structured-output contracts.

Study contracts use schema version `1.0.0`; workflow contracts use `2.0.0`. All are
generated from their Zod contracts. Do not edit them manually.

```sh
npm run schema:generate
npm run schema:check
```

JSON Schema validates structure. Cross-entity IDs, evaluation coverage, synthetic
labels, and scenario probability rules require `validateStudy()` because they are
relational invariants.
