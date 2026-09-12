# Milestone 4 acceptance record

Status: Complete
Accepted: 2026-09-12

## Delivered research and grounding

| Requirement | Implementation | Verification |
|---|---|---|
| Deliberately limited retrieval | Exact-allowlisted HTTPS pages and canonical-root-contained UTF-8 `.md`/`.txt` files; no other sources | Web/document policy regression tests and surfaced UI capabilities |
| Claim-level citations | Each retrieved evidence claim preserves source kind/locator, title, publisher, excerpt, SHA-256 content hash, publication/retrieval dates, freshness status/basis, and reviewer support assessment | Schema round trip, Markdown/JSON export, and browser citation inspection |
| Evidence review | Sourced facts, user claims, and inferences remain distinct; support can be unreviewed, supporting, partial, contradicting, or unsupported | Domain invariants and browser review flow |
| Conflicts and failures | Model and deterministic lexical checks create reviewable contradiction records; retrieval failures produce explicit unavailable-source previews and records | Contradiction and failure tests |
| Selected refresh | One or more cited evidence records can be refreshed together; the preview shows content change and linked assumptions, drivers, constraints, consequences, and earliest stale stage | Content-change and impact assertions |
| Reviewable application | Preview is non-mutating; only the reviewer support assessment is accepted from the client; applying creates an immutable revision and marks downstream analysis stale | Preview-integrity, prior-revision, staleness, and browser tests |
| Untrusted-content controls | Active HTML is stripped, source text is React-escaped, model inputs receive a data-only marker, prompts forbid following source instructions, and an adversarial source is in the regression set | Injection fixture plus model-input and end-to-end safety assertions |
| Backward compatibility | Study schema 1.1 adds research metadata and migrates persisted 1.0 study/revision payloads on read | Legacy migration test |

## Acceptance-criteria evidence

The Chromium acceptance flow imports and completes a capacity study, retrieves an
adversarial local document, visibly presents the source instruction as untrusted
text, records the reviewer’s support assessment, applies an immutable evidence
revision, previews a selected refresh without mutation, regenerates stale stages,
confirms the injected instruction did not enter the recommendation, reloads the
study, and verifies the citation and review were preserved.

The deterministic suite separately proves that unavailable sources do not mutate
the study before explicit application; changed source content resets support to
unreviewed; affected assumption and driver IDs appear in the preview; prior
revision excerpts remain immutable; unsupported schemes/hosts/ports, redirects,
path traversal, non-text formats, private DNS targets, active HTML, invalid source
metadata, and client-tampered snapshots are rejected or neutralized.

At acceptance:

- `npm run check` passes all domain, persistence, pipeline, adapter, research,
  API, fixture, schema-drift, and production-build gates;
- `npm run test:e2e` passes both the M3 workflow and M4 research workflow in
  Chromium; and
- `npm audit` reports zero known vulnerabilities.

## Security basis and evidence limits

The web boundary follows the [OWASP SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html),
which recommends allowlisting where possible, protocol and address validation,
redirect controls, and DNS-rebinding defenses. The document boundary uses
[`fsPromises.realpath`](https://nodejs.org/docs/latest-v18.x/api/fs.html#fspromisesrealpathpath-options)
to resolve canonical paths before containment checks. Both sources were retrieved
2026-09-12; the OWASP page does not expose a publication date, and the Node source
is the official v18.20.8 API documentation.

Those sources support the retrieval-control design, not the quality of any study’s
claims. ScenarioLab does not infer that a citation semantically proves a claim:
support remains an explicit reviewer assessment. The lexical contradiction check
is intentionally a high-precision prompt for review, not comprehensive natural-
language fact checking. Authenticated sources, PDFs, office documents, JavaScript-
rendered pages, and general web search remain outside M4. Network-layer egress
controls are still recommended before any hosted deployment.
