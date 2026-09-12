# M0 reference cases

These four JSON files are synthetic evaluation fixtures, not evidence or advice.
They define inputs and expected **properties**, not a single correct recommendation.
M1 will import them into the versioned study schema; `fixture_version` is the
temporary M0 contract and must not be confused with that schema version.

| ID | Family | Primary behavior exercised |
|---|---|---|
| RC-01 | Workshop regression example | Budget constraint, fallback, cancellation trigger |
| RC-02 | Personal/job timing | Personal runway, reversibility, missing private context |
| RC-03 | Technical capacity | Range-based demand, lead times, staged investment |
| RC-04 | Technology strategy | Adoption/ecosystem uncertainty, path dependence, pilot option |

## Fixture contract

Every fixture contains:

- `synthetic: true` and an explicit notice;
- the decision, objective, horizon, deadline, options, constraints, and inputs;
- important unknowns that must remain visible;
- expected output properties used for evaluation; and
- prohibited shortcuts that should fail review.

Alternative scenarios and recommendations are valid when they meet these properties
and the shared rubric. Tests should assert semantic coverage by stable requirement
IDs, not exact generated prose.
