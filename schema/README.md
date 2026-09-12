# Generated schemas

- `study.schema.json` is the structural JSON Schema for a ScenarioLab Study.
- `study-revision.schema.json` is the structural JSON Schema for accepted revision
  metadata.

Both describe schema version `1.0.0` and are generated from the Zod contracts in
`src/domain/schema.ts`. Do not edit them manually.

```sh
npm run schema:generate
npm run schema:check
```

JSON Schema validates structure. Cross-entity IDs, evaluation coverage, synthetic
labels, and scenario probability rules require `validateStudy()` because they are
relational invariants.
